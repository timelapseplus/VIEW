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

status = {
    running: false,
    frames: 0,
    framesRemaining: 0,
    rampRate: 0,
    intervalMs: 0,
    message: "",
    rampEv: null,
    autoSettings: {
        paddingTimeMs: 2000
    }
}
intervalometer.status = status;

var auxTrigger = new Button('input-aux2');

auxTrigger.on('press', function() {
    console.log("AUX2 trigger!");
    if (status.running && intervalometer.currentProgram.intervalMode == 'aux') timerHandle = setTimeout(runPhoto, 0);
});

auxTrigger.on('error', function(err) {
    console.log("AUX2 error: ", err);
});

function motionSyncPulse() {
    if (status.running && intervalometer.currentProgram.intervalMode != 'aux') {
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
    fs.writeFileSync(status.timelapseFolder + "/details.csv", "frame, error, target, setting, rate, interval, timestamp, file, p, i, d\n");
}

function writeFile() {
    fs.appendFileSync(status.timelapseFolder + "/details.csv", status.frames + ", " + status.evDiff + "," + exp.status.targetEv + "," + status.rampEv + "," + exp.status.rate + "," + (status.intervalMs / 1000) + "," + status.lastPhotoTime + "," + status.path + "," + exp.status.pComponent + "," + exp.status.iComponent + "," + exp.status.dComponent + "\n");
    //image.writeXMP(name, status.evDiff);
}

function getDetails(file) {
    var d = {
        frames: status.frames,
        evCorrection: status.evDiff,
        targetEv: exp.status.targetEv,
        actualEv: status.rampEv,
        cameraEv: status.cameraEv,
        rampRate: exp.status.rate,
        intervalMs: status.intervalMs,
        timestamp: status.lastPhotoTime,
        fileName: file || status.path,
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

function doKeyframeAxis(axisName, keyframes, setupFirst, interpolationMethod, motionFunction) {
    if(interpolationMethod != 'smooth') interpolationMethod = 'linear';
    if (status.running && keyframes && keyframes.length > 0 && keyframes[0].position != null) {
        var kfSet = null;
        var kfCurrent = null;

        if (setupFirst) {
            keyframes[0].seconds = 0;
            keyframes[0].position = 0;
            kfSet = 0;
            if(!intervalometer.currentProgram[axisName + 'Pos']) intervalometer.currentProgram[axisName + 'Pos'] = 0;
        } else {
            var secondsSinceStart = status.lastPhotoTime + (status.intervalMs / 1000);

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
        kfCurrent = intervalometer.currentProgram[axisName + 'Pos'] || 0;

        if (kfCurrent == null) {
            motionFunction(kfSet, axisName); // absolute setting (like ev)
        } else {
            var precision = axisName == 'focus' ? 1 : 10000; // limit precision to ensure we hit even values
            var kfTarget = Math.round(kfSet * precision) / precision;
            if (kfTarget != Math.round(intervalometer.currentProgram[axisName + 'Pos'] * precision) / precision) {
                var relativeMove = kfTarget - intervalometer.currentProgram[axisName + 'Pos'];
                if (motionFunction) motionFunction(relativeMove, axisName);
                intervalometer.currentProgram[axisName + 'Pos'] = kfTarget;
            } else {
                if (motionFunction) motionFunction(null, axisName);
            }
        }

    } else {
        if (motionFunction) motionFunction(null, axisName);
    }
}

function doKeyframeAxisOld(axisName, axisSubIndex, setupFirst, interpolationMethod, motionFunction) {
    if(interpolationMethod != 'smooth') interpolationMethod = 'linear';
    var keyframes = intervalometer.currentProgram.keyframes;
    if (status.running && keyframes && keyframes.length > 0 && keyframes[0][axisName] != null) {
        var kfSet = null;
        var kfCurrent = null;

        if (setupFirst) {
            keyframes[0].seconds = 0;
            if(axisSubIndex != null) {
                keyframes[0][axisName][axisSubIndex] = 0;
            } else {
                keyframes[0][axisName] = 0;
            }
            kfSet = 0;
        } else {
            var secondsSinceStart = status.lastPhotoTime + (status.intervalMs / 1000);

            console.log("KF: Seconds since last: " + secondsSinceStart);
            var totalSeconds = 0;
            kfPoints = keyframes.map(function(kf) {
                totalSeconds += kf.seconds;
                if(axisSubIndex != null) {
                    return {
                        x: totalSeconds,
                        y: kf[axisName][axisSubIndex] || 0
                    }
                } else {
                    return {
                        x: totalSeconds,
                        y: kf[axisName] || 0
                    }
                }
            });
            kfSet = interpolate[interpolationMethod](kfPoints, secondsSinceStart);
            console.log("KF: " + axisName + (axisSubIndex != null ? axisSubIndex : '') + " target: " + kfSet);
        }
        var axisNameExtension = '';
        if(axisSubIndex != null) axisNameExtension = '-' + axisSubIndex;
        kfCurrent = intervalometer.currentProgram[axisName + axisNameExtension + 'Pos'] || 0;

        if (kfCurrent == null) {
            motionFunction(kfSet); // absolute setting (like ev)
        } else {
            var precision = axisName == 'focus' ? 1 : 10000; // limit precision to ensure we hit even values
            var kfTarget = Math.round(kfSet * precision) / precision;
            if (kfTarget != Math.round(intervalometer.currentProgram[axisName + axisNameExtension + 'Pos'] * precision) / precision) {
                var relativeMove = kfTarget - intervalometer.currentProgram[axisName + axisNameExtension + 'Pos'];
                motionFunction(relativeMove);
                intervalometer.currentProgram[axisName + axisNameExtension + 'Pos'] = kfTarget;
            } else {
                if (motionFunction) motionFunction();
            }
        }

    } else {
        if (motionFunction) motionFunction();
    }
}

function calculateCelestialDistance(startPos, currentPos) {
    var panDiff = (currentPos.azimuth - startPos.azimuth) * 180 / Math.PI;
    var tiltDiff = (currentPos.altitude - startPos.altitude) * 180 / Math.PI;
    var altDeg = currentPos.altitude * 180 / Math.PI;
    var ease = 1;
    if(altDeg < 5) {
        if(altDeg < -10) {
            ease = 0;
        } else {
            ease = (altDeg - -10) / 15;
        }
    }
    return {
        pan: panDiff * ease,
        tilt: tiltDiff * ease
    }
}

function getTrackingMotor(trackingMotor) {
    if(trackingMotor && trackingMotor != 'none') {
        var parts = trackingMotor.match(/^([A-Z]+)([0-9]+)(r?)$/);
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

    if(!intervalometer.currentProgram.axes) 
        return processKeyframesOld(setupFirst, callback); // old (v1.7) method for original app

    var numAxes = 1;
    var axesDone = 0;

    var checkDone = function() {
        axesDone++;
        console.log("KF: " + axesDone + " of " + numAxes + " keyframe items complete");
        if (axesDone >= numAxes && callback) {
            console.log("KF: keyframes complete, running callback");
            callback();
        }
    }

    if(intervalometer.gpsData) {
        var sunmoon = meeus.sunmoon(new Date(), intervalometer.gpsData.lat, intervalometer.gpsData.lon, intervalometer.gpsData.alt);
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

        if(axis.type == 'keyframe') {
            if(m == 'focus') {
                doKeyframeAxis(m, axis.kf, setupFirst, axis.interpolation || 'linear', function(focus) {
                    var doFocus = function() {
                        console.log("KF: Moving focus by " + focus + " steps");
                        var dir = focus > 0 ? 1 : -1;
                        var steps = Math.abs(focus);
                        camera.ptp.focus(dir, steps, function() {
                            if(camera.ptp.model.match(/fuji/i)) {
                                checkDone();
                            } else {
                                setTimeout(function(){
                                    camera.ptp.lvOff(function(){
                                        setTimeout(checkDone, 500);                                
                                    });
                                }, 500);
                            }
                        });
                    }
                    focus += status.focusDiffNew;
                    status.focusDiffNew = 0;
                    if(focus) {
                        if(camera.ptp.model.match(/fuji/i)) {
                            doFocus();
                        } else {
                            camera.ptp.preview(function() {
                                setTimeout(doFocus, 1000);
                            });
                        }
                    } else {
                        checkDone();
                    }
                });
            } else if(m == 'ev') {
                doKeyframeAxis(m, axis.kf, setupFirst, axis.interpolation || 'linear', function(ev) {
                    //if (ev != null && camera.settings.ev != ev) camera.setEv(ev);
                    checkDone();
                });
            } else if(m == 'interval') {
                doKeyframeAxis(m, axis.kf, setupFirst, axis.interpolation || 'linear', function(interval) {
                    //status.intervalMs = interval * 1000;
                    checkDone();
                });
            } else {
                doKeyframeAxis(m, axis.kf, setupFirst, axis.interpolation || 'smooth', function(move, axisName) {
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
                                    checkDone();
                                });
                            } else {
                                console.log("KF: error moving", axisName, "-- motor not connected");
                                checkDone();
                            }
                        } else {
                            console.log("KF: error moving -- no motion system connected");
                            checkDone();
                        }
                    } else {
                        checkDone();
                    }
                });
            }
        } else if(axis.type == 'tracking') {
            var trackingTarget = null;
            if(axis.target == 'sun' && sunPos) {
                trackingTarget = calculateCelestialDistance(status.sunPos, sunPos);
            } else if(axis.target == 'moon' && moonPos) {
                trackingTarget = calculateCelestialDistance(status.moonPos, moonPos);
            } else if(axis.target == '15deg') {
                trackingTarget = {
                    pan: (((new Date() / 1000) - status.startTime) / 3600) * 15,
                    tilt: 0
                }
            }
            var motor = null;
            motor = getTrackingMotor(m);
            if(axis.direction) motor.direction = axis.direction;

            if(trackingTarget) {
                if(axis.orientation == 'pan') {
                    var panDegrees = trackingTarget.pan - status.trackingPan;
                    if(status.panDiff != status.panDiffNew) {
                        status.panDiff = status.panDiffNew;
                    }
                    panDegrees += status.panDiff;
                    if(panDegrees != 0) {
                        status.trackingPanEnabled = true;
                        numAxes++;
                        var panSteps = panDegrees * motor.stepsPerDegree;
                        if(motor.stepsPerDegree > 100) {
                            panSteps = Math.round(panSteps);
                        }
                        console.log("Intervalometer: tracking pan", panDegrees, status.trackingPan, panSteps, status.frames);
                        motion.move(motor.driver, motor.motor, panSteps * motor.direction, function() {
                            status.trackingPan += panSteps / motor.stepsPerDegree;
                            checkDone();
                        });
                    } else {
                        checkDone();
                    }
                } else if(axis.orientation == 'tilt') {
                    var tiltDegrees = trackingTarget.tilt - status.trackingTilt;
                    if(status.tiltDiff != status.tiltDiffNew) {
                        status.tiltDiff = status.tiltDiffNew;
                    }
                    tiltDegrees += status.tiltDiff;
                    if(tiltDegrees != 0 && axis.orientation == 'tilt') {
                        status.trackingTiltEnabled = true;
                        numAxes++;
                        var tiltSteps = tiltDegrees * tiltMotor.stepsPerDegree;
                        if(motor.stepsPerDegree > 100) {
                            tiltSteps = Math.round(tiltSteps);
                        }
                        var direction = -1;
                        console.log("Intervalometer: tracking tilt", tiltDegrees, status.trackingTilt, tiltSteps, status.frames);
                        motion.move(motor.driver, motor.motor, panSteps * motor.direction, function() {
                            status.trackingPan += panSteps / motor.stepsPerDegree;
                            checkDone();
                        });
                    } else {
                        checkDone();
                    }
                } else {
                    checkDone();
                }
            } else {
                checkDone();
            }
        } else {
            checkDone();
        }

    }
    checkDone();
}

