var EventEmitter = require("events").EventEmitter;
var exec = require('child_process').exec;
require('rootpath')();
var camera = require('camera/camera.js');
var db = require('system/db.js');
var motion = require('motion/motion.js');
var image = require('camera/image/image.js');
var exp = require('intervalometer/exposure.js');
var interpolate = require('intervalometer/interpolate.js');
var fs = require('fs');
var async = require('async');
var TLROOT = "/root/time-lapse";
var Button = require('gpio-button');
var gpio = require('linux-gpio');
var _ = require('underscore');
//var suncalc = require('suncalc');
var meeus = require('meeusjs');
var eclipse = require('intervalometer/eclipse.js');
var moment = require('moment');


var AUXTIP_OUT = 111;
var AUXRING_OUT = 110;
var HOTSHOE_IN = 34;

gpio.setMode(gpio.MODE_RAW);

gpio.setup(AUXTIP_OUT, gpio.DIR_OUT, function(err){
    if(err) console.log("GPIO error: ", err);
    gpio.write(AUXTIP_OUT, 1);
});

gpio.setup(AUXRING_OUT, gpio.DIR_OUT, function(err){
    if(err) console.log("GPIO error: ", err);
    gpio.write(AUXRING_OUT, 1);
});

gpio.setup(HOTSHOE_IN, gpio.DIR_IN, function(err){
    if(err) console.log("GPIO error: ", err);
});

var intervalometer = new EventEmitter();

intervalometer.db = db;

var timerHandle = null;
var delayHandle = null;

var rate = 0;

intervalometer.autoSettings = {
    paddingTimeMs: 2000
}


intervalometer.timelapseFolder = false;

intervalometer.status = {
    running: false,
    frames: 0,
    framesRemaining: 0,
    rampRate: 0,
    intervalMs: 0,
    message: "",
    rampEv: null,
    autoSettings: {
        paddingTimeMs: 2000
    },
    exposure: exp
}

intervalometer.internal = {};

intervalometer.emit("intervalometer.status", intervalometer.status);

var auxTrigger = new Button('input-aux2');

auxTrigger.on('press', function() {
    console.log("AUX2 trigger!");
    if (intervalometer.status.running && intervalometer.currentProgram.intervalMode == 'aux') timerHandle = setTimeout(runPhoto, 0);
});

auxTrigger.on('error', function(err) {
    console.log("AUX2 error: ", err);
});

function motionSyncPulse() {
    if (intervalometer.status.running && intervalometer.currentProgram.intervalMode != 'aux') {
        gpio.read(HOTSHOE_IN, function(err, shutterClosed) {
            console.log("hotshoe:", shutterClosed);
            if(shutterClosed) {
                console.log("=> AUX Pulse");
                gpio.write(AUXTIP_OUT, 0, function() {
                    setTimeout(function(){
                        gpio.write(AUXTIP_OUT, 1);
                    }, 200);
                });
            } else {
                setTimeout(motionSyncPulse, 100);
            }
        });

    } 
}

function fileInit() {
    fs.writeFileSync(intervalometer.status.timelapseFolder + "/details.csv", "frame, error, target, setting, rate, interval, timestamp, file, p, i, d\n");
}

function writeFile() {
    fs.appendFileSync(intervalometer.status.timelapseFolder + "/details.csv", intervalometer.status.frames + ", " + intervalometer.status.evDiff + "," + exp.status.targetEv + "," + intervalometer.status.rampEv + "," + exp.status.rate + "," + (intervalometer.status.intervalMs / 1000) + "," + intervalometer.status.lastPhotoTime + "," + intervalometer.status.path + "," + exp.status.pComponent + "," + exp.status.iComponent + "," + exp.status.dComponent + "\n");
    //image.writeXMP(name, intervalometer.status.evDiff);
}

function getDetails(file) {
    var d = {
        frames: intervalometer.status.frames,
        evCorrection: intervalometer.status.evDiff,
        targetEv: exp.status.targetEv,
        actualEv: intervalometer.status.rampEv,
        cameraEv: intervalometer.status.cameraEv,
        rampRate: exp.status.rate,
        intervalMs: intervalometer.status.intervalMs,
        timestamp: intervalometer.status.lastPhotoTime,
        fileName: file || intervalometer.status.path,
        p: exp.status.pComponent,
        i: exp.status.iComponent,
        d: exp.status.dComponent,
    };
    if(intervalometer.gpsData) {
        d.latitude = intervalometer.gpsData.lat;
        d.longitude = intervalometer.gpsData.lon;

        var sunmoon = meeus.sunmoon(new Date(), intervalometer.gpsData.lat, intervalometer.gpsData.lon, intervalometer.gpsData.alt);
        var sunpos = {
            azimuth: sunmoon.sunpos.az,
            altitude: sunmoon.sunpos.alt,
        }
        var moonpos = {
            azimuth: sunmoon.moonpos.az,
            altitude: sunmoon.moonpos.alt,
        }

        d.sunPos = sunpos;
        d.moonPos = moonpos;
        d.moonIllumination = sunmoon.mooninfo.illumination;
    }
    return d;
}

var startShutterEv = -1;

function calculateIntervalMs(interval, currentEv) {
    var dayEv = 8;
    var nightEv = -2;
    if (intervalometer.currentProgram.intervalMode == 'fixed') {
        return interval * 1000;
    } else {
        var newInterval = interpolate.linear([{
            x: dayEv,
            y: parseInt(intervalometer.currentProgram.dayInterval)
        }, {
            x: nightEv,
            y: parseInt(intervalometer.currentProgram.nightInterval)
        }], currentEv);
        return newInterval * 1000;
    }
}

var axisPositions = {};
function doKeyframeAxis(axisName, keyframes, setupFirst, interpolationMethod, position, motionFunction) {
    if(interpolationMethod != 'smooth') interpolationMethod = 'linear';
    if (intervalometer.status.running && keyframes && keyframes.length > 0 && keyframes[0].position != null) {
        var kfSet = null;
        var kfCurrent = null;

        if (setupFirst) {
            keyframes[0].seconds = 0;
            //keyframes[0].position = position || null;
            kfSet = keyframes[0].position;
            axisPositions[axisName] = position;
        } else {
            var secondsSinceStart = intervalometer.status.lastPhotoTime + (intervalometer.status.intervalMs / 1000);

            console.log("KF: Seconds since last: " + secondsSinceStart);
            var totalSeconds = 0;
            kfPoints = keyframes.map(function(kf) {
                return {
                    x: kf.seconds,
                    y: kf.position || 0
                }
            }).sort(function(a, b) {
                if(a.x < b.x) return -1;
                if(a.x > b.x) return 1;
                return 0;                
            });
            kfSet = interpolate[interpolationMethod](kfPoints, secondsSinceStart);
            console.log("KF: " + axisName + " target: " + kfSet, "points:", kfPoints);
        }

        if (axisPositions[axisName] == null) {
            motionFunction(kfSet, axisName); // absolute setting (like ev)
        } else {
            var precision = axisName == 'focus' ? 1 : 10000; // limit precision to ensure we hit even values
            var kfTarget = Math.round(kfSet * precision) / precision;
            if (kfTarget != Math.round(axisPositions[axisName] * precision) / precision) {
                var relativeMove = kfTarget - axisPositions[axisName];
                if (motionFunction) motionFunction(relativeMove, axisName);
                axisPositions[axisName] = kfTarget;
            } else {
                if (motionFunction) motionFunction(null, axisName);
            }
        }

    } else {
        if (motionFunction) motionFunction(null, axisName);
    }
}

function calculateCelestialDistance(startPos, currentPos, trackBelowHorizon) {
    var panDiff = (currentPos.azimuth - startPos.azimuth) * 180 / Math.PI;
    var tiltDiff = (currentPos.altitude - startPos.altitude) * 180 / Math.PI;
    var altDeg = currentPos.altitude * 180 / Math.PI;
    var ease = 1;
    var easeStartDegrees = 15;
    var easeEndDegrees = -5;
    if(!trackBelowHorizon && altDeg < easeStartDegrees) {
        if(altDeg < easeEndDegrees) {
            ease = 0;
        } else {
            ease = (altDeg - easeEndDegrees) / (easeStartDegrees - easeEndDegrees);
        }
    }
    return {
        pan: panDiff,
        tilt: tiltDiff,
        ease: ease
    }
}

function getTrackingMotor(trackingMotor) {
    if(trackingMotor && trackingMotor != 'none') {
        var parts = trackingMotor.match(/^([A-Z]+)-([0-9]+)(r?)$/);
        if(parts && parts.length > 2) {
            var stepsPerDegree = 1;
            if(parts[1] == 'NMX') stepsPerDegree = 550.81967213;
            return {
                driver: parts[1],
                motor: parts[2],
                direction: parts[3] == 'r' ? -1 : 1,
                stepsPerDegree: stepsPerDegree
            }
        } else {
            return false;
        }
    } else {
        return false;
    }
}