function processKeyframesOld(setupFirst, callback) {

    var numAxes = 2;
    var axesDone = 0;

    var checkDone = function() {
        axesDone++;
        console.log("KF: " + axesDone + " keyframe items complete");
        if (axesDone >= numAxes && callback) {
            console.log("KF: keyframes complete, running callback");
            callback();
        }
    }

    if((intervalometer.currentProgram.keyframes == null || intervalometer.currentProgram.keyframes.length == 1) && intervalometer.currentProgram.tracking != 'none' && intervalometer.gpsData) {
        var trackingTarget = null;
        if(intervalometer.currentProgram.tracking == 'sun') {
            var sunmoon = meeus.sunmoon(new Date(), intervalometer.gpsData.lat, intervalometer.gpsData.lon, intervalometer.gpsData.alt);
            var sunPos = {
                azimuth: sunmoon.sunpos.az,
                altitude: sunmoon.sunpos.alt,
            }
            trackingTarget = calculateCelestialDistance(status.sunPos, sunPos);
        } else if(intervalometer.currentProgram.tracking == 'moon') {
            var sunmoon = meeus.sunmoon(new Date(), intervalometer.gpsData.lat, intervalometer.gpsData.lon, intervalometer.gpsData.alt);
            var moonPos = {
                azimuth: sunmoon.moonpos.az,
                altitude: sunmoon.moonpos.alt,
            }
            trackingTarget = calculateCelestialDistance(status.moonPos, moonPos);
        } else if(intervalometer.currentProgram.tracking == '15deg') {
            trackingTarget = {
                pan: (((new Date() / 1000) - status.startTime) / 3600) * 15,
                tilt: 0
            }
        }
        if(trackingTarget) {
            var panDegrees = trackingTarget.pan - status.trackingPan;
            if(status.panDiff != status.panDiffNew) {
                status.panDiff = status.panDiffNew;
            }
            panDegrees += status.panDiff;
            if(panDegrees != 0) {
                var panMotor = getTrackingMotor(intervalometer.currentProgram.trackingPanMotor);
                if(panMotor) {
                    status.trackingPanEnabled = true;
                    numAxes++;
                    var panSteps = panDegrees * panMotor.stepsPerDegree;
                    if(panMotor.stepsPerDegree > 100) {
                        panSteps = Math.round(panSteps);
                    }
                    console.log("Intervalometer: tracking pan", panDegrees, status.trackingPan, panSteps, status.frames);
                    motion.move(panMotor.driver, panMotor.motor, panSteps * panMotor.direction, function() {
                        status.trackingPan += panSteps / panMotor.stepsPerDegree;
                        checkDone();
                    });
                }
            }
            var tiltDegrees = trackingTarget.tilt - status.trackingTilt;
            if(status.tiltDiff != status.tiltDiffNew) {
                status.tiltDiff = status.tiltDiffNew;
            }
            tiltDegrees += status.tiltDiff;
            if(tiltDegrees != 0) {
                var tiltMotor = getTrackingMotor(intervalometer.currentProgram.trackingTiltMotor);
                if(tiltMotor) {
                    status.trackingTiltEnabled = true;
                    numAxes++;
                    var tiltSteps = tiltDegrees * tiltMotor.stepsPerDegree;
                    if(tiltMotor.stepsPerDegree > 100) {
                        tiltSteps = Math.round(tiltSteps);
                    }
                    var direction = -1;
                    console.log("Intervalometer: tracking tilt", tiltDegrees, status.trackingTilt, tiltSteps, status.frames);
                    motion.move(tiltMotor.driver, tiltMotor.motor, tiltSteps * tiltMotor.direction, function() {
                        status.trackingTilt += tiltSteps / tiltMotor.stepsPerDegree;
                        checkDone();
                    });
                }
            }
        }
    }

    if(intervalometer.currentProgram.keyframes && intervalometer.currentProgram.keyframes.length > 0 && intervalometer.currentProgram.keyframes[0].motor) {
        for(motorId in intervalometer.currentProgram.keyframes[0].motor) numAxes++;
    }

    doKeyframeAxisOld('ev', null, setupFirst, 'linear', function(ev) {
        //if (ev != null && camera.settings.ev != ev) camera.setEv(ev);
        checkDone();
    });

    doKeyframeAxisOld('focus', null, setupFirst, 'linear', function(focus) {
        var doFocus = function() {
            console.log("KF: Moving focus by " + focus + " steps");
            var dir = focus > 0 ? 1 : -1;
            var steps = Math.abs(focus);
            camera.ptp.focus(dir, steps, function() {
                if(camera.ptp.model.match(/fuji/i)) {
                    checkDone();
                } else {
                    setTimeout(function(){
                        camera.ptp.lvOff(function(){
                            setTimeout(checkDone, 500);                                
                        });
                    }, 500);
                }
            });
        }
        if(focus) {
            if(camera.ptp.model.match(/fuji/i)) {
                doFocus();
            } else {
                camera.ptp.preview(function() {
                    setTimeout(doFocus, 1000);
                });
            }
        } else {
            checkDone();
        }
    });

    if(intervalometer.currentProgram.keyframes && intervalometer.currentProgram.keyframes.length > 0 && intervalometer.currentProgram.keyframes[0].motor) for(motorId in intervalometer.currentProgram.keyframes[0].motor) {
        doKeyframeAxisOld('motor', motorId, setupFirst, 'smooth', function(move) {
            var parts = motorId.split('-');
            if (move && parts.length == 2) {
                var driver = parts[0];
                var motor = parseInt(parts[1]);
                console.log("KF: Moving " + motorId + " by " + move + " steps");
                if (motion.status.available) {
                    var connected = false;
                    for(var index = 0; index < motion.status.motors.length; index++) {
                        var m = motion.status.motors[index];
                        if(m.driver == driver && m.motor == motor) {
                            connected = m.connected;
                            break;
                        }
                    }
                    if(connected) {
                        motion.move(driver, motor, move, function() {
                            checkDone();
                        });
                    } else {
                        console.log("KF: error moving", motorId, "-- motor not connected");
                        checkDone();
                    }
                } else {
                    console.log("KF: error moving -- no motion system connected");
                    checkDone();
                }
            } else {
                checkDone();
            }
        });
    }

}