function processKeyframes(setupFirst, callback) {

    var numAxes = 1;
    var axesDone = 0;

    if(intervalometer.currentProgram.scheduled) return callback();

    var checkDone = function(item) {
        axesDone++;
        console.log("KF: " + item + "completed");
        console.log("KF: " + axesDone + " of " + numAxes + " keyframe items complete");
        if (axesDone >= numAxes && callback) {
            console.log("KF: keyframes complete, running callback");
            callback();
        }
    }

    if(intervalometer.currentProgram.coords) {
        var sunmoon = meeus.sunmoon(new Date(), intervalometer.currentProgram.coords.lat, intervalometer.currentProgram.coords.lon, intervalometer.currentProgram.coords.alt);
        var sunPos = {
            azimuth: sunmoon.sunpos.az,
            altitude: sunmoon.sunpos.alt,
        }
        var moonPos = {
            azimuth: sunmoon.moonpos.az,
            altitude: sunmoon.moonpos.alt,
        }
    }

    for(var m in intervalometer.currentProgram.axes) {
        var axis = intervalometer.currentProgram.axes[m];
        numAxes++;
        console.log("Intervalometer: KF: running axis", m);

        if(axis.type == 'keyframe') {
            if(m == 'focus') {
                doKeyframeAxis(m, axis.kf, setupFirst, axis.interpolation || 'linear', camera.ptp.settings.focusPos, function(focus) {
                    var doFocus = function() {
                        console.log("KF: Moving focus by " + focus + " steps");
                        var dir = focus > 0 ? 1 : -1;
                        var steps = Math.abs(focus);
                        camera.ptp.focus(dir, steps, function() {
                            if(camera.ptp.model.match(/fuji/i) || intervalometer.status.useLiveview) {
                                checkDone('focus');
                            } else {
                                setTimeout(function(){
                                    camera.ptp.lvOff(function(){
                                        setTimeout(function(){
                                            checkDone('focus');
                                        }, 500);                                
                                    });
                                }, 500);
                            }
                        });
                    }
                    focus += intervalometer.status.focusDiffNew;
                    intervalometer.status.focusDiffNew = 0;
                    if(focus) {
                        if(camera.ptp.model.match(/fuji/i) || intervalometer.status.useLiveview) {
                            doFocus();
                        } else {
                            camera.ptp.preview(function() {
                                setTimeout(doFocus, 1000);
                            });
                        }
                    } else {
                        checkDone('focus');
                    }
                });
            } else if(m == 'ev') {
                doKeyframeAxis(m, axis.kf, setupFirst, axis.interpolation || 'linear', null, function(ev) {
                    //if (ev != null && camera.settings.ev != ev) camera.setEv(ev);
                    checkDone('ev');
                });
            } else if(m == 'interval') {
                doKeyframeAxis(m, axis.kf, setupFirst, axis.interpolation || 'linear', null, function(interval) {
                    //intervalometer.status.intervalMs = interval * 1000;
                    checkDone('interval');
                });
            } else {
                var parts = m.split('-');
                var driver = parts[0];
                var motor = parseInt(parts[1]);
                doKeyframeAxis(m, axis.kf, setupFirst, axis.interpolation || 'smooth', motion.getPosition(driver, motor), function(move, axisName) {
                    var parts = axisName.split('-');
                    if (move && parts.length == 2) {
                        var driver = parts[0];
                        var motor = parseInt(parts[1]);
                        console.log("KF: Moving " + axisName + " by " + move + " steps");
                        if (motion.status.available) {
                            var connected = false;
                            for(var index = 0; index < motion.status.motors.length; index++) {
                                var mo = motion.status.motors[index];
                                if(mo.driver == driver && mo.motor == motor) {
                                    connected = mo.connected;
                                    break;
                                }
                            }
                            if(connected) {
                                motion.move(driver, motor, move, function() {
                                    checkDone(axisName);
                                });
                            } else {
                                console.log("KF: error moving", axisName, "-- motor not connected");
                                checkDone(axisName);
                            }
                        } else {
                            console.log("KF: error moving -- no motion system connected");
                            checkDone(axisName);
                        }
                    } else {
                        checkDone(axisName);
                    }
                });
            }
        } else if(axis.type == 'tracking' || axis.type == 'constant') {
            var trackingTarget = null;
            if(axis.type == 'tracking' && !intervalometer.currentProgram.coords) {
                axis.type = 'disabled';
                intervalometer.emit('error', "No GPS/coordinates available for tracking calculations.  Time-lapse will continue with tracking disabled on axis " + m + ".");
                return checkDone('tracking');
            }
            if(axis.type == 'tracking' && intervalometer.currentProgram.trackingTarget == 'sun' && sunPos) {
                trackingTarget = calculateCelestialDistance(intervalometer.status.sunPos, sunPos, axis.trackBelowHorizon);
            } else if(axis.type == 'tracking' && intervalometer.currentProgram.trackingTarget == 'moon' && moonPos) {
                trackingTarget = calculateCelestialDistance(intervalometer.status.moonPos, moonPos, axis.trackBelowHorizon);
            } else if(axis.type == 'constant') {
                if(axis.rate == null) axis.rate = 15;
                if(axis.orientation == 'pan') {
                    trackingTarget = {
                        pan: (((new Date() / 1000) - intervalometer.status.startTime) / 3600) * parseFloat(axis.rate),
                        tilt: 0,
                        ease: 1
                    }
                }
                if(axis.orientation == 'tilt') {
                    trackingTarget = {
                        tilt: (((new Date() / 1000) - intervalometer.status.startTime) / 3600) * parseFloat(axis.rate),
                        pan: 0,
                        ease: 1
                    }
                }
            }
            var motor = null;
            motor = getTrackingMotor(m);
            var rev = axis.orientation == 'tilt' ? !axis.reverse : axis.reverse; // tilt axis is naturally reversed
            if(axis.motor && axis.motor.reverse) rev = !rev;
            motor.direction = rev ? -1 : 1;

            if(trackingTarget) {
                if(axis.orientation == 'pan') {
                    var panDegrees = trackingTarget.pan - intervalometer.status.trackingPan;
                    var addSkippedDegrees = panDegrees;
                    panDegrees *= trackingTarget.ease;
                    addSkippedDegrees -= panDegrees;
                    intervalometer.status.trackingPan += addSkippedDegrees;
                    if(intervalometer.status.panDiff != intervalometer.status.panDiffNew) {
                        intervalometer.status.panDiff = intervalometer.status.panDiffNew;
                    }
                    panDegrees += intervalometer.status.panDiff;
                    if(panDegrees != 0) {
                        intervalometer.status.trackingPanEnabled = true;
                        var panSteps = panDegrees * motor.stepsPerDegree;
                        if(motor.stepsPerDegree > 100) {
                            panSteps = Math.round(panSteps);
                        }
                        console.log("Intervalometer: tracking pan", panDegrees, intervalometer.status.trackingPan, panSteps, intervalometer.status.frames);
                        motion.move(motor.driver, motor.motor, panSteps * motor.direction, function() {
                            intervalometer.status.trackingPan += panSteps / motor.stepsPerDegree;
                            checkDone('tracking');
                        });
                    } else {
                        checkDone('tracking');
                    }
                } else if(axis.orientation == 'tilt') {
                    var tiltDegrees = trackingTarget.tilt - intervalometer.status.trackingTilt;
                    var addSkippedDegrees = tiltDegrees;
                    tiltDegrees *= trackingTarget.ease;
                    addSkippedDegrees -= tiltDegrees;
                    intervalometer.status.trackingTilt += addSkippedDegrees;
                    if(intervalometer.status.tiltDiff != intervalometer.status.tiltDiffNew) {
                        intervalometer.status.tiltDiff = intervalometer.status.tiltDiffNew;
                    }
                    tiltDegrees += intervalometer.status.tiltDiff;
                    if(tiltDegrees != 0 && axis.orientation == 'tilt') {
                        intervalometer.status.trackingTiltEnabled = true;
                        var tiltSteps = tiltDegrees * motor.stepsPerDegree;
                        if(motor.stepsPerDegree > 100) {
                            tiltSteps = Math.round(tiltSteps);
                        }
                        console.log("Intervalometer: tracking tilt", tiltDegrees, intervalometer.status.trackingTilt, tiltSteps, intervalometer.status.frames);
                        motion.move(motor.driver, motor.motor, tiltSteps * motor.direction, function() {
                            intervalometer.status.trackingTilt += tiltSteps / motor.stepsPerDegree;
                            checkDone('tracking');
                        });
                    } else {
                        checkDone('tracking');
                    }
                } else {
                    checkDone('tracking');
                }
            } else {
                checkDone('tracking');
            }
        } else if(axis.type == 'polar') {
            var motor = null;
            motor = getTrackingMotor(m);
            var rev = axis.orientation == 'tilt' ? !axis.reverse : axis.reverse; // tilt axis is naturally reversed
            if(axis.motor && axis.motor.reverse) rev = !rev;
            motor.direction = rev ? -1 : 1;

            var currentPolarPos = motion.getPosition(motor.driver, motor.motor);
            if(intervalometer.internal.polarStart == null) intervalometer.internal.polarStart = currentPolarPos;
            var backlashAmount = 5 * motor.stepsPerDegree;
            var degressPerHour = 15;            
            var stepsPerSecond = ((motor.stepsPerDegree * degressPerHour) / 3600) * motor.direction;

            var setupTracking = function(speed, _motor) {
                var moveBack = function(cb) {
                    console.log("Intervalometer: polar: moving back");
                    motion.move(_motor.driver, _motor.motor, (intervalometer.internal.polarStart - currentPolarPos) + (backlashAmount * -_motor.direction), function(err) {
                        if(err) console.log("Intervalometer: polar: err:", err);
                        setTimeout(cb);
                    });
                }
                var moveStart = function(cb) {
                    console.log("Intervalometer: polar: moving to start");
                    motion.move(_motor.driver, _motor.motor, backlashAmount * _motor.direction, function(err) {
                        if(err) console.log("Intervalometer: polar: err:", err);
                        setTimeout(cb);
                    });
                }
                var startTracking = function() {
                    console.log("Intervalometer: polar: moving tracking...");
                    intervalometer.internal.polarTrackIntervalHandle = setInterval(function(){
                        motion.joystick(_motor.driver, _motor.motor, speed);
                    }, 500);
                    setTimeout(function(){
                        checkDone('polar');
                    }, 100);
                }
                if(camera.ptp.settings.details.shutter.ev < -2) { // only for shutter speeds longer than 1/15
                    moveBack(function(){
                        moveStart(function(){
                            startTracking();
                        });
                    });
                } else {
                    checkDone('polar');
                }
            }
            if(intervalometer.internal.polarTrackIntervalHandle) {
                clearInterval(intervalometer.internal.polarTrackIntervalHandle);
                intervalometer.internal.polarTrackIntervalHandle = null;
                motion.joystick(motor.driver, motor.motor, 0, function(){
                    setupTracking(stepsPerSecond + 1000 * motor.direction, motor);
                });
            } else {
                motion.getBacklash(motor.driver, motor.motor, function(backlash) {
                    console.log("Intervalometer: polar: backlash was", backlash);
                    intervalometer.internal.polarMotorBacklash = {
                        backlash: backlash,
                        driver: motor.driver,
                        motor: motor.motor
                    }
                    motion.setBacklash(motor.driver, motor.motor, 0, function() {
                        setupTracking(stepsPerSecond + 1000 * motor.direction, motor);
                    });
                });
            }
        } else {
            if(m == 'focus') {
                var doFocus = function(focus) {
                    console.log("KF: Moving focus by " + focus + " steps");
                    var dir = focus > 0 ? 1 : -1;
                    var steps = Math.abs(focus);
                    camera.ptp.focus(dir, steps, function() {
                        if(camera.ptp.model.match(/fuji/i) || intervalometer.status.useLiveview) {
                            checkDone('focus-update');
                        } else {
                            setTimeout(function(){
                                camera.ptp.lvOff(function(){
                                    setTimeout(function(){
                                        checkDone('focus-update');
                                    }, 500);                                
                                });
                            }, 500);
                        }
                    });
                }
                if(intervalometer.status.focusDiffNew) {
                    intervalometer.status.focusDiffNew = 0;
                    if(camera.ptp.model.match(/fuji/i) || intervalometer.status.useLiveview) {
                        doFocus(intervalometer.status.focusDiffNew);
                    } else {
                        camera.ptp.preview(function() {
                            setTimeout(function(){
                                doFocus(intervalometer.status.focusDiffNew);
                            }, 1000);
                        });
                    }
                } else {
                    checkDone('focus-update');
                }
            } else {
                checkDone(m);
            }
        }

    }
    checkDone('function');
}


function getEvOptions() {
    var maxShutterLengthMs = (intervalometer.status.intervalMs - intervalometer.autoSettings.paddingTimeMs);
    if(intervalometer.currentProgram.intervalMode == 'aux') maxShutterLengthMs -= 2000; // add an extra 2 seconds for external motion
    if(maxShutterLengthMs < 500) maxShutterLengthMs = 500;
    return {
        cameraSettings: camera.ptp.settings,
        maxShutterLengthMs: maxShutterLengthMs,
        isoMax: intervalometer.currentProgram.isoMax,
        isoMin: intervalometer.currentProgram.isoMin,
        shutterMax: intervalometer.currentProgram.shutterMax,
        apertureMax: intervalometer.currentProgram.apertureMax,
        apertureMin: intervalometer.currentProgram.apertureMin,
        parameters: intervalometer.currentProgram.rampParameters || 'S+I',
        blendParams: intervalometer.currentProgram.rampParameters && intervalometer.currentProgram.rampParameters.indexOf('=') !== -1
    }
}

var busyExposure = false;

function setupExposure(cb) {
    var expSetupStartTime = new Date() / 1000;
    console.log("\n\nEXP: setupExposure");
    if(intervalometer.status.useLiveview && !busyExposure) {
        busyExposure = true;
        return camera.ptp.liveview(function(){
            setupExposure(cb);
        });
    }
    busyExposure = true;
    camera.ptp.getSettings(function() {
        console.log("EXP: current interval: ", intervalometer.status.intervalMs, " (took ", (new Date() / 1000 - expSetupStartTime), "seconds from setup start");
        var diff = 0;
        if(!intervalometer.status.rampEv) {
            intervalometer.status.rampEv = camera.lists.getEvFromSettings(camera.ptp.settings);
        }
        dynamicChangeUpdate();
        if(intervalometer.status.hdrSet && intervalometer.status.hdrSet.length > 0) {
            if(!intervalometer.status.hdrIndex) intervalometer.status.hdrIndex = 0;
            if(intervalometer.status.hdrIndex < intervalometer.status.hdrSet.length) {
                diff = intervalometer.status.hdrSet[intervalometer.status.hdrIndex];
                intervalometer.status.hdrIndex++;
            } else {
                intervalometer.status.hdrIndex = 0;
            }
            console.log("HDR adjustment:", diff, intervalometer.status.hdrIndex);
        }
        if(intervalometer.status.rampMode == 'preset') {
            camera.setExposure(intervalometer.status.shutterPreset + diff, intervalometer.status.aperturePreset, intervalometer.status.isoPreset, function(err, ev) {
                if(ev != null) {
                    intervalometer.status.cameraEv = ev;
                } 
                intervalometer.status.cameraSettings = camera.ptp.settings;
                intervalometer.status.evDiff = intervalometer.status.cameraEv - intervalometer.status.rampEv;
                console.log("EXP: program (preset):", "capture", " (took ", (new Date() / 1000 - expSetupStartTime), "seconds from setup start");
                busyExposure = false;
                setTimeout(function(){
                    cb && cb(err);
                }, 100)
            });
        } else {
            if(intervalometer.status.hdrSet && intervalometer.status.hdrSet.length > 0) {
                var options = getEvOptions();
                options.doNotSet = true;
                camera.setEv(intervalometer.status.rampEv + intervalometer.status.hdrMax, options, function(err, res) {
                    camera.setExposure(res.shutter.ev + diff - intervalometer.status.hdrMax, res.aperture.ev, res.iso.ev, function(err, ev) {
                        if(ev != null) {
                            intervalometer.status.cameraEv = ev;
                        } 
                        intervalometer.status.cameraSettings = camera.ptp.settings;
                        intervalometer.status.evDiff = intervalometer.status.cameraEv - intervalometer.status.rampEv;
                        console.log("EXP: program (preset):", "capture", " (took ", (new Date() / 1000 - expSetupStartTime), "seconds from setup start");
                        busyExposure = false;
                        setTimeout(function(){
                            cb && cb(err);
                        }, 100)
                    });
                });
            } else {
                camera.setEv(intervalometer.status.rampEv + diff, getEvOptions(), function(err, res) {
                    if(res.ev != null) {
                        intervalometer.status.cameraEv = res.ev;
                    } 
                    intervalometer.status.cameraSettings = camera.ptp.settings;
                    intervalometer.status.evDiff = intervalometer.status.cameraEv - intervalometer.status.rampEv;
                    console.log("EXP: program:", "capture", " (took ", (new Date() / 1000 - expSetupStartTime), "seconds from setup start");
                    busyExposure = false;
                    setTimeout(function(){
                        cb && cb(err);
                    }, 100)
                });
            }
        }
    });
}

function planHdr(hdrCount, hdrStops) {
    if(!hdrStops || hdrStops < 1/3) hdrStops = 1/3;
    if(!hdrCount || hdrCount < 1) hdrCount = 1;
    var totalHdr = Math.floor(hdrCount) - 1;
    var overHdr = Math.floor(totalHdr / 2);
    var underHdr = totalHdr - overHdr;

    var overSet = [];
    var underSet = [];

    for(var i = 0; i < overHdr; i++) {
        overSet.push(hdrStops * (i + 1));                        
    }
    for(var i = 0; i < underHdr; i++) {
        underSet.push(hdrStops * -(i + 1));                        
    }

    intervalometer.status.hdrIndex = 0;
    intervalometer.status.hdrSet = [];
    intervalometer.status.hdrMax = overHdr;
    
    while(overSet.length || underSet.length) {
        if(overSet.length) intervalometer.status.hdrSet.push(overSet.shift());
        if(underSet.length) intervalometer.status.hdrSet.push(underSet.shift());
    }
    console.log("planHdr:", intervalometer.status.hdrSet)
}