function getEvOptions() {
    var maxShutterLengthMs = (status.intervalMs - intervalometer.autoSettings.paddingTimeMs);
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
    busyExposure = true;
    camera.ptp.getSettings(function() {
        console.log("EXP: current interval: ", status.intervalMs, " (took ", (new Date() / 1000 - expSetupStartTime), "seconds from setup start");
        var diff = 0;
        if(!status.rampEv) {
            status.rampEv = camera.lists.getEvFromSettings(camera.ptp.settings);
        }
        dynamicChangeUpdate();
        if(status.hdrSet && status.hdrSet.length > 0) {
            if(!status.hdrIndex) status.hdrIndex = 0;
            if(status.hdrIndex < status.hdrSet.length) {
                diff = status.hdrSet[status.hdrIndex];
                status.hdrIndex++;
            } else {
                status.hdrIndex = 0;
            }
            console.log("HDR adjustment:", diff, status.hdrIndex);
        }
        if(status.rampMode == 'preset') {
            camera.setExposure(status.shutterPreset + diff, status.aperturePreset, status.isoPreset, function(err, ev) {
                if(ev != null) {
                    status.cameraEv = ev;
                } 
                status.cameraSettings = camera.ptp.settings;
                status.evDiff = status.cameraEv - status.rampEv;
                console.log("EXP: program (preset):", "capture", " (took ", (new Date() / 1000 - expSetupStartTime), "seconds from setup start");
                busyExposure = false;
                cb && cb(err);
            });
        } else {
            if(status.hdrSet && status.hdrSet.length > 0) {
                var options = getEvOptions();
                options.doNotSet = true;
                camera.setEv(status.rampEv + status.hdrMax, options, function(err, res) {
                    camera.setExposure(res.shutter.ev + diff - status.hdrMax, res.aperture.ev, res.iso.ev, function(err, ev) {
                        if(ev != null) {
                            status.cameraEv = ev;
                        } 
                        status.cameraSettings = camera.ptp.settings;
                        status.evDiff = status.cameraEv - status.rampEv;
                        console.log("EXP: program (preset):", "capture", " (took ", (new Date() / 1000 - expSetupStartTime), "seconds from setup start");
                        busyExposure = false;
                        cb && cb(err);
                    });
                });
            } else {
                camera.setEv(status.rampEv + diff, getEvOptions(), function(err, res) {
                    if(res.ev != null) {
                        status.cameraEv = res.ev;
                    } 
                    status.cameraSettings = camera.ptp.settings;
                    status.evDiff = status.cameraEv - status.rampEv;
                    console.log("EXP: program:", "capture", " (took ", (new Date() / 1000 - expSetupStartTime), "seconds from setup start");
                    busyExposure = false;
                    cb && cb(err);
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

    status.hdrIndex = 0;
    status.hdrSet = [];
    status.hdrMax = overHdr;
    
    while(overSet.length || underSet.length) {
        if(overSet.length) status.hdrSet.push(overSet.shift());
        if(underSet.length) status.hdrSet.push(underSet.shift());
    }
    console.log("planHdr:", status.hdrSet)
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
        if(status.currentPlanIndex !== planIndex) {
            status.currentPlanIndex = planIndex;
            status.framesRemaining = Infinity;
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
                status.rampMode = 'auto';
                if(status.rampEv == null) status.rampEv = camera.lists.getEvFromSettings(camera.ptp.settings); 
            }
            if(plan.mode == 'lock') {
                if(status.rampEv == null) status.rampEv = camera.lists.getEvFromSettings(camera.ptp.settings); 
                status.rampMode = 'fixed';
            }
            if(plan.mode == 'preset') {
                status.rampMode = 'preset';
                status.shutterPreset = plan.shutter;
                status.aperturePreset = plan.aperture;
                status.isoPreset = plan.iso;
                status.rampEv = camera.lists.getEv(status.shutterPreset, status.aperturePreset, status.isoPreset);
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

    if(mStart < mStop) { // day only
        return (mNow >= mStart && mNow < mStop);
    } else { // night only
        return (mNow >= mStart || mNow < mStop);
    }
}

var scheduleHandle = null;
function waitForSchedule() {
    status.message = "waiting for schedule...";
    intervalometer.emit("status", status);
    scheduleHandle = setTimeout(function(){
        if(scheduled(true)) {
            if(status.running) {
                intervalometer.cancel("scheduled stop", function(){ // each day a new clip is generated
                    setTimeout(function(){
                        intervalometer.run(intervalometer.currentProgram);
                    });
                });
             }
        } else {
            waitForSchedule();
        }
    }, 60000);
}

function scheduled(noResume) {
    if(intervalometer.currentProgram && intervalometer.currentProgram.scheduled) {
        var m = moment().utcOffset(status.utcOffset);
        if(checkDay(m)) {
            if(checkTime(m)) {
                return true;
            } else {
                if(!noResume) waitForSchedule();
                return false;
            }
        } else {
            if(!noResume) waitForSchedule();
            return false;
        }
    } else {
        return true;
    }
}

var busyPhoto = false;
var retryHandle = null;
var referencePhotoRes = null;

function runPhoto() {
    if(!status.running) {
        busyPhoto = false;
        status.stopping = false;
        return;
    }
    if ((busyPhoto || busyExposure) && intervalometer.currentProgram.rampMode != "fixed") {
        if(busyPhoto) console.log("P");
        if(busyExposure) console.log("E");
        if (status.running) retryHandle = setTimeout(runPhoto, 100);
        return;
    }
    if(!status.running) return;
    if(status.first) {
        status.first = false;
        return setTimeout(function() {
            setupExposure(runPhoto);
        });
    }
    busyPhoto = true;
    if (camera.ptp.connected) {
        if(status.useLiveview) camera.ptp.preview();
        if(!(status.hdrSet && status.hdrSet.length > 0) || status.hdrIndex == 1) {
            status.captureStartTime = new Date() / 1000;
        }
        intervalometer.emit("status", status);
        var captureOptions = {
            thumbnail: true,
            index: status.frames,
            noDownload: (status.hdrSet && status.hdrSet.length > 0 && status.hdrIndex > 0) // only fetch thumbnail for the reference photo in the HDR set
                //saveTiff: "/mnt/sd/test" + status.frames + ".tiff",
                //saveRaw: "/mnt/sd/test" + status.frames + ".cr2",
        }
        if (intervalometer.currentProgram.destination == 'sd' && camera.ptp.sdPresent && camera.ptp.sdMounted) {
            console.log("CAPT: Saving timelapse to SD card");
            captureOptions.thumbnail = false;
            var framesPadded = status.frames.toString();
            while (framesPadded.length < 4) framesPadded = '0' + framesPadded;
            captureOptions.saveRaw = status.mediaFolder + "/img-" + framesPadded;
            camera.ptp.saveToCameraCard(false);
        } else {
            camera.ptp.saveToCameraCard(true);
        }

        if (intervalometer.currentProgram.rampMode == "fixed") {
            status.intervalMs = intervalometer.currentProgram.interval * 1000;
            if (status.running && scheduled()) timerHandle = setTimeout(runPhoto, status.intervalMs);
            setTimeout(motionSyncPulse, camera.lists.getSecondsFromEv(camera.ptp.settings.details.shutter.ev) * 1000 + 1500);
            captureOptions.calculateEv = false;
            status.lastPhotoTime = new Date() / 1000 - status.startTime;
            camera.ptp.capture(captureOptions, function(err, photoRes) {
                if (!err && photoRes) {
                    status.path = photoRes.file;
                    if(photoRes.cameraCount > 1) {
                        for(var i = 0; i < photoRes.cameraResults.length; i++) {
                            console.log("photoRes.cameraResults[" + i + "]:", photoRes.cameraResults[i].file, photoRes.cameraResults[i].cameraIndex, photoRes.cameraResults[i].thumbnailPath);
                            db.setTimelapseFrame(status.id, 0, getDetails(photoRes.cameraResults[i].file), photoRes.cameraResults[i].cameraIndex, photoRes.cameraResults[i].thumbnailPath);
                        }
                    } else {
                        db.setTimelapseFrame(status.id, 0, getDetails(), 1, photoRes.thumbnailPath);
                    }
                    status.message = "running";
                    if (status.framesRemaining > 0) status.framesRemaining--;
                    status.frames++;
                    //writeFile();
                    intervalometer.emit("status", status);
                    console.log("TL: program status:", status);
                } else {
                    intervalometer.emit('error', "An error occurred during capture.  This could mean that the camera body is not supported or possibly an issue with the cable disconnecting.\nThe time-lapse will attempt to continue anyway.\nSystem message: ", err);
                }
                if ((status.framesRemaining < 1 && !intervalometer.currentProgram.scheduled) || status.running == false || status.stopping == true) {
                    clearTimeout(timerHandle);
                    status.message = "done";
                    status.framesRemaining = 0;
                    intervalometer.cancel('done');
                }
                dynamicChangeUpdate();
                processKeyframes(false, function() {
                    busyPhoto = false;
                });
            });
        } else {
            if (status.rampEv === null) {
                status.cameraEv = camera.lists.getEvFromSettings(camera.ptp.settings); 
                status.rampEv = status.cameraEv;
            }
            captureOptions.exposureCompensation = status.evDiff || 0;

            if(status.hdrSet && status.hdrSet.length > 0) {
                if(status.hdrIndex == 0) {
                    captureOptions.calculateEv = true;
                } else {
                    captureOptions.calculateEv = false;
                }
            } else {
                captureOptions.calculateEv = true;
            }

            if(intervalometer.currentProgram.intervalMode == 'aux') {
                if(status.intervalStartTime) status.intervalMs = ((new Date() / 1000) - status.intervalStartTime) * 1000;
                status.intervalStartTime = new Date() / 1000;
            } else if(!(status.hdrSet && status.hdrSet.length > 0) || status.hdrIndex == 1) { // only start interval timer at first HDR exposure
                status.intervalMs = calculateIntervalMs(intervalometer.currentProgram.interval, status.rampEv);                
                console.log("TL: Setting timer for interval at ", status.intervalMs);
                if (timerHandle) clearTimeout(timerHandle);
                var runIntervalHdrCheck = function() {
                    if(!(status.hdrSet && status.hdrSet.length > 0) || status.hdrIndex == 1) {
                        runPhoto();
                    } else {
                        console.log("HDR: delaying interval for HDR set");
                        if (status.running) timerHandle = setTimeout(runIntervalHdrCheck, 100);
                    }
                }
                if (status.running && scheduled()) timerHandle = setTimeout(runIntervalHdrCheck, status.intervalMs);
            } 

            intervalometer.emit("status", status);
            var shutterEv;
            if(camera.ptp.settings.details && camera.ptp.settings.details.shutter) shutterEv = camera.ptp.settings.details.shutter.ev; else shutterEv = 0;

            if(status.hdrSet && status.hdrSet.length > 0 && status.hdrIndex > 0 && status.rampEv + status.hdrMax >= camera.maxEv(camera.ptp.settings, getEvOptions())) {
                status.hdrIndex = 0; // disable HDR is the exposure is at the maximum
            }
            if(status.hdrSet && status.hdrSet.length > 0 && status.hdrIndex > 0) {
                if(checkCurrentPlan(true)) {
                    busyPhoto = false;
                    return;
                }
                var nextHDRms = 100 + camera.lists.getSecondsFromEv(shutterEv) * 1000;
                console.log("running next in HDR sequence", status.hdrIndex, nextHDRms);
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
                status.lastPhotoTime = new Date() / 1000 - status.startTime;
            }
            camera.ptp.capture(captureOptions, function(err, photoRes) {
                if (!err && photoRes) {
                    if(!status.hdrIndex) referencePhotoRes = photoRes;

                    var bufferTime = (new Date() / 1000) - status.captureStartTime - camera.lists.getSecondsFromEv(camera.ptp.settings.details.shutter.ev);
                    if(!status.bufferSeconds) {
                        status.bufferSeconds = bufferTime;
                    } else if(bufferTime != status.bufferSeconds) {
                        status.bufferSeconds = (status.bufferSeconds + bufferTime) / 2;
                    }
                    status.path = referencePhotoRes.file;
                    if(referencePhotoRes.cameraCount > 1) {
                        for(var i = 0; i < referencePhotoRes.cameraResults.length; i++) {
                            db.setTimelapseFrame(status.id, status.evDiff, getDetails(referencePhotoRes.cameraResults[i].file), referencePhotoRes.cameraResults[i].cameraIndex, referencePhotoRes.cameraResults[i].thumbnailPath);
                        }
                    } else {
                        db.setTimelapseFrame(status.id, status.evDiff, getDetails(), 1, referencePhotoRes.thumbnailPath);
                    }
                    intervalometer.autoSettings.paddingTimeMs = status.bufferSeconds * 1000 + 250; // add a quarter second for setting exposure

                    if(status.rampMode == "auto") {
                        status.rampEv = exp.calculate(intervalometer.currentProgram.rampAlgorithm, intervalometer.currentProgram.rampMode, status.rampEv, referencePhotoRes.ev, referencePhotoRes.histogram, camera.minEv(camera.ptp.settings, getEvOptions()), camera.maxEv(camera.ptp.settings, getEvOptions()));
                        status.rampRate = exp.status.rate;
                    } else if(status.rampMode == "fixed") {
                        status.rampRate = 0;
                    }

                    status.path = referencePhotoRes.file;
                    status.message = "running";                    
                    if(!checkCurrentPlan(true)) setupExposure();

                    if (status.framesRemaining > 0) status.framesRemaining--;
                    status.frames++;
                    writeFile();
                    if(intervalometer.currentProgram.intervalMode == 'aux') status.message = "waiting for AUX2...";
                    intervalometer.emit("status", status);
                    console.log("TL: program status:", status);
                    if(status.frames == 1 && photoRes.ev > 2.5) {
                        error("WARNING: the exposure is too high for reliable ramping. It will attempt to continue, but it's strongly recommended to stop the time-lapse, descrease the exposure to expose for the highlights and then start again.");
                    }

                } else {
                    if(!err) err = "unknown";
                    error("An error occurred during capture.  This could mean that the camera body is not supported or possibly an issue with the cable disconnecting.\nThe time-lapse will attempt to continue anyway.\nSystem message: " + err);
                    console.log("TL: error:", err);
                }
                if ((intervalometer.currentProgram.intervalMode == "fixed" && status.framesRemaining < 1) || status.running == false || status.stopping == true) {
                    clearTimeout(timerHandle);
                    status.stopping = false;
                    status.message = "done";
                    status.framesRemaining = 0;
                    intervalometer.cancel('done');
                }
                processKeyframes(false, function() {
                    busyPhoto = false;
                });
            });
        }
    }
}

function error(msg) {
    setTimeout(function(){
        intervalometer.emit("error", msg);
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

intervalometer.validate = function(program) {
    var results = {
        errors: []
    };
    if(program.frames === null) program.frames = Infinity;
    
    if (parseInt(program.delay) < 1) program.delay = 2;
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
    if(!program.axes.focus) program.axes.focus = {kf:[{seconds: 0, position: 0}]};

    program.axes.focus.type = 'keyframe'; // make focus adjustment available

    console.log("VAL: validating program:", results);

    return results;
}
intervalometer.cancel = function(reason, callback) {
    if(!reason) reason = 'stopped';
    if (intervalometer.status.running) {
        clearTimeout(timerHandle);
        clearTimeout(delayHandle);
        intervalometer.status.stopping = true;
        if(reason == 'err') intervalometer.status.message = "stopped due to error";
        else if(reason == 'done') intervalometer.status.message = "time-lapse complete";
        else intervalometer.status.message = "time-lapse canceled";
        intervalometer.status.framesRemaining = 0;
        intervalometer.emit("status", status);
        camera.ptp.completeWrites(function() {
            busyPhoto = false;
            intervalometer.status.running = false;
            intervalometer.status.stopping = false;
            intervalometer.timelapseFolder = false;
            camera.ptp.saveThumbnails(intervalometer.timelapseFolder);
            camera.ptp.unmountSd();
            intervalometer.emit("status", status);
            console.log("==========> END TIMELAPSE", status.tlName);
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
    var ms = status.intervalMs - ((new Date() / 1000) - (status.startTime + status.lastPhotoTime)) * 1000;
    if(ms < 0) ms = 0;
    if(scheduled() && intervalometer.status.running) setTimeout(runPhoto, ms);
}

intervalometer.run = function(program, date, utcOffset) {
    if (intervalometer.status.running) return;
    intervalometer.status.stopping = false;
    console.log("loading time-lapse program:", program);
    db.set('intervalometer.currentProgram', program);

    if(date && utcOffset) { // sync time with phone app local time
        var diff = moment(date).diff(moment(), 'minutes');
        console.log("date difference (minutes):", diff);
        diff += utcOffset;
        status.utcOffset = diff;
        console.log("current local time:", moment().utcOffset(status.utcOffset).format());
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
                    console.log("Intervalometer: time-lapse list:", list);
                    var name;
                    do {
                        tlIndex++;
                        name = "tl-" + tlIndex;
                    } while(list.indexOf(name) !== -1);

                    status.tlName = "tl-" + tlIndex;
                    console.log("==========> TIMELAPSE START", status.tlName);
                    intervalometer.timelapseFolder = TLROOT + "/" + status.tlName;
                    fs.mkdirSync(intervalometer.timelapseFolder);
                    camera.ptp.saveThumbnails(intervalometer.timelapseFolder);
                    status.timelapseFolder = intervalometer.timelapseFolder;
                    fileInit();

                    busyPhoto = false;
                    intervalometer.currentProgram = program;
                    status.intervalMs = program.interval * 1000;
                    status.message = "starting";
                    status.frames = 0;
                    status.first = program.rampMode == 'fixed' ? false : true; // triggers setup exposure before first capture unless fixed mode
                    status.rampMode = program.rampMode == 'fixed' ? 'fixed' : 'auto';
                    status.framesRemaining = (program.intervalMode == "auto" && status.rampMode == "auto") ? Infinity : program.frames;
                    status.startTime = new Date() / 1000;
                    status.rampEv = null;
                    status.bufferSeconds = 0;
                    status.cameraSettings = camera.ptp.settings;
                    status.hdrSet = [];
                    status.hdrIndex = 0;
                    status.currentPlanIndex = null;
                    status.panDiffNew = 0;
                    status.tiltDiffNew = 0;
                    status.focusDiffNew = 0;
                    status.panDiff = 0;
                    status.tiltDiff = 0;
                    status.trackingPanEnabled = false;
                    status.trackingTiltEnabled = false;
                    status.dynamicChange = {};

                    if(program.hdrCount && program.hdrCount > 1 && program.hdrStops) {
                        planHdr(program.hdrCount, program.hdrStops);
                    }

                    if(status.rampMode != 'fixed') {
                        checkCurrentPlan();
                    }

                    if(intervalometer.gpsData) {
                        status.latitude = intervalometer.gpsData.lat;
                        status.longitude = intervalometer.gpsData.lon;
            
                        var sunmoon = meeus.sunmoon(new Date(), intervalometer.gpsData.lat, intervalometer.gpsData.lon, intervalometer.gpsData.alt);
                        status.sunPos = {
                            azimuth: sunmoon.sunpos.az,
                            altitude: sunmoon.sunpos.alt,
                        }
                        status.moonPos = {
                            azimuth: sunmoon.moonpos.az,
                            altitude: sunmoon.moonpos.alt,
                        }
                        status.trackingTilt = 0;
                        status.trackingPan = 0;
                    }
                    exp.init(camera.minEv(camera.ptp.settings, getEvOptions()), camera.maxEv(camera.ptp.settings, getEvOptions()), program.nightCompensation, program.highlightProtection);
                    status.running = true;
                    intervalometer.emit("status", status);
                    console.log("program:", "starting", program);

                    //function start() {
                    //    if(camera.ptp.settings.autofocus && camera.ptp.settings.autofocus == "on") {
                    //        console.log("Intervalometer: disabling autofocus");
                    //        camera.ptp.set("autofocus", "off", checkFocus2);
                    //    } else {
                    //        checkFocus2();
                    //    }
                    //}

                    //function checkFocus2() {
                    //    if(camera.ptp.settings.afmode && camera.ptp.settings.afmode != "manual") {
                    //        console.log("Intervalometer: setting focus mode to manual");
                    //        camera.ptp.set("afmode", "manual", start2);
                    //    } else {
                    //        start2();
                    //    }
                    //}

                    function start() {
                        status.useLiveview = false;
                        var focusPosTest = null;
                        var focusChange = false;
                        if(camera.ptp.model.match(/nikon/i) && intervalometer.currentProgram.keyframes && intervalometer.currentProgram.keyframes.length > 0) {
                            for(var i = 0; i < intervalometer.currentProgram.keyframes.length; i++) {
                                if(focusPosTest != null && focusPosTest != intervalometer.currentProgram.keyframes[i].focus) {
                                    focusChange = true;
                                    break;
                                }
                                focusPosTest = intervalometer.currentProgram.keyframes[i].focus;
                            }
                            if(focusChange) status.useLiveview = true;
                        }

                        var cameras = 1, primary = 1;
                        if(camera.ptp.synchronized) {
                            cameras = camera.ptp.count;
                            primary = camera.ptp.getPrimaryCameraIndex();
                        }
                        db.setTimelapse(status.tlName, program, cameras, primary, status, function(err, timelapseId) {
                            status.id = timelapseId;
                            processKeyframes(true, function() {
                                setTimeout(function() {
                                    busyPhoto = false;
                                    if(intervalometer.currentProgram.intervalMode != 'aux' || intervalometer.currentProgram.rampMode == 'fixed') {
                                        if(scheduled()) runPhoto();   
                                    }
                                    if(intervalometer.currentProgram.intervalMode == 'aux') {
                                        status.message = "waiting for AUX2...";
                                        intervalometer.emit("status", status);
                                    }
                                }, 3000);
                            });
                        });
                        //delayHandle = setTimeout(function() {
                        //    runPhoto();
                        //}, program.delay * 1000);
                    }

                    if (program.destination && program.destination == 'sd' && camera.ptp.sdPresent) {
                        camera.ptp.mountSd(function(mountErr) {
                            if(mountErr) {
                                console.log("Error mounting SD card");
                                intervalometer.cancel('err');
                                error("Error mounting SD card. \nVerify the SD card is formatted and fully inserted in the VIEW, then try starting the time-lapse again.\nMessage from system: " + mountErr);
                            } else {
                                status.mediaFolder = "/media/" + status.tlName;
                                fs.mkdir(status.mediaFolder, function(folderErr) {
                                    if(folderErr) {
                                        console.log("Error creating folder", status.mediaFolder);
                                        intervalometer.cancel('err');
                                        error("Error creating folder on SD card: /" + status.tlName + ".\nVerify the card is present and not write-protected, then try starting the time-lapse again.\nAlternatively, set the Destination to Camera instead (if supported)");
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
                error("Failed to start time-lapse: \n" + errorList + "Please correct and try again.");
            }
        });
    } else {
        intervalometer.cancel('err');
        error("Camera not connected.  Please verify camera connection via USB and try again.");
        return;
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
        for(param in intervalometer.status.dynamicChange) {
            if(intervalometer.status.dynamicChange.hasOwnProperty(param) && intervalometer.status.dynamicChange[param]) {
                var item = intervalometer.status.dynamicChange[param];
                intervalometer.currentProgram[param] = interpolate.linear([{
                    x: item.startVal,
                    y: item.startFrame
                }, {
                    x: item.endVal,
                    y: item.endFrame
                }], intervalometer.status.frames);
                if(item.endFrame < intervalometer.status.frames) {
                    delete intervalometer.status.dynamicChange[param];
                }
            }
        }
    }
}

// changes 'parameter' to 'newValue' across 'frames'
// parameter can be: interval, dayInterval, nightInterval, nightCompensation, exposureOffset, mode (immediate)
intervalometer.dynamicChange = function(parameter, newValue, frames, callback) {
    var rampableChange = ['interval', 'dayInterval', 'nightInterval', 'nightCompensation'];
    var specialChange = ['rampMode', 'hdrCount', 'hdrStops'];

    if(rampableChange.indexOf(parameter) !== -1) {
        if(!frames || frames < 1) frames = 1;
        intervalometer.status.dynamicChange[parameter] = {
            startVal: intervalometer.currentProgram[parameter],
            endVal: newValue,
            startFrame: intervalometer.status.frames,
            endFrame: intervalometer.status.frames + frames
        };
        callback && callback();
    } else if(specialChange.indexOf(parameter) !== -1) {
        switch(parameter) {
            case 'rampMode':
                if(newValue == 'auto') {
                    status.rampMode = 'auto';
                    if(status.rampEv == null) intervalometer.status.rampEv = camera.lists.getEvFromSettings(camera.ptp.settings); 
                }
                if(newValue == 'lock') {
                    if(status.rampEv == null) intervalometer.status.rampEv = camera.lists.getEvFromSettings(camera.ptp.settings); 
                    status.rampMode = 'fixed';
                }
                break;

            case 'hdrCount':
            case 'hdrStops':
                intervalometer.currentProgram[parameter] = newValue;
                planHdr(intervalometer.currentProgram.hdrCount, intervalometer.currentProgram.hdrStops);
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
            program[key] = updates[key];
        }
    }
    callback && callback();
}

module.exports = intervalometer;