function checkCurrentPlan(restart) {
    if(intervalometer.currentProgram.exposurePlans && intervalometer.currentProgram.exposurePlans.length > 0) {
        var planIndex = null;                        
        var now = (new Date()).getTime();
        for(var i = 0; i < intervalometer.currentProgram.exposurePlans.length; i++) {
            //console.log("PLAN: now", now, "plan.start", new Date(intervalometer.currentProgram.exposurePlans[i].start).getTime());
            if((new Date(intervalometer.currentProgram.exposurePlans[i].start)).getTime() < now) {
                planIndex = i;
            } else {
                break;
            }
        }
        //console.log("PLAN: checking plans...", planIndex);
        if(intervalometer.status.currentPlanIndex !== planIndex) {
            intervalometer.status.currentPlanIndex = planIndex;
            intervalometer.status.framesRemaining = Infinity;
            var plan = intervalometer.currentProgram.exposurePlans[planIndex];
            console.log("PLAN: switching to ", plan.name);
            /*
                each plan has the following:
                .mode = 'preset', 'lock', 'auto'
                .ev = EV (if .mode == 'fixed')
                .hdrCount  = 0, 1 = none, 2+ = hdr
                .hdrStops = stops between each hdr photo
                .intervalMode = 'fixed', 'auto'
                .interval
                .dayInterval
                .nightIntervl
            */
            if(plan.mode == 'auto') {
                intervalometer.status.rampMode = 'auto';
                if(intervalometer.status.rampEv == null) intervalometer.status.rampEv = camera.lists.getEvFromSettings(camera.ptp.settings); 
            }
            if(plan.mode == 'lock') {
                if(intervalometer.status.rampEv == null) intervalometer.status.rampEv = camera.lists.getEvFromSettings(camera.ptp.settings); 
                intervalometer.status.rampMode = 'fixed';
            }
            if(plan.mode == 'preset') {
                intervalometer.status.rampMode = 'preset';
                intervalometer.status.shutterPreset = plan.shutter;
                intervalometer.status.aperturePreset = plan.aperture;
                intervalometer.status.isoPreset = plan.iso;
                intervalometer.status.rampEv = camera.lists.getEv(intervalometer.status.shutterPreset, intervalometer.status.aperturePreset, intervalometer.status.isoPreset);
            }
            if(intervalometer.currentProgram.intervalMode != 'aux') {
                intervalometer.currentProgram.intervalMode = plan.intervalMode;
                if(plan.intervalMode == 'fixed') {
                    intervalometer.currentProgram.interval = plan.interval;
                }
                else if(plan.intervalMode == 'auto') {
                    intervalometer.currentProgram.dayInterval = plan.dayInterval;
                    intervalometer.currentProgram.nightInterval = plan.nightInterval;
                }
            }
            planHdr(plan.hdrCount, plan.hdrStops);

            if(restart) {
                if (timerHandle) clearTimeout(timerHandle);
                setupExposure(runPhoto);
            }
            return true;
        }
    }
    return false;
}

function checkDay(m) {
    switch(m.day()) {
        case 0:
            return intervalometer.currentProgram.schedSunday;
        case 1:
            return intervalometer.currentProgram.schedMonday;
        case 2:
            return intervalometer.currentProgram.schedTuesday;
        case 3:
            return intervalometer.currentProgram.schedWednesday;
        case 4:
            return intervalometer.currentProgram.schedThursday;
        case 5:
            return intervalometer.currentProgram.schedFriday;
        case 6:
            return intervalometer.currentProgram.schedSaturday;
    }
}

function checkTime(m) {
    if(intervalometer.currentProgram.schedStart == intervalometer.currentProgram.schedStop) return true;

    if(!intervalometer.currentProgram.schedStart || typeof intervalometer.currentProgram.schedStart != "string") return true;
    if(!intervalometer.currentProgram.schedStop || typeof intervalometer.currentProgram.schedStop != "string") return true;

    var parts = intervalometer.currentProgram.schedStart.split(':');
    if(parts.length < 2) return true;
    var startHour = parseInt(parts[0]);
    var startMinute = parseInt(parts[1]);
    parts = intervalometer.currentProgram.schedStop.split(':');
    if(parts.length < 2) return true;
    var stopHour = parseInt(parts[0]);
    var stopMinute = parseInt(parts[1]);

    var mNow = m.hour() * 60 + m.minute();
    var mStart = startHour * 60 + startMinute;
    var mStop = stopHour * 60 + stopMinute;

    console.log("Intervalometer: mNow", mNow, "mStart", mStart, "mStop", mStop);

    intervalometer.status.minutesUntilStart = Math.round(mStart - mNow);
    if(mStart < mStop) { // day only
        return (mNow >= mStart && mNow < mStop);
    } else { // night only
        return (mNow >= mStart || mNow < mStop);
    }
}

var scheduleHandle = null;
function waitForSchedule() {
    scheduleHandle = setTimeout(function(){
        if(scheduled(true)) {
            if(intervalometer.status.running) {
                console.log("Intervalometer: scheduled start beginning...");
                if(intervalometer.status.frames > 0) {
                    intervalometer.cancel('scheduled', function(){ // each day a new clip is generated
                        setTimeout(function(){
                            console.log("Intervalometer: running scheduled start...");
                            intervalometer.run(intervalometer.currentProgram, null, intervalometer.status.timeOffsetSeconds, intervalometer.status.exposureReferenceEv);
                        });
                    });
                } else {
                    setTimeout(function(){
                        console.log("Intervalometer: running scheduled start...");
                        intervalometer.run(intervalometer.currentProgram, null, intervalometer.status.timeOffsetSeconds, intervalometer.status.exposureReferenceEv || 0);
                    });
                }
             } else {
                console.log("Intervalometer: scheduled start canceled because time-lapse is no longer running.");
             }
        } else {
            waitForSchedule();
        }
    }, 60000);
}

function scheduled(noResume) {
    if(intervalometer.currentProgram && intervalometer.currentProgram.scheduled) {
        var m = moment().add(intervalometer.status.timeOffsetSeconds, 'seconds');
        if(checkDay(m)) {
            if(checkTime(m)) {
                console.trace("Intervalometer: scheduled start ready");
                return true;
            } else {
                if(intervalometer.status.minutesUntilStart < 0) {
                    intervalometer.status.message = "done for today...";
                } else {
                    var minutes = intervalometer.status.minutesUntilStart % 60;
                    var hours = (intervalometer.status.minutesUntilStart - minutes) / 60;
                    if(hours > 0) {
                        intervalometer.status.message = "starting in " + hours + "hour" + (hours > 1 ? "s, ":", ") + minutes + " minute" + (minutes > 1 ? "s...":"...");
                    } else {
                        intervalometer.status.message = "starting in " + minutes + " minute" + (minutes > 1 ? "s...":"...");
                    }
                }
                intervalometer.emit("intervalometer.status", intervalometer.status);

                if(!noResume) waitForSchedule();
                return false;
            }
        } else {
            intervalometer.status.message = "not scheduled today, waiting...";
            intervalometer.emit("intervalometer.status", intervalometer.status);
            if(!noResume) waitForSchedule();
            return false;
        }
    } else {
        return true;
    }
}

var busyPhoto = false;
var pendingPhoto = false;
var retryHandle = null;
var referencePhotoRes = null;
var retryCounter = 0;

function runPhoto(isRetry) {
    if(!intervalometer.status.running) {
        busyPhoto = false;
        intervalometer.status.stopping = false;
        return;
    }
    
    if((busyPhoto || busyExposure) && pendingPhoto && !isRetry) return; // drop frame if backed up

    if ((busyPhoto || busyExposure) && intervalometer.currentProgram.rampMode != "fixed") {
        if(retryCounter == 0) {
            if(busyPhoto) console.log("P");
            if(busyExposure) console.log("E");
        }
        retryCounter++;
        if(retryCounter >= 20) retryCounter = 0;
        if (intervalometer.status.running) retryHandle = setTimeout(function(){runPhoto(true);}, 100);
        return;
    }
    if(!intervalometer.status.running) return;
    if(intervalometer.status.first) {
        intervalometer.status.first = false;
        return setTimeout(function() {
            setupExposure(runPhoto);
        });
    }
    if(busyPhoto || busyExposure) pendingPhoto = true; else pendingPhoto = false;
    busyPhoto = true;
    if (camera.ptp.connected) {
        //console.trace("Starting Photo...");
        if(intervalometer.status.useLiveview && !camera.ptp.lvOn) camera.ptp.liveview();
        if(!(intervalometer.status.hdrSet && intervalometer.status.hdrSet.length > 0) || intervalometer.status.hdrIndex == 1) {
            intervalometer.status.captureStartTime = new Date() / 1000;
        }
        intervalometer.emit("intervalometer.status", intervalometer.status);
        var captureOptions = {
            thumbnail: true,
            index: intervalometer.status.frames,
            noDownload: (intervalometer.status.hdrSet && intervalometer.status.hdrSet.length > 0 && intervalometer.status.hdrIndex > 0) // only fetch thumbnail for the reference photo in the HDR set
                //saveTiff: "/mnt/sd/test" + intervalometer.status.frames + ".tiff",
                //saveRaw: "/mnt/sd/test" + intervalometer.status.frames + ".cr2",
        }
        if (intervalometer.currentProgram.destination == 'sd' && camera.ptp.sdPresent && camera.ptp.sdMounted) {
            console.log("CAPT: Saving timelapse to SD card");
            captureOptions.thumbnail = false;
            var framesPadded = intervalometer.status.frames.toString();
            while (framesPadded.length < 4) framesPadded = '0' + framesPadded;
            captureOptions.saveRaw = intervalometer.status.mediaFolder + "/img-" + framesPadded;
            camera.ptp.saveToCameraCard(false);
        } else {
            camera.ptp.saveToCameraCard(true);
        }

        if (intervalometer.currentProgram.rampMode == "fixed") {
            intervalometer.status.intervalMs = intervalometer.currentProgram.interval * 1000;
            if (intervalometer.status.running && scheduled()) timerHandle = setTimeout(runPhoto, intervalometer.status.intervalMs);
            setTimeout(motionSyncPulse, camera.lists.getSecondsFromEv(camera.ptp.settings.details.shutter.ev) * 1000 + 1500);
            captureOptions.calculateEv = false;
            intervalometer.status.lastPhotoTime = new Date() / 1000 - intervalometer.status.startTime;
            camera.ptp.capture(captureOptions, function(err, photoRes) {
                if (!err && photoRes) {
                    intervalometer.status.path = photoRes.file;
                    if(photoRes.cameraCount > 1) {
                        for(var i = 0; i < photoRes.cameraResults.length; i++) {
                            console.log("photoRes.cameraResults[" + i + "]:", photoRes.cameraResults[i].file, photoRes.cameraResults[i].cameraIndex, photoRes.cameraResults[i].thumbnailPath);
                            db.setTimelapseFrame(intervalometer.status.id, 0, getDetails(photoRes.cameraResults[i].file), photoRes.cameraResults[i].cameraIndex, photoRes.cameraResults[i].thumbnailPath);
                        }
                    } else {
                        db.setTimelapseFrame(intervalometer.status.id, 0, getDetails(), 1, photoRes.thumbnailPath);
                    }
                    intervalometer.status.message = "running";
                    if (intervalometer.status.framesRemaining > 0) intervalometer.status.framesRemaining--;
                    intervalometer.status.frames++;
                    //writeFile();
                    intervalometer.emit("intervalometer.status", intervalometer.status);
                    console.log("TL: program intervalometer.status:", intervalometer.status);
                } else {
                    intervalometer.emit('error', "An error occurred during capture.  This could mean that the camera body is not supported or possibly an issue with the cable disconnecting.\nThe time-lapse will attempt to continue anyway.\nSystem message: ", err);
                }
                if ((intervalometer.status.framesRemaining < 1 && !intervalometer.currentProgram.scheduled) || intervalometer.status.running == false || intervalometer.status.stopping == true) {
                    clearTimeout(timerHandle);
                    intervalometer.status.message = "done";
                    intervalometer.status.framesRemaining = 0;
                    intervalometer.cancel('done');
                }
                dynamicChangeUpdate();
                processKeyframes(false, function() {
                    busyPhoto = false;
                });
            });
        } else {
            if (intervalometer.status.rampEv === null) {
                intervalometer.status.cameraEv = camera.lists.getEvFromSettings(camera.ptp.settings); 
                intervalometer.status.rampEv = intervalometer.status.cameraEv;
            }
            captureOptions.exposureCompensation = intervalometer.status.evDiff || 0;

            if(intervalometer.status.hdrSet && intervalometer.status.hdrSet.length > 0) {
                if(intervalometer.status.hdrIndex == 0) {
                    captureOptions.calculateEv = true;
                } else {
                    captureOptions.calculateEv = false;
                }
            } else {
                captureOptions.calculateEv = true;
            }

            if(intervalometer.currentProgram.intervalMode == 'aux') {
                if(intervalometer.status.intervalStartTime) intervalometer.status.intervalMs = ((new Date() / 1000) - intervalometer.status.intervalStartTime) * 1000;
                intervalometer.status.intervalStartTime = new Date() / 1000;
            } else if(!(intervalometer.status.hdrSet && intervalometer.status.hdrSet.length > 0) || intervalometer.status.hdrIndex == 1) { // only start interval timer at first HDR exposure
                intervalometer.status.intervalMs = calculateIntervalMs(intervalometer.currentProgram.interval, intervalometer.status.rampEv);                
                console.log("TL: Setting timer for interval at ", intervalometer.status.intervalMs);
                if (timerHandle) clearTimeout(timerHandle);
                var runIntervalHdrCheck = function() {
                    if(!(intervalometer.status.hdrSet && intervalometer.status.hdrSet.length > 0) || intervalometer.status.hdrIndex == 1) {
                        runPhoto();
                    } else {
                        console.log("HDR: delaying interval for HDR set");
                        if (intervalometer.status.running) timerHandle = setTimeout(runIntervalHdrCheck, 100);
                    }
                }
                if (intervalometer.status.running && scheduled()) timerHandle = setTimeout(runIntervalHdrCheck, intervalometer.status.intervalMs);
            } 

            intervalometer.emit("intervalometer.status", intervalometer.status);
            var shutterEv;
            if(camera.ptp.settings.details && camera.ptp.settings.details.shutter) shutterEv = camera.ptp.settings.details.shutter.ev; else shutterEv = 0;

            if(intervalometer.status.hdrSet && intervalometer.status.hdrSet.length > 0 && intervalometer.status.hdrIndex > 0 && intervalometer.status.rampEv + intervalometer.status.hdrMax >= camera.maxEv(camera.ptp.settings, getEvOptions())) {
                intervalometer.status.hdrIndex = 0; // disable HDR is the exposure is at the maximum
            }
            if(intervalometer.status.hdrSet && intervalometer.status.hdrSet.length > 0 && intervalometer.status.hdrIndex > 0) {
                if(checkCurrentPlan(true)) {
                    busyPhoto = false;
                    return;
                }
                var nextHDRms = 100 + camera.lists.getSecondsFromEv(shutterEv) * 1000;
                console.log("running next in HDR sequence", intervalometer.status.hdrIndex, nextHDRms);
                camera.ptp.capture(captureOptions);
                setTimeout(function(){
                    setupExposure(function(){
                        busyPhoto = false;
                        runPhoto()
                    });
                }, nextHDRms);
                return;
            } else {
                var msDelayPulse = camera.lists.getSecondsFromEv(shutterEv) * 1000 + 1500;
                setTimeout(motionSyncPulse, msDelayPulse);
                intervalometer.status.lastPhotoTime = new Date() / 1000 - intervalometer.status.startTime;
            }
            camera.ptp.capture(captureOptions, function(err, photoRes) {
                if (!err && photoRes) {
                    if(!intervalometer.status.hdrIndex) referencePhotoRes = photoRes;

                    var bufferTime = (new Date() / 1000) - intervalometer.status.captureStartTime - camera.lists.getSecondsFromEv(camera.ptp.settings.details.shutter.ev);
                    if(!intervalometer.status.bufferSeconds) {
                        intervalometer.status.bufferSeconds = bufferTime;
                    } else if(bufferTime != intervalometer.status.bufferSeconds) {
                        intervalometer.status.bufferSeconds = (intervalometer.status.bufferSeconds + bufferTime) / 2;
                    }
                    intervalometer.status.path = referencePhotoRes.file;
                    if(referencePhotoRes.cameraCount > 1) {
                        for(var i = 0; i < referencePhotoRes.cameraResults.length; i++) {
                            db.setTimelapseFrame(intervalometer.status.id, intervalometer.status.evDiff, getDetails(referencePhotoRes.cameraResults[i].file), referencePhotoRes.cameraResults[i].cameraIndex, referencePhotoRes.cameraResults[i].thumbnailPath);
                        }
                    } else {
                        db.setTimelapseFrame(intervalometer.status.id, intervalometer.status.evDiff, getDetails(), 1, referencePhotoRes.thumbnailPath);
                    }
                    intervalometer.autoSettings.paddingTimeMs = intervalometer.status.bufferSeconds * 1000 + 250; // add a quarter second for setting exposure

                    if(intervalometer.status.rampMode == "auto") {
                        intervalometer.status.rampEv = exp.calculate(intervalometer.currentProgram.rampAlgorithm, intervalometer.currentProgram.lrtDirection, intervalometer.status.rampEv, referencePhotoRes.ev, referencePhotoRes.histogram, camera.minEv(camera.ptp.settings, getEvOptions()), camera.maxEv(camera.ptp.settings, getEvOptions()));
                        intervalometer.status.rampRate = exp.status.rate;
                    } else if(intervalometer.status.rampMode == "fixed") {
                        intervalometer.status.rampRate = 0;
                    }

                    intervalometer.status.path = referencePhotoRes.file;
                    intervalometer.status.message = "running";                    
                    if(!checkCurrentPlan(true)) setupExposure();

                    if (intervalometer.status.framesRemaining > 0) intervalometer.status.framesRemaining--;
                    intervalometer.status.frames++;
                    writeFile();
                    if(intervalometer.currentProgram.intervalMode == 'aux') intervalometer.status.message = "waiting for AUX2...";
                    intervalometer.emit("intervalometer.status", intervalometer.status);
                    console.log("TL: program intervalometer.status:", intervalometer.status);
                    if(intervalometer.status.frames == 1 && intervalometer.status.exposureReferenceEv == null) {
                        brightWarning(photoRes.ev);
                    }

                } else {
                    if(!err) err = "unknown";
                    error("An error occurred during capture.  This could mean that the camera body is not supported or possibly an issue with the cable disconnecting.\nThe time-lapse will attempt to continue anyway.\nSystem message: " + err);
                    console.log("TL: error:", err);
                }
                if ((intervalometer.currentProgram.intervalMode == "fixed" && intervalometer.status.framesRemaining < 1) || intervalometer.status.running == false || intervalometer.status.stopping == true) {
                    clearTimeout(timerHandle);
                    intervalometer.status.stopping = false;
                    intervalometer.status.message = "done";
                    intervalometer.status.framesRemaining = 0;
                    intervalometer.cancel('done');
                }
                processKeyframes(false, function() {
                    busyPhoto = false;
                });
            });
        }
    }
}

function brightWarning(ev) {
    if(ev > 2.5) {
        error("WARNING: the exposure is too high for reliable ramping. It will attempt to continue, but it's strongly recommended to stop the time-lapse, descrease the exposure to expose for the highlights and then start again.");
    }
}

function error(msg, callback) {
    setTimeout(function(){
        intervalometer.emit("error", msg);
    }, 50);
    setTimeout(function(){
        return callback && callback(msg);
    }, 100);
}

camera.ptp.on('saveError', function(msg) {
    if (intervalometer.status.running) {
        intervalometer.cancel('err');
        error("Failed to save RAW image to SD card!\nTime-lapse has been stopped.\nPlease verify that the camera is set to RAW (not RAW+JPEG) and that the SD card is formatted and fully inserted into the VIEW.\nSystem message: " + msg);
    }
});
camera.ptp.on('saveErrorCardFull', function(msg) {
    if (intervalometer.status.running) {
        intervalometer.cancel('err');
        error("SD card full! Unabled to save RAW images.\nThe time-lapse has been stopped.");
    }
});

function autoSetExposure(offset, callback) {
    if(!offset) offset = 0;
    function captureTestEv() {
        camera.ptp.capture({mode:'test'}, function(err, res) {
            if(!err && res && res.ev != null) {
                intervalometer.status.message = "checking/setting exposure...";
                intervalometer.emit("intervalometer.status", intervalometer.status);
                var evChange = res.ev - offset;
                camera.ptp.getSettings(function() {
                    var currentEv = camera.lists.getEvFromSettings(camera.ptp.settings);
                    camera.setEv(currentEv + evChange, getEvOptions(), function(err, res) {
                        if(Math.abs(evChange) < 2) {
                            callback && callback(null);
                        } else {
                            captureTestEv();
                        }
                    })
                });
            } else {
                callback && callback(err||"invalid exposure");
            }
        });
    }
    captureTestEv();
}

intervalometer.validate = function(program) {
    var results = {
        errors: []
    };
    if(program.frames === null) program.frames = Infinity;
    
    if (parseInt(program.delay) < 1) program.delay = 1;
    if(program.scheduled) program.delay = 0;
    if(program.rampMode == 'fixed' && !program.scheduled) {
        if (parseInt(program.frames) < 1) results.errors.push({param:'frames', reason: 'frame count not set'});
    } else {
        if(program.intervalMode == 'fixed' || program.rampMode == 'fixed') {
            if (parseInt(program.interval) < 1) results.errors.push({param:'interval', reason: 'interval not set or too short'});
        } else {
            if (parseInt(program.dayInterval) < 2) results.errors.push({param:'dayInterval', reason: 'dayInterval must be at least 2 seconds'});
            if (parseInt(program.nightInterval) < program.dayInterval) results.errors.push({param:'nightInterval', reason: 'nightInterval shorter than dayInterval'});
        }        
    }

    if(!camera.ptp.supports.destination && (program.destination != 'sd' || !camera.ptp.sdPresent)) {
        console.log("VAL: Error: SD card required");
        results.errors.push({param:false, reason: "SD card required. The connected camera (" + camera.ptp.model + ") does not support saving images to the camera.  Please insert an SD card into the VIEW and set the Destination to 'SD Card' so images can be saved to the card."});
    }

    var settingsDetails = camera.ptp.settings.details;

    if(!settingsDetails.iso || settingsDetails.iso.ev == null) {
        console.log("VAL: Error: invalid ISO setting", settingsDetails.iso);
        results.errors.push({param:false, reason: "invalid ISO setting on camera."});
    }

    if(!settingsDetails.shutter || settingsDetails.shutter.ev == null) {
        console.log("VAL: Error: invalid shutter setting", settingsDetails.shutter);
        results.errors.push({param:false, reason: "invalid shutter setting on camera."});
    }

    if(camera.ptp.settings && camera.ptp.settings.format != 'RAW' && program.destination == 'sd' && camera.ptp.sdPresent) {
        if(camera.ptp.model == 'SonyWifi') {
            console.log("VAL: Error: SonyWifi doesn't support Destination='SD'");
            results.errors.push({param:false, reason: "Destination must be set to 'Camera' when connected to Sony cameras via Wifi"});
        } else {
            console.log("VAL: Error: camera not set to save in RAW");
            results.errors.push({param:false, reason: "camera must be set to save in RAW. The VIEW expects RAW files when processing images to the SD card (RAW+JPEG does not work)"});
        }
    }

    if(!program.axes) program.axes = {};
    if(!program.axes.focus) program.axes.focus = {type:'disabled'}; // make focus adjustment available

    console.log("VAL: validating program:", results);

    return results;
}
intervalometer.cancel = function(reason, callback) {
    if(!reason) reason = 'stopped';
    if(intervalometer.internal.polarTrackIntervalHandle) {
        clearInterval(intervalometer.internal.polarTrackIntervalHandle);
        intervalometer.internal.polarTrackIntervalHandle = null;
    }
    if(intervalometer.internal.polarMotorBacklash) {
        setTimeout(function(){
            console.log("Intervalometer: polar: resetting backlash to", intervalometer.internal.polarMotorBacklash.backlash);
            motion.setBacklash(intervalometer.internal.polarMotorBacklash.driver, intervalometer.internal.polarMotorBacklash.motor, intervalometer.internal.polarMotorBacklash.backlash, function(){
                intervalometer.internal.polarMotorBacklash = null;
            });
        }, 2000);
    }
    if (intervalometer.status.running) {
        clearTimeout(timerHandle);
        clearTimeout(delayHandle);
        intervalometer.status.stopping = true;
        if(reason == 'err') intervalometer.status.message = "stopped due to error";
        else if(reason == 'done') intervalometer.status.message = "time-lapse complete";
        else if(reason == 'schedule') intervalometer.status.message = "time-lapse stopped on schedule";
        else intervalometer.status.message = "time-lapse canceled";
        intervalometer.status.framesRemaining = 0;
        intervalometer.emit("intervalometer.status", intervalometer.status);
        camera.ptp.completeWrites(function() {
            busyPhoto = false;
            intervalometer.status.running = false;
            intervalometer.status.stopping = false;
            intervalometer.timelapseFolder = false;
            camera.ptp.saveThumbnails(intervalometer.timelapseFolder);
            camera.ptp.unmountSd();
            intervalometer.emit("intervalometer.status", intervalometer.status);
            console.log("==========> END TIMELAPSE", intervalometer.status.tlName);
            callback && callback();
        });
    }    
}

intervalometer.resume = function() {
    camera.ptp.cancelCallbacks();
    busyPhoto = false;
    busyExposure = false;
    clearTimeout(timerHandle);
    clearTimeout(delayHandle);
    clearTimeout(retryHandle);
    clearTimeout(scheduleHandle);
    var ms = intervalometer.status.intervalMs - ((new Date() / 1000) - (intervalometer.status.startTime + intervalometer.status.lastPhotoTime)) * 1000;
    if(ms < 0) ms = 0;
    if(scheduled() && intervalometer.status.running) setTimeout(runPhoto, ms);
}

function getReferenceExposure(callback) {
    intervalometer.status.message = "capturing reference image";
    intervalometer.emit("intervalometer.status", intervalometer.status);
    camera.ptp.capture({mode:'test'}, function(err, res){
        console.log("reference exposure result:", err, res);
        if(!err && res && res.ev != null) {
            callback && callback(null, res.ev);
        } else {
            callback && callback("Failed to determine reference exposure for delayed start", null);
        }
    });
}

intervalometer.run = function(program, date, timeOffsetSeconds, autoExposureTarget, callback) {
    if (intervalometer.status.running && autoExposureTarget == null) return;
    intervalometer.status.stopping = false;
    console.log("loading time-lapse program:", program);
    db.set('intervalometer.currentProgram', program);

    if(date != null) { // sync time with phone app local time
        var mD = moment(date);
        var mN = moment();
        console.log("Intervalometer: App time:", mD.format(), "VIEW time:", mN.format());
        var daysDiff = mD.day() - mN.day();
        var hoursDiff = mD.hour() - mN.hour();
        var minutesDiff = mD.minute() - mN.minute();
        var secondsDiff = mD.seconds() - mN.seconds();
        intervalometer.status.timeOffsetSeconds = daysDiff * 86400 + hoursDiff * 3600 + minutesDiff * 60 + secondsDiff;
        console.log("Intervalometer: date difference (seconds):", intervalometer.status.timeOffsetSeconds);
    } else if(timeOffsetSeconds != null) { // cached timeOffsetSeconds from restart
        intervalometer.status.timeOffsetSeconds = parseInt(timeOffsetSeconds);
    }
    if(!intervalometer.status.timeOffsetSeconds) intervalometer.status.timeOffsetSeconds = 0;
    if(autoExposureTarget != null && program.rampMode == 'auto') {
        intervalometer.status.exposureReferenceEv = autoExposureTarget;
    } else {
        intervalometer.status.exposureReferenceEv = null;
    }

    if(program.manualAperture != null) camera.fixedApertureEv = program.manualAperture;

    if (camera.ptp.connected) {
        camera.ptp.getSettings(function(){
            var validationResults = intervalometer.validate(program);
            if (validationResults.errors.length == 0) {
                db.getTimelapseIndex(function(err, tlIndex){

                    if (!tlIndex) {
                        tlIndex = 0;
                    }
                    if(tlIndex < 99) tlIndex += 99;

                    var list = fs.readdirSync(TLROOT);
                    //console.log("Intervalometer: time-lapse list:", list);
                    var name;
                    do {
                        tlIndex++;
                        name = "tl-" + tlIndex;
                    } while(list.indexOf(name) !== -1);

                    intervalometer.status.tlName = "tl-" + tlIndex;
                    console.log("==========> TIMELAPSE START", intervalometer.status.tlName);
                    intervalometer.timelapseFolder = TLROOT + "/" + intervalometer.status.tlName;
                    fs.mkdirSync(intervalometer.timelapseFolder);
                    camera.ptp.saveThumbnails(intervalometer.timelapseFolder);
                    intervalometer.status.timelapseFolder = intervalometer.timelapseFolder;
                    fileInit();

                    busyPhoto = false;
                    intervalometer.currentProgram = program;
                    intervalometer.status.intervalMs = program.interval * 1000;
                    intervalometer.status.message = "starting";
                    intervalometer.status.frames = 0;
                    intervalometer.status.first = program.rampMode == 'fixed' ? false : true; // triggers setup exposure before first capture unless fixed mode
                    intervalometer.status.rampMode = program.rampMode == 'fixed' ? 'fixed' : 'auto';
                    intervalometer.status.framesRemaining = (program.intervalMode == "auto" && intervalometer.status.rampMode == "auto") ? Infinity : program.frames;
                    intervalometer.status.startTime = new Date() / 1000;
                    intervalometer.status.rampEv = null;
                    intervalometer.status.bufferSeconds = 0;
                    intervalometer.status.cameraSettings = camera.ptp.settings;
                    intervalometer.status.hdrSet = [];
                    intervalometer.status.hdrIndex = 0;
                    intervalometer.status.currentPlanIndex = null;
                    intervalometer.status.panDiffNew = 0;
                    intervalometer.status.tiltDiffNew = 0;
                    intervalometer.status.focusDiffNew = 0;
                    intervalometer.status.panDiff = 0;
                    intervalometer.status.tiltDiff = 0;
                    intervalometer.status.trackingPanEnabled = false;
                    intervalometer.status.trackingTiltEnabled = false;
                    intervalometer.status.dynamicChange = {};
                    intervalometer.status.trackingTilt = 0;
                    intervalometer.status.trackingPan = 0;

                    intervalometer.internal.polarStart = null;
                    intervalometer.internal.polarTrackIntervalHandle = null;


                    if(program.hdrCount && program.hdrCount > 1 && program.hdrStops) {
                        planHdr(program.hdrCount, program.hdrStops);
                    }

                    if(intervalometer.status.rampMode != 'fixed') {
                        checkCurrentPlan();
                    }

                    if(intervalometer.currentProgram.coords) {
                        intervalometer.status.latitude = intervalometer.currentProgram.coords.lat;
                        intervalometer.status.longitude = intervalometer.currentProgram.coords.lon;
                        intervalometer.status.altitude = intervalometer.currentProgram.coords.alt;
            
                        var sunmoon = meeus.sunmoon(new Date(), intervalometer.currentProgram.coords.lat, intervalometer.currentProgram.coords.lon, intervalometer.currentProgram.coords.alt);
                        intervalometer.status.sunPos = {
                            azimuth: sunmoon.sunpos.az,
                            altitude: sunmoon.sunpos.alt,
                        }
                        intervalometer.status.moonPos = {
                            azimuth: sunmoon.moonpos.az,
                            altitude: sunmoon.moonpos.alt,
                        }
                    }
                    exp.init(camera.minEv(camera.ptp.settings, getEvOptions()), camera.maxEv(camera.ptp.settings, getEvOptions()), program.nightCompensation, program.highlightProtection);
                    intervalometer.status.running = true;
                    intervalometer.emit("intervalometer.status", intervalometer.status);
                    console.log("program:", "starting", program);

                    //function start() {
                    //    if(camera.ptp.settings.autofocus && camera.ptp.settings.autofocus == "on") {
                    //        console.log("Intervalometer: disabling autofocus");
                    //        camera.ptp.set("autofocus", "off", checkFocus2);
                    //    } else {
                    //        checkFocus2();
                    //    }
                    //}

                    function start() {
                        intervalometer.emit("intervalometer.currentProgram", intervalometer.currentProgram);
                        intervalometer.status.useLiveview = false;
                        if(camera.ptp.model.match(/nikon/i) && ((camera.ptp.settings.afmode && camera.ptp.settings.afmode != "manual") || (camera.ptp.settings.viewfinder && camera.ptp.settings.viewfinder != "off"))) {
                            console.log("Intervalometer: using Nikon liveview for capture");
                            camera.ptp.liveview(start2);
                            intervalometer.status.useLiveview = true;
                            //camera.ptp.set("afmode", "manual", start2); // doesn't work because focusmode is read-only on Nikon
                        } else {
                            start2();
                        }
                    }

                    function start2() {
                        if(program.scheduled && autoExposureTarget != null) {
                            //if(scheduled(true)) {
                            //    autoSetExposure(intervalometer.status.exposureReferenceEv, function(err) {
                            //        start3();
                            //    });
                            //} else {
                                start3();
                            //}
                        } else {
                            if(camera.ptp.model.match(/nikon/i) && !camera.ptp.captureInitiated() && intervalometer.currentProgram.intervalMode == 'aux') {
                                camera.ptp.capture({mode:"test"}, start3);
                            } else {
                                start3();
                            }
                        }
                    }

                    function start3() {
                        var cameras = 1, primary = 1;
                        if(camera.ptp.synchronized) {
                            cameras = camera.ptp.count;
                            primary = camera.ptp.getPrimaryCameraIndex();
                        }
                        db.setTimelapse(intervalometer.status.tlName, program, cameras, primary, intervalometer.status, function(err, timelapseId) {
                            intervalometer.status.id = timelapseId;
                            processKeyframes(true, function() {
                                setTimeout(function() {
                                    busyPhoto = false;
                                    if(intervalometer.currentProgram.intervalMode != 'aux' || intervalometer.currentProgram.rampMode == 'fixed') {
                                        if(scheduled(true)) {
                                            var delayedMinutes = 0;
                                            function delayed() {
                                                if(program.delay > 5) {
                                                    var minutes = (Math.round(program.delay / 60) - delayedMinutes);
                                                    intervalometer.status.message = "delaying start for " + minutes.toString() + " minute" + (minutes > 1 ? 's' : '') + "...";
                                                    intervalometer.emit("intervalometer.status", intervalometer.status);
                                                }
                                                var delay = 60;
                                                if(program.delay - delayedMinutes * 60 < 60) delay = program.delay - delayedMinutes * 60;
                                                if(delay < 0 || program.scheduled) delay = 0;
                                                delayedMinutes++;
                                                delayHandle = setTimeout(function() {
                                                    if(delayedMinutes * 60 >= program.delay) {
                                                        if(intervalometer.status.exposureReferenceEv != null && (!program.scheduled || autoExposureTarget != null)) {
                                                            autoSetExposure(intervalometer.status.exposureReferenceEv, function(err) {
                                                                if(err) {
                                                                    error("Failed to verify reference exposure after delayed start, will try to continue anyway...");
                                                                    runPhoto();
                                                                } else {
                                                                    runPhoto();
                                                                }
                                                            });
                                                        } else {
                                                            runPhoto();
                                                        }
                                                    } else {
                                                        delayed();
                                                    }
                                                }, delay * 1000);

                                            }
                                            if((program.delay > 60 || (program.scheduled && intervalometer.status.exposureReferenceEv == null)) && program.rampMode == 'auto') {
                                                getReferenceExposure(function(err, ev) {
                                                    if(err) {
                                                        intervalometer.cancel('err');
                                                        error(err);
                                                    } else {
                                                        brightWarning(ev);
                                                        intervalometer.status.exposureReferenceEv = ev;
                                                        delayed();
                                                    }
                                                });
                                            } else {
                                                delayed();
                                            }
                                        } else {
                                            if(program.rampMode == 'auto') {
                                                if(intervalometer.status.exposureReferenceEv == null) {
                                                    getReferenceExposure(function(err, ev) {
                                                        if(err) {
                                                            intervalometer.cancel('err');
                                                            error(err);
                                                        } else {
                                                            brightWarning(ev);
                                                            intervalometer.status.exposureReferenceEv = ev;
                                                            if(scheduled()) runPhoto();
                                                        }
                                                    });
                                                } else {
                                                    autoSetExposure(intervalometer.status.exposureReferenceEv, function(err) {
                                                        if(err) {
                                                            error("Failed to verify reference exposure after delayed start, will try to continue anyway...");
                                                        }
                                                        if(scheduled()) runPhoto();
                                                    });
                                                }
                                            } else {
                                                if(scheduled()) runPhoto();
                                            }
                                        }
                                    }
                                    if(intervalometer.currentProgram.intervalMode == 'aux') {
                                        intervalometer.status.message = "waiting for AUX2...";
                                        intervalometer.emit("intervalometer.status", intervalometer.status);
                                    }
                                }, 3000);
                                callback && callback();
                            });
                        });
                    }

                    if (program.destination && program.destination == 'sd' && camera.ptp.sdPresent) {
                        camera.ptp.mountSd(function(mountErr) {
                            if(mountErr) {
                                console.log("Error mounting SD card");
                                intervalometer.cancel('err');
                                error("Error mounting SD card. \nVerify the SD card is formatted and fully inserted in the VIEW, then try starting the time-lapse again.\nMessage from system: " + mountErr, callback);
                            } else {
                                intervalometer.status.mediaFolder = "/media/" + intervalometer.status.tlName;
                                fs.mkdir(intervalometer.status.mediaFolder, function(folderErr) {
                                    if(folderErr) {
                                        console.log("Error creating folder", intervalometer.status.mediaFolder);
                                        intervalometer.cancel('err');
                                        error("Error creating folder on SD card: /" + intervalometer.status.tlName + ".\nVerify the card is present and not write-protected, then try starting the time-lapse again.\nAlternatively, set the Destination to Camera instead (if supported)", callback);
                                    } else {
                                        start();
                                    }
                                });
                            }
                        });
                    } else {
                        start();
                    }

                });
            } else {
                var errorList = "";
                var val = "";
                for(var i = 0; i < validationResults.errors.length; i++) {
                    if(program.hasOwnProperty([validationResults.errors[i].param])) {
                        val = " (" + program[validationResults.errors[i].param] + ")";
                    } else {
                        val = "";
                    }
                    errorList += "- " + validationResults.errors[i].reason + val + "\n";
                }
                intervalometer.cancel('err');
                error("Failed to start time-lapse: \n" + errorList + "Please correct and try again.", callback);
            }
        });
    } else {
        intervalometer.cancel('err');
        error("Camera not connected.  Please verify camera connection via USB and try again.", callback);
    }

}

intervalometer.moveTracking = function(axis, degrees, callback) {
    if(axis == 'Pan') {
        intervalometer.status.panDiffNew += degrees;
    }
    if(axis == 'Tilt') {
        intervalometer.status.tiltDiffNew += degrees;
    }
    callback && callback();
}

intervalometer.moveFocus = function(steps, callback) {
    intervalometer.status.focusDiffNew += steps;
    callback && callback();
}

intervalometer.addGpsData = function(gpsData, callback) {
    intervalometer.gpsData = gpsData;
    callback && callback();
}

function dynamicChangeUpdate() {
    if(intervalometer.status.dynamicChange) {
        var change = false;
        for(param in intervalometer.status.dynamicChange) {
            if(intervalometer.status.dynamicChange.hasOwnProperty(param) && intervalometer.status.dynamicChange[param]) {
                var item = intervalometer.status.dynamicChange[param];
                var newVal = interpolate.linear([{
                    x: item.startFrame,
                    y: item.startVal
                }, {
                    x: item.endFrame,
                    y: item.endVal
                }], intervalometer.status.frames);
                switch(param) {
                    case 'manualOffsetEv':
                        intervalometer.status.exposure.status.rampEv -= newVal - item.lastVal; // this makes for an immediate change without destabilizing the PID loop
                    case 'nightRefEv':
                    case 'dayRefEv':
                        intervalometer.status.exposure.status[param] += newVal - item.lastVal; // this allows the highlight protection to also change it without overwriting
                        break;
                    case 'rampEv':
                        intervalometer.status.rampEv = newVal;
                        break;
                    default:
                        intervalometer.currentProgram[param] = newVal;
                }
                item.lastVal = newVal;
                if(item.endFrame < intervalometer.status.frames) {
                    delete intervalometer.status.dynamicChange[param];
                }
                change = true;
            }
        }
        if(change) {
            intervalometer.emit("intervalometer.status", intervalometer.status);
            intervalometer.emit("intervalometer.currentProgram", intervalometer.currentProgram);
        }
    }
}

// changes 'parameter' to 'newValue' across 'frames'
// parameter can be: interval, dayInterval, nightInterval, nightCompensation, exposureOffset, mode (immediate)
intervalometer.dynamicChange = function(parameter, newValue, frames, callback) {
    var rampableChange = ['interval', 'dayInterval', 'nightInterval', 'nightCompensation'];
    var specialChange = ['rampMode', 'hdrCount', 'hdrStops', 'intervalMode', 'manualOffsetEv', 'dayRefEv', 'nightRefEv', 'rampEv', 'frames'];

    if(rampableChange.indexOf(parameter) !== -1) {
        frames = parseInt(frames);
        if(!frames || frames < 1) frames = 1;
        console.log("Intervalometer: LIVE UPDATE:", parameter, "set to", newValue, "across", frames, "frames");
        intervalometer.status.dynamicChange[parameter] = {
            startVal: parseFloat(intervalometer.currentProgram[parameter]),
            lastVal: parseFloat(intervalometer.currentProgram[parameter]),
            endVal: parseFloat(newValue),
            startFrame: intervalometer.status.frames,
            endFrame: intervalometer.status.frames + frames
        };
        callback && callback();
    } else if(specialChange.indexOf(parameter) !== -1) {
        switch(parameter) {
            case 'intervalMode':
                var newInt = intervalometer.status.intervalMs / 1000;
                if(newValue == 'auto' && intervalometer.currentProgram.intervalMode == 'fixed') {
                    intervalometer.currentProgram.dayInterval = newInt;
                    intervalometer.currentProgram.nightInterval = newInt;
                    intervalometer.currentProgram.intervalMode = 'auto';
                    intervalometer.emit("intervalometer.currentProgram", intervalometer.currentProgram);
                }
                if(newValue == 'fixed' && intervalometer.currentProgram.intervalMode == 'auto') {
                    intervalometer.currentProgram.frames = Math.ceil(intervalometer.status.frames / 100) * 100 + 500;
                    intervalometer.status.framesRemaining = intervalometer.currentProgram.frames - intervalometer.status.frames;
                    intervalometer.currentProgram.interval = newInt;
                    intervalometer.currentProgram.intervalMode = 'fixed';
                    intervalometer.emit("intervalometer.currentProgram", intervalometer.currentProgram);
                }
                intervalometer.emit("intervalometer.status", intervalometer.status);
                break

            case 'rampMode':
                if(newValue == 'auto' && intervalometer.status.rampMode != 'auto') { // restart ramping based on current exposure
                    intervalometer.status.rampMode = 'auto';
                    intervalometer.status.rampEv = camera.lists.getEvFromSettings(camera.ptp.settings);
                    exp.init(camera.minEv(camera.ptp.settings, getEvOptions()), camera.maxEv(camera.ptp.settings, getEvOptions()), intervalometer.currentProgram.nightCompensation, intervalometer.currentProgram.highlightProtection);
                    intervalometer.emit("intervalometer.status", intervalometer.status);
                }
                if(newValue == 'fixed') {
                    if(intervalometer.status.rampEv == null) intervalometer.status.rampEv = camera.lists.getEvFromSettings(camera.ptp.settings); 
                    intervalometer.status.rampMode = 'fixed';
                    intervalometer.emit("intervalometer.status", intervalometer.status);
                }
                break;

            case 'manualOffsetEv':
            case 'nightRefEv':
            case 'dayRefEv':
                frames = parseInt(frames);
                if(!frames || frames < 1) frames = 1;
                console.log("Intervalometer: LIVE UPDATE:", parameter, "set to", newValue, "across", frames, "frames");
                intervalometer.status.dynamicChange[parameter] = {
                    startVal: parseFloat(intervalometer.status.exposure.status[parameter]),
                    lastVal: parseFloat(intervalometer.status.exposure.status[parameter]),
                    endVal: parseFloat(newValue),
                    startFrame: intervalometer.status.frames,
                    endFrame: intervalometer.status.frames + frames
                };
                break;


            case 'rampEv':
                frames = parseInt(frames);
                if(!frames || frames < 1) frames = 1;
                console.log("Intervalometer: LIVE UPDATE:", parameter, "set to", newValue, "across", frames, "frames");
                intervalometer.status.dynamicChange[parameter] = {
                    startVal: intervalometer.status.rampEv,
                    lastVal: intervalometer.status.rampEv,
                    endVal: intervalometer.status.rampEv + parseFloat(newValue),
                    startFrame: intervalometer.status.frames,
                    endFrame: intervalometer.status.frames + frames
                };
                break;

            case 'frames':
                if(parseInt(newValue) > intervalometer.status.frames) {
                    intervalometer.currentProgram.frames = parseInt(newValue);
                    intervalometer.status.framesRemaining = intervalometer.currentProgram.frames - intervalometer.status.frames;
                    intervalometer.emit("intervalometer.currentProgram", intervalometer.currentProgram);
                    intervalometer.emit("intervalometer.status", intervalometer.status);
                } else {
                    callback && callback("frames must be greated than completed frames");
                }
                break;

            case 'hdrCount':
            case 'hdrStops':
                intervalometer.currentProgram[parameter] = newValue;
                planHdr(intervalometer.currentProgram.hdrCount, intervalometer.currentProgram.hdrStops);
                intervalometer.emit("intervalometer.currentProgram", intervalometer.currentProgram);
                break;
        }
        callback && callback();
    } else {
        callback && callback("invalid parameter");
    }
}

intervalometer.updateProgram = function(updates, callback) {
    console.log("Intervalometer: updateProgram:", updates);
    for(key in updates) {
        if(updates.hasOwnProperty(key)) {
            intervalometer.currentProgram[key] = updates[key];
        }
    }
    callback && callback();
}

module.exports = intervalometer;