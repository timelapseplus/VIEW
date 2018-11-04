/*jslint node:true,vars:true,bitwise:true */
'use strict';
var startupTime = new Date();
var VIEW_HARDWARE = true; // is this running on official VIEW hardware?

var nodeModuleCache = require('fast-boot');
nodeModuleCache.start({cacheFile: "/home/view/current/module-locations-cache.json"});

console.log('Starting up...');

var _ = require('underscore');
var async = require('async');
var exec = require('child_process').exec;
var crypto = require('crypto');
var fs = require('fs');
var moment = require('moment');
console.log('Basic modules loaded in ' + (new Date() - startupTime) + 'ms');

var sys = require('sys')
console.log('System modules loaded in ' + (new Date() - startupTime) + 'ms');

require('rootpath')();
var lists = require('./camera/ptp/lists.js');
console.log('Lists module loaded in ' + (new Date() - startupTime) + 'ms');
var updates = require('./system/updates.js');
console.log('Updates module loaded in ' + (new Date() - startupTime) + 'ms');
var clips = require('./intervalometer/clips.js');
console.log('Clips module loaded in ' + (new Date() - startupTime) + 'ms');
var eclipse = require('./intervalometer/eclipse.js');
console.log('Eclipse module loaded in ' + (new Date() - startupTime) + 'ms');
var core = require('./intervalometer/intervalometer-client.js');
console.log('Core client module loaded in ' + (new Date() - startupTime) + 'ms');
var image = require('./camera/image/image.js');
console.log('Image module loaded in ' + (new Date() - startupTime) + 'ms');

if (VIEW_HARDWARE) {
    var power = require('./hardware/power.js');
    console.log('Power module loaded in ' + (new Date() - startupTime) + 'ms');
    var light = require('./hardware/light.js');
    console.log('Light module loaded in ' + (new Date() - startupTime) + 'ms');
    var oled = require('./hardware/oled.js');
    console.log('Oled module loaded in ' + (new Date() - startupTime) + 'ms');
    var ui = require('./interface/ui.js');
    console.log('UI module loaded in ' + (new Date() - startupTime) + 'ms');
    var help = require('./interface/help.js');
    console.log('Help module loaded in ' + (new Date() - startupTime) + 'ms');
    var inputs = require('./hardware/inputs.js');
    console.log('Inputs module loaded in ' + (new Date() - startupTime) + 'ms');
    var mcu = require('./hardware/mcu.js');
    console.log('MCU module loaded in ' + (new Date() - startupTime) + 'ms');
}

var wifi = require('./system/wifi.js');

console.log('Wifi module loaded in ' + (new Date() - startupTime) + 'ms');

if(power) wifi.power = power; // allow wifi module to control power
var app = require("./system/app.js");
var db = require("./system/db.js");

//var suncalc = require('suncalc');
var meeus = require('meeusjs');

console.log('System loaded in ' + (new Date() - startupTime) + 'ms');

var previewImage = null;
var liveviewOn = false;
var liveviewOnApp = false;
var liveviewOnAppTimeout = null;
var liveviewOnStream = false;
var liveviewRequestStart = false;
var previewImageLastTime = new Date();
var gpsExists = null;

var cache = {};
var gestureString = "";

var Segfault = require('segfault');
Segfault.registerHandler("segfault.log");
//var Segfault = require('segfault-handler');
//Segfault.registerHandler("crash.log", function(signal, address, stack) {
//    console.log("recevied SIGSEGV, killing process...");
//    process.kill(process.pid, 'SIGKILL');
//});
var nodeCleanup = require('node-cleanup');

process.stdin.resume();

console.log('Modules loaded in ' + (new Date() - startupTime) + 'ms');

updates.cleanup(); // cleanup old version installations

if (VIEW_HARDWARE) {
    updates.updateUBoot(function(err) {
        updates.updateKernel(function(err, reboot) {
            if(reboot) {
                closeSystem(function(){
                    power.reboot();
                });
            }
        });
    });
    updates.installIcons();
    oled.init();
    mcu.init(function(err){
        var useInputsForKnob = err ? true : false;
        console.log("Using MCU for knob: ", !useInputsForKnob);
        inputs.start({knob:useInputsForKnob, mcu: mcu});
    });

    var configureWifi = function() {
        db.get('wifi-ap-pass', function(err, wifiApPass) {
            wifi.setApPass(wifiApPass);
            db.get('wifi-ap-name', function(err, wifiApName) {
                console.log("wifi-ap-name:", wifiApName);
                wifi.setApName(wifiApName);
                db.get('wifi-status', function(err, wifiStatus) {
                    if(wifiStatus) {
                        if(wifiStatus.enabled) {
                            wifi.btEnabled = true;
                            wifi.enable(function(){
                                setTimeout(function(){
                                    db.get('bt-status', function(err, status) {
                                        if(status && status.enabled) {
                                            wifi.enableBt();
                                            console.log("MAIN: enabling bluetooth", wifi.btEnabled);
                                        } else {
                                            wifi.disableBt();
                                            console.log("MAIN: disabling bluetooth", wifi.btEnabled);
                                        }
                                        if(!wifi.connected) {
                                            if(wifiStatus.apMode) {
                                                wifi.enableAP();
                                            }
                                            if(wifiStatus.connect) {
                                                wifi.connect(wifiStatus.connect, wifiStatus.password);
                                            }
                                        }
                                    });
                                },5000);
                            });
                        } else {
                            wifi.disable();
                        }
                    } else {
                        wifi.btEnabled = true;
                        wifi.enable(function(){
                            setTimeout(function(){
                                db.get('bt-status', function(err, status) {
                                    if(status && status.enabled) {
                                        wifi.enableBt();
                                        console.log("MAIN: enabling bluetooth", wifi.btEnabled);
                                    } else {
                                        wifi.disableBt();
                                        console.log("MAIN: disabling bluetooth", wifi.btEnabled);
                                    }
                                });

                                if(!wifi.connected) {
                                    wifi.enableAP();
                                }
                            },5000);
                        });
                    }
                });
            });
        });
    }
    configureWifi();

    var ERRORCOMPILING = "An error occurred while building the latest libgphoto2 code for camera support. Please report this to support@timelapseplus.com.\nSystem message:\n";
    var SUCCESS = "The camera support library has been successfully updated!  Your VIEW intervalometer can now support the latest camera models.";
    var updateLibGPhoto2 = function() {
        ui.confirmationPrompt("Update camera support library?", "Update", "cancel", help.updateCameraLibrary, function(cb){
            cb();
            var backupStatus = ui.defaultStatusString;
            ui.defaultStatus("updating camera support");
            console.log("installing libgphoto2...");
            updates.installLibGPhoto(function(err){
                ui.defaultStatus(backupStatus);
                process.nextTick(function(){
                    if(err) { // error compiling
                        console.log("error installing libgphoto2", err);
                        ui.alert('Error', ERRORCOMPILING + err);
                    } else {
                        console.log("successfully installed libgphoto2");
                        ui.alert('Success', SUCCESS);
                    }
                });
            });
        }, null);
    }

    updates.checkLibGPhotoUpdate(function(err, needUpdate){
        if(!err && needUpdate) {
            console.log("libgphoto2 update available!");
            updateLibGPhoto2();
        } else {
            console.log("error checking libgphoto2 version:", err);
        }
    });

    var wifiWasDisabled = false;
    var wifiConnectionTime = 0;
    wifi.on('resetBt', function(){
        console.log("BT: btReset event");
        if(wifi.btEnabled) {
            console.log("BT: reloading motion system");
            core.resetBt();
        }
    });
    wifi.on('connect', function(ssid) {
        app.enableRemote(updates.version);
        oled.setIcon('wifi', true);
        wifiConnectionTime = new Date().getTime();
        ui.status('wifi connected to ' + ssid);
        if(ssid.substr(0, 7) == "DIRECT-") core.connectSonyWifi();
        ui.reload();
    });
    wifi.on('enabled', function(reload) {
        app.disableRemote();
        oled.setIcon('wifi', false);
        if(wifiWasDisabled) {
            wifiWasDisabled = false;
        }
        if(reload) ui.reload();
    });
    wifi.on('disabled', function(reload) {
        wifiWasDisabled = true;
        app.disableRemote();
        oled.setIcon('wifi', false);
        if(reload) ui.reload();
    });
    wifi.on('error', function(message) {
        ui.alert('Error', message);
    });
    wifi.on('disconnect', function(previousConnection) {
        app.disableRemote();
        oled.setIcon('wifi', false);
        ui.status('wifi disconnected');
        if(previousConnection && previousConnection.address && !wifi.invalidPassword) {
            var currentTime = new Date().getTime();
            if(currentTime - wifiConnectionTime < 30 * 1000) {
                // show alert -- authentication probably failed
                console.log("WIFI: failed to connect to " + previousConnection.ssid);
                ui.alert('Error', "WiFi failed to connect to " + previousConnection.ssid + ".\nTry again, double-checking that the password is correct.\nNote: if it continues to fail to connect, try a different access point if possible.");
            } else {
                console.log("WIFI: disconnected, trying to reconnect to " + previousConnection.ssid);
                wifiConnectionTime = new Date().getTime();
                var btMotion = false;
                if(core.motionStatus.nmxConnectedBt || core.motionStatus.gmConnectedBt) btMotion = true;
                if(core.intervalometerStatus.running && btMotion) { // don't reset wifi module if BT motion is connected
                    db.get('wifi-status', function(err, wifiStatus) {
                        if(wifiStatus && wifiStatus.enabled && wifiStatus.connect) {
                            wifi.connect(wifiStatus.connect, wifiStatus.password);
                        }
                    });
                } else {
                    wifi.disable(function(){
                        setTimeout(configureWifi, 2000);
                    });
                }
            }
        }
        ui.reload();
    });

    var updateAppBattery = function() {
        app.send('battery', {
            percentage: power.percentage,
            charging: power.charging
        });
    }

    power.on('charging', function(status) {
        updateAppBattery();
        oled.chargeStatus(status);
    });

    power.on('warning', function(status) {
        if(status) ui.status('low battery');
    });

    power.on('percentage', function(percentage) {
        updateAppBattery();
        oled.batteryPercentage(percentage);
    });

    power.on('shutdown', function() {
        console.log("CRTICIAL BATTERY LEVEL: shutting down now!");
        shutdownNow();
    });

    var rampingOptions = {
        name: "timelapse mode",
        type: "options",
        items: [{
            name: "Timelapse Mode",
            value: "Basic - Fixed",
            help: help.rampingOptions,
            action: ui.set(core.currentProgram, 'rampMode', 'fixed', function(){
                core.currentProgram = reconfigureProgram(core.currentProgram);
                ui.back();
            })
        }, {
            name: "Timelapse Mode",
            value: "Auto Ramping",
            help: help.rampingOptions,
            action: ui.set(core.currentProgram, 'rampMode', 'auto', function(){
                core.currentProgram = reconfigureProgram(core.currentProgram);
                ui.back();
            })
        }, {
            name: "Timelapse Mode",
            value: "Eclipse Mode",
            help: help.rampingOptions,
            action: ui.set(core.currentProgram, 'rampMode', 'eclipse', function(){
                core.currentProgram = reconfigureProgram(core.currentProgram);
                ui.back();
            }),
            condition: function() {
                return getEclipseData();
            }
        }]
    }

    var lrtDirection = {
        name: "timelapse mode",
        type: "options",
        items: [{
            name: "Ramp Direction",
            value: "Auto Ramping",
            help: help.lrtDirection,
            action: ui.set(core.currentProgram, 'rampMode', 'auto', function(){
                core.currentProgram = reconfigureProgram(core.currentProgram);
                ui.back();
            })
        }, {
            name: "Ramp Direction",
            value: "Auto Sunset",
            help: help.lrtDirection,
            action: ui.set(core.currentProgram, 'rampMode', 'sunset', function(){
                core.currentProgram = reconfigureProgram(core.currentProgram);
                ui.back();
            })
        }, {
            name: "Ramp Direction",
            value: "Auto Sunrise",
            help: help.lrtDirection,
            action: ui.set(core.currentProgram, 'rampMode', 'sunrise', function(){
                core.currentProgram = reconfigureProgram(core.currentProgram);
                ui.back();
            }),
        }]
    }

    var reconfigureProgram = function(program) {
        if(!program.exposurePlans) program.exposurePlans = [];
        if(program.rampMode == 'sunset' || program.rampMode == 'sunrise') {
            program.lrtDirection = program.rampMode;
            program.rampMode = 'auto';
        }
        if(program.rampMode == 'auto') {
            program.exposurePlans = [];
        } else if(program.rampMode == 'eclipse') {
            var coords = mcu.validCoordinates();
            program.exposurePlans = [];
            var data = getEclipseData();
            if(data != null) {
                if(data.c1_timestamp > new Date()) {
                    program.exposurePlans.push({name: 'Pre-eclipse', start: new Date(), mode: 'locked', hdrCount: 0, intervalMode: 'fixed', interval: 12});
                }
                if(data.c2_timestamp && data.c3_timestamp) { // total eclipse
                    program.exposurePlans.push({name: 'Partial (C1-C2)', start: data.c1_timestamp, mode: 'preset', hdrCount: 0, intervalMode: 'fixed', interval: 12, shutter: 6, iso: 0, aperture: -3});
                    program.exposurePlans.push({name: 'Baily\'s Beads (C2)', start: data.c2_timestamp - 20000, mode: 'preset', hdrCount: 0, intervalMode: 'fixed', interval: 2, shutter: 5, iso: 0, aperture: -3});
                    program.exposurePlans.push({name: 'Totality (C2-C3)', start: data.c2_timestamp, mode: 'preset', hdrCount: 3, hdrStops: 2, intervalMode: 'fixed', interval: 10, shutter: -3, iso: -1, aperture: -4});
                    program.exposurePlans.push({name: 'Baily\'s Beads (C3)', start: data.c3_timestamp - 12000, mode: 'preset', hdrCount: 0, intervalMode: 'fixed', interval: 2, shutter: 5, iso: 0, aperture: -3});
                    program.exposurePlans.push({name: 'Partial (C3-C4)', start: data.c3_timestamp + 8000, mode: 'preset', hdrCount: 0, intervalMode: 'fixed', interval: 12, shutter: 6, iso: 0, aperture: -3});
                } else {
                    program.exposurePlans.push({name: 'Partial (C1-C4)', start: data.c1_timestamp, mode: 'preset', hdrCount: 0, intervalMode: 'fixed', interval: 12, shutter: 6, iso: 0, aperture: -3});
                }
                program.exposurePlans.push({name: 'Post-eclipse', start: data.c4_timestamp, mode: 'auto', hdrCount: 0, intervalMode: 'auto', dayInterval: 12, nightInterval: 36});
            } else {
                ui.alert('error', "Unable to calculate eclipse data");
                app.send('error', {
                    error: "Unable to calculate eclipse data"
                });
            }
        } else {
            program.exposurePlans = [];
        }
        return program;
    }

    var rampingOptionsPlan = function(planIndex) {
        if(!core.currentProgram.exposurePlans[planIndex]) core.currentProgram.exposurePlans[planIndex] = {};
        if(!core.currentProgram.exposurePlans[planIndex].mode) core.currentProgram.exposurePlans[planIndex].mode = 'auto';
        return {
            name: "timelapse mode",
            type: "options",
            items: [{
                name: "Timelapse Mode",
                value: "Preset Exposure",
                help: help.rampingOptions,
                action: ui.set(core.currentProgram.exposurePlans[planIndex], 'mode', 'preset')
            }, {
                name: "Timelapse Mode",
                value: "Auto Ramping",
                help: help.rampingOptions,
                action: ui.set(core.currentProgram.exposurePlans[planIndex], 'mode', 'auto')
            }, {
                name: "Timelapse Mode",
                value: "Lock Exposure",
                help: help.rampingOptions,
                action: ui.set(core.currentProgram.exposurePlans[planIndex], 'mode', 'locked')
            }]
        }
    }

    var intervalOptionsPlan = function(planIndex) {
        if(!core.currentProgram.exposurePlans[planIndex]) core.currentProgram.exposurePlans[planIndex] = {};
        if(!core.currentProgram.exposurePlans[planIndex].intervalMode) core.currentProgram.exposurePlans[planIndex].intervalMode = 'fixed';
        return {
            name: "timelapse mode",
            type: "options",
            items: [{
                name: "Interval Mode",
                value: "Fixed Interval",
                help: help.intervalOptions,
                action: ui.set(core.currentProgram.exposurePlans[planIndex], 'intervalMode', 'fixed')
            }, {
                name: "Interval Mode",
                value: "Auto Variable",
                help: help.intervalOptions,
                action: ui.set(core.currentProgram.exposurePlans[planIndex], 'intervalMode', 'auto')
            }]
        }
    }

    var rampingAlgorithmOptions = {
        name: "ramping algorithm",
        type: "options",
        items: [{
            name: "Ramping Algorithm",
            value: "PID Luminance",
            help: help.rampingAlgorithmLuminance,
            action: ui.set(core.currentProgram, 'rampAlgorithm', 'lum', function(){
                core.currentProgram = reconfigureProgram(core.currentProgram);
                ui.back();
            }),
        }, {
            name: "Ramping Algorithm",
            value: "LRTimelapse",
            help: help.rampingAlgorithmLRTimelapse,
            action: ui.set(core.currentProgram, 'rampAlgorithm', 'lrt', function(){
                core.currentProgram = reconfigureProgram(core.currentProgram);
                ui.back();
            })
        /*}, {
            name: "Ramping Algorithm",
            value: "GPS Ramping",
            help: help.rampingAlgorithmGPS,
            action: ui.set(core.currentProgram, 'rampAlgorithm', 'gps')
            */
        }]
    }

    var highlightProtectionOptions = {
        name: "highlight protection",
        type: "options",
        items: [{
            name: "Highlight Protection",
            value: "Enabled",
            help: help.highlightProtection,
            action: ui.set(core.currentProgram, 'highlightProtection', true),
        }, {
            name: "Highlight Protection",
            value: "Disabled",
            help: help.highlightProtection,
            action: ui.set(core.currentProgram, 'highlightProtection', false)
        }]
    }

    var framesOptions = {
        name: "frames",
        type: "options",
        items: [{
            name: "Frames",
            value: "100",
            help: help.framesOptions,
            action: ui.set(core.currentProgram, 'frames', 100)
        }, {
            name: "Frames",
            value: "200",
            help: help.framesOptions,
            action: ui.set(core.currentProgram, 'frames', 200)
        }, {
            name: "Frames",
            value: "300",
            help: help.framesOptions,
            action: ui.set(core.currentProgram, 'frames', 300)
        }, {
            name: "Frames",
            value: "400",
            help: help.framesOptions,
            action: ui.set(core.currentProgram, 'frames', 400)
        }, {
            name: "Frames",
            value: "500",
            help: help.framesOptions,
            action: ui.set(core.currentProgram, 'frames', 500)
        }, {
            name: "Frames",
            value: "600",
            help: help.framesOptions,
            action: ui.set(core.currentProgram, 'frames', 600)
        }, {
            name: "Frames",
            value: "700",
            help: help.framesOptions,
            action: ui.set(core.currentProgram, 'frames', 700)
        }, {
            name: "Frames",
            value: "800",
            help: help.framesOptions,
            action: ui.set(core.currentProgram, 'frames', 800)
        }, {
            name: "Frames",
            value: "900",
            help: help.framesOptions,
            action: ui.set(core.currentProgram, 'frames', 900)
        }, {
            name: "Frames",
            value: "1200",
            help: help.framesOptions,
            action: ui.set(core.currentProgram, 'frames', 1200)
        }, {
            name: "Frames",
            value: "1500",
            help: help.framesOptions,
            action: ui.set(core.currentProgram, 'frames', 1500)
        }, {
            name: "Frames",
            value: "1800",
            help: help.framesOptions,
            action: ui.set(core.currentProgram, 'frames', 1800)
        }, {
            name: "Frames",
            value: "Until Stopped",
            help: help.framesOptions,
            action: ui.set(core.currentProgram, 'frames', Infinity)
        }]
    }

    var intervalOptions = {
        name: "interval mode",
        type: "options",
        items: [{
            name: "Interval Mode",
            value: "Fixed Length",
            help: help.intervalOptions,
            action: ui.set(core.currentProgram, 'intervalMode', 'fixed')
        }, {
            name: "Interval Mode",
            value: "Auto Variable",
            help: help.intervalOptions,
            action: ui.set(core.currentProgram, 'intervalMode', 'auto')
        }, {
            name: "Interval Mode",
            value: "External AUX2",
            help: help.intervalOptions,
            action: ui.set(core.currentProgram, 'intervalMode', 'aux')
        }]
    }

    var trackingOptions = {
        name: "Tracking",
        type: "options",
        items: [{
            name: "Motion Tracking",
            value: "disabled",
            help: help.trackingOptions,
            action: ui.set(core.currentProgram, 'tracking', 'none')
        }, {
            name: "Motion Tracking",
            value: "15°/hour pan",
            help: help.trackingOptions,
            action: ui.set(core.currentProgram, 'tracking', '15deg')
        }, {
            name: "Motion Tracking",
            value: "Follow Sun",
            help: help.trackingOptions,
            action: ui.set(core.currentProgram, 'tracking', 'sun'),
            condition: function() {
                var enabled = mcu.validCoordinates();
                if(!enabled && core.currentProgram.tracking == 'sun') core.currentProgram.tracking = 'none';
                return enabled;
            }
        }, {
            name: "Motion Tracking",
            value: "Follow Moon",
            help: help.trackingOptions,
            action: ui.set(core.currentProgram, 'tracking', 'moon'),
            condition: function() {
                var enabled = mcu.validCoordinates();
                if(!enabled && core.currentProgram.tracking == 'moon') core.currentProgram.tracking = 'none';
                return enabled;
            }
        }]
    }

    var trackingPanMotorMenu = function(cb) {
        var m = {
            name: "Tracking Pan",
            type: "options"
        }
        m.items = [];
        m.items.push({
            name: "Tracking Pan Motor",
            value: "Disabled",
            help: help.trackingPanMotor,
            action: ui.set(core.currentProgram, 'trackingPanMotor', 'none', function() {
                    ui.back();
                    ui.back();
            })
        });
        for(var i = 0; i < core.motionStatus.motors.length; i++) {
            var motor = core.motionStatus.motors[i];
            if(motor.connected) {
                m.items.push({
                    name: "Tracking Pan Motor",
                    //name: motor.driver + " Axis" + motor.motor + "",
                    value: motor.driver + " Axis" + motor.motor + "", //motor.driver + motor.motor,
                    help: help.trackingPanMotor,
                    action: ui.set(core.currentProgram, 'trackingPanMotor', motor.driver + motor.motor, function(){
                        ui.back();
                        ui.back();
                    })
                });
                m.items.push({
                    name: "Tracking Pan Motor",
                    //name: motor.driver + " Axis" + motor.motor + " (reverse)",
                    value: motor.driver + " Axis" + motor.motor + " (rev)",//motor.driver + motor.motor,
                    help: help.trackingPanMotor,
                    action: ui.set(core.currentProgram, 'trackingPanMotor', motor.driver + motor.motor + 'r', function(){
                        ui.back();
                        ui.back();
                    })
                });
            }
        }
        return cb(null, m);
    };

    var trackingTiltMotorMenu = function(cb) {
        var m = {
            name: "Tracking Tilt",
            type: "options"
        }
        m.items = [];
        m.items.push({
            name: "Tracking Tilt Motor",
            value: "Disabled",
            help: help.trackingTiltMotor,
            action: ui.set(core.currentProgram, 'trackingTiltMotor', 'none', function() {
                ui.back();
                ui.back();
            })
        });
        for(var i = 0; i < core.motionStatus.motors.length; i++) {
            var motor = core.motionStatus.motors[i];
            if(motor.connected) {
                m.items.push({
                    name: "Tracking Tilt Motor",
                    value: motor.driver + " Axis" + motor.motor + "",
                    help: help.trackingTiltMotor,
                    action: ui.set(core.currentProgram, 'trackingTiltMotor', motor.driver + motor.motor, function() {
                        ui.back();
                        ui.back();
                    })
                });
                m.items.push({
                    name: "Tracking Tilt Motor",
                    value: motor.driver + " Axis" + motor.motor + " (rev)",
                    help: help.trackingTiltMotor,
                    action: ui.set(core.currentProgram, 'trackingTiltMotor', motor.driver + motor.motor + 'r', function() {
                        ui.back();
                        ui.back();
                    })
                });
            }
        }
        return cb(null, m);
    };

    var destinationOptions = {
        name: "destination",
        type: "options",
        items: [{
            name: "Save To",
            value: "Camera",
            help: help.destinationOptions,
            action: ui.set(core.currentProgram, 'destination', 'camera')
        }, {
            name: "Save To",
            value: "SD Card",
            help: help.destinationOptions,
            action: ui.set(core.currentProgram, 'destination', 'sd')
        }]
    }

    var nightInterval = {
        name: "night interval",
        type: "options",
        items: []
    }
    for (var i = 6; i < 12; i++) nightInterval.items.push({
        name: "Night Interval",
        help: help.nightInterval,
        value: i + " seconds",
        action: ui.set(core.currentProgram, 'nightInterval', i)
    });
    for (var i = 12; i < 35; i += 2) nightInterval.items.push({
        name: "Night Interval",
        help: help.nightInterval,
        value: i + " seconds",
        action: ui.set(core.currentProgram, 'nightInterval', i)
    });
    for (var i = 35; i < 90; i += 5) nightInterval.items.push({
        name: "Night Interval",
        help: help.nightInterval,
        value: i + " seconds",
        action: ui.set(core.currentProgram, 'nightInterval', i)
    });

    var nightIntervalPlan = function(planIndex) {
        if(!core.currentProgram.exposurePlans[planIndex]) core.currentProgram.exposurePlans[planIndex] = {};
        if(!core.currentProgram.exposurePlans[planIndex].nightInterval) core.currentProgram.exposurePlans[planIndex].nightInterval = 30;

        var res = {
            name: "night interval",
            type: "options",
            items: []
        }
        for (var i = 6; i < 12; i += 0.5) res.items.push({
            name: "Night Interval",
            help: help.nightInterval,
            value: i + " seconds",
            action: ui.set(core.currentProgram.exposurePlans[planIndex], 'nightInterval', i)
        });
        for (var i = 12; i < 35; i += 1) res.items.push({
            name: "Night Interval",
            help: help.nightInterval,
            value: i + " seconds",
            action: ui.set(core.currentProgram.exposurePlans[planIndex], 'nightInterval', i)
        });
        for (var i = 35; i < 90; i += 5) res.items.push({
            name: "Night Interval",
            help: help.nightInterval,
            value: i + " seconds",
            action: ui.set(core.currentProgram.exposurePlans[planIndex], 'nightInterval', i)
        });

        return res;
    }

    var dayInterval = {
        name: "day interval",
        type: "options",
        items: []
    }
    for (var i = 2; i < 5; i += 0.2) {
        i = Math.floor(i * 10) / 10;
        dayInterval.items.push({
            name: "Day Interval",
            help: help.dayInterval,
            value: i + " seconds",
            action: ui.set(core.currentProgram, 'dayInterval', i)
        });
    }
    for (var i = 5; i < 12; i++) dayInterval.items.push({
        name: "Day Interval",
        help: help.dayInterval,
        value: i + " seconds",
        action: ui.set(core.currentProgram, 'dayInterval', i)
    });
    for (var i = 12; i < 35; i += 2) dayInterval.items.push({
        name: "Day Interval",
        help: help.dayInterval,
        value: i + " seconds",
        action: ui.set(core.currentProgram, 'dayInterval', i)
    });
    for (var i = 35; i < 90; i += 5) dayInterval.items.push({
        name: "Day Interval",
        help: help.dayInterval,
        value: i + " seconds",
        action: ui.set(core.currentProgram, 'dayInterval', i)
    });

    var dayIntervalPlan = function(planIndex) {
        if(!core.currentProgram.exposurePlans[planIndex]) core.currentProgram.exposurePlans[planIndex] = {};
        if(!core.currentProgram.exposurePlans[planIndex].dayInterval) core.currentProgram.exposurePlans[planIndex].dayInterval = 6;
        var res = {
            name: "day interval",
            type: "options",
            items: []
        }
        for (var i = 2; i < 5; i += 0.2) {
            i = Math.floor(i * 10) / 10;
            res.items.push({
                name: "Day Interval",
                help: help.dayInterval,
                value: i + " seconds",
                action: ui.set(core.currentProgram.exposurePlans[planIndex], 'dayInterval', i)
            });
        }
        for (var i = 5; i < 12; i += 0.5) res.items.push({
            name: "Day Interval",
            help: help.dayInterval,
            value: i + " seconds",
            action: ui.set(core.currentProgram.exposurePlans[planIndex], 'dayInterval', i)
        });
        for (var i = 12; i < 35; i += 1) res.items.push({
            name: "Day Interval",
            help: help.dayInterval,
            value: i + " seconds",
            action: ui.set(core.currentProgram.exposurePlans[planIndex], 'dayInterval', i)
        });
        for (var i = 35; i < 90; i += 5) res.items.push({
            name: "Day Interval",
            help: help.dayInterval,
            value: i + " seconds",
            action: ui.set(core.currentProgram.exposurePlans[planIndex], 'dayInterval', i)
        });

        return res;
    }


    var interval = {
        name: "interval",
        type: "options",
        items: []
    }
    for (var i = 1.8; i < 5; i += 0.2) {
        i = Math.floor(i * 10) / 10;
        interval.items.push({
            name: "Interval",
            help: help.interval,
            value: i + " seconds",
            action: ui.set(core.currentProgram, 'interval', i)
        });
    }
    for (var i = 5; i < 12; i += 0.5) interval.items.push({
        name: "Interval",
        help: help.interval,
        value: i + " seconds",
        action: ui.set(core.currentProgram, 'interval', i)
    });
    for (var i = 12; i < 35; i += 1) interval.items.push({
        name: "Interval",
        help: help.interval,
        value: i + " seconds",
        action: ui.set(core.currentProgram, 'interval', i)
    });
    for (var i = 35; i < 90; i += 5) interval.items.push({
        name: "Interval",
        help: help.interval,
        value: i + " seconds",
        action: ui.set(core.currentProgram, 'interval', i)
    });
    for (var i = 2; i < 15; i += 1) interval.items.push({
        name: "Interval",
        help: help.interval,
        value: i + " minutes",
        action: ui.set(core.currentProgram, 'interval', i * 60)
    });

    var intervalPlan = function(planIndex) {
        if(!core.currentProgram.exposurePlans[planIndex]) core.currentProgram.exposurePlans[planIndex] = {};
        if(!core.currentProgram.exposurePlans[planIndex].interval) core.currentProgram.exposurePlans[planIndex].interval = 6;
    
        var res = {
            name: "interval",
            type: "options",
            items: []
        }
        for (var i = 1.8; i < 5; i += 0.2) {
            i = Math.floor(i * 10) / 10;
            res.items.push({
                name: "Interval",
                help: help.interval,
                value: i + " seconds",
                action: ui.set(core.currentProgram.exposurePlans[planIndex], 'interval', i)
            });
        }
        for (var i = 5; i < 12; i++) res.items.push({
            name: "Interval",
            help: help.interval,
            value: i + " seconds",
            action: ui.set(core.currentProgram.exposurePlans[planIndex], 'interval', i)
        });
        for (var i = 12; i < 35; i += 2) res.items.push({
            name: "Interval",
            help: help.interval,
            value: i + " seconds",
            action: ui.set(core.currentProgram.exposurePlans[planIndex], 'interval', i)
        });
        for (var i = 35; i < 90; i += 5) res.items.push({
            name: "Interval",
            help: help.interval,
            value: i + " seconds",
            action: ui.set(core.currentProgram.exposurePlans[planIndex], 'interval', i)
        });
        for (var i = 2; i < 15; i += 1) res.items.push({
            name: "Interval",
            help: help.interval,
            value: i + " minutes",
            action: ui.set(core.currentProgram.exposurePlans[planIndex], 'interval', i * 60)
        });

        return res;
    }

    var rampParameters = {
        name: "Ramp Parameters",
        type: "options",
        items: [{
            name: "Ramp Parameters",
            help: help.rampParameters,
            value: "Shutter, ISO",
            action: ui.set(core.currentProgram, 'rampParameters', 'S+I')
        }, {
            name: "Ramp Parameters",
            help: help.rampParameters,
            value: "Sh, ISO (balanced)",
            action: ui.set(core.currentProgram, 'rampParameters', 'S=I')
        }, {
            name: "Ramp Parameters",
            help: help.rampParameters,
            value: "Sh, Aperture, ISO",
            action: ui.set(core.currentProgram, 'rampParameters', 'S+A+I')
        }]
    };

    var manualAperture = {
        name: "Manual Aperture",
        type: "options",
        items: []
    }
    for (var i = 0; i < lists.aperture.length; i++) {
        if(lists.aperture[i].ev != null) {
            manualAperture.items.push({
                name: "Manual Aperture",
                help: help.manualAperture,
                value: lists.aperture[i].name,
                action: ui.set(core.currentProgram, 'manualAperture', lists.aperture[i].ev)
            });
        }
    }

    var apertureMin = {
        name: "Min Aperture",
        type: "options",
        items: []
    }
    apertureMin.items.push({
        name: "Min Aperture",
        help: help.apertureMin,
        value: "no min limit",
        action: ui.set(core.currentProgram, 'apertureMin', null)
    });
    for (var i = 0; i < lists.aperture.length; i++) {
        if(lists.aperture[i].ev != null) {
            var ev = lists.aperture[i].ev;
            apertureMin.items.push({
                name: "Min Aperture",
                help: help.apertureMin,
                value: lists.aperture[i].name,
                action: ui.set(core.currentProgram, 'apertureMin', lists.aperture[i].ev),
                condition: (function(aEv) { return function(){
                    return (core.currentProgram.apertureMax == null || aEv <= core.currentProgram.apertureMax);
                } })(ev)
            });
        }
    }

    var apertureMax = {
        name: "Max Aperture",
        type: "options",
        items: []
    }
    apertureMax.items.push({
        name: "Max Aperture",
        help: help.apertureMax,
        value: "no max limit",
        action: ui.set(core.currentProgram, 'apertureMax', null)
    });
    for (var i = 0; i < lists.aperture.length; i++) {
        if(lists.aperture[i].ev != null) {
            var ev = lists.aperture[i].ev;
            apertureMax.items.push({
                name: "Max Aperture",
                help: help.apertureMax,
                value: lists.aperture[i].name,
                action: ui.set(core.currentProgram, 'apertureMax', lists.aperture[i].ev),
                condition: (function(aEv) { return function(){
                    return (core.currentProgram.apertureMin == null || aEv >= core.currentProgram.apertureMin);
                } })(ev)
            });
        }
    }

    var isoMax = {
        name: "Maximum ISO",
        type: "options",
        items: []
    }
    isoMax.items.push({
        name: "Maximum ISO",
        help: help.isoMax,
        value: "no max limit",
        action: ui.set(core.currentProgram, 'isoMax', null)
    });
    for (var i = 0; i < lists.iso.length; i++) {
        if(lists.iso[i].ev != null && lists.iso[i].ev <= -2) {
            isoMax.items.push({
                name: "Maximum ISO",
                help: help.isoMax,
                value: lists.iso[i].name,
                action: ui.set(core.currentProgram, 'isoMax', lists.iso[i].ev)
            });
        }
    }

    var isoMin = {
        name: "Minimum ISO",
        type: "options",
        items: []
    }
    isoMin.items.push({
        name: "Minimum ISO",
        help: help.isoMin,
        value: "no min limit",
        action: ui.set(core.currentProgram, 'isoMin', null)
    });
    for (var i = 0; i < lists.iso.length; i++) {
        if(lists.iso[i].ev != null && lists.iso[i].ev >= -3) {
            isoMin.items.push({
                name: "Minimum ISO",
                help: help.isoMin,
                value: lists.iso[i].name,
                action: ui.set(core.currentProgram, 'isoMin', lists.iso[i].ev)
            });
        }
    }

    var shutterMax = {
        name: "Max Shutter Length",
        type: "options",
        items: []
    }
    shutterMax.items.push({
        name: "Max Shutter Length",
        help: help.shutterMax,
        value: "no limit",
        action: ui.set(core.currentProgram, 'shutterMax', null)
    });
    for (var i = 0; i < lists.shutter.length; i++) {
        if(lists.shutter[i].ev != null && lists.shutter[i].ev <= -6) {
            shutterMax.items.push({
                name: "Max Shutter Length",
                help: help.shutterMax,
                value: lists.shutter[i].name,
                action: ui.set(core.currentProgram, 'shutterMax', lists.shutter[i].ev)
            });
        }
    }

    var isoPlan = function(planIndex) {
        var res = {
            name: "ISO",
            type: "options",
            items: []
        }
        for (var i = 0; i < lists.iso.length; i++) {
            if(lists.iso[i].ev != null) {
                res.items.push({
                    name: "ISO",
                    help: "",
                    value: lists.iso[i].name,
                    action: ui.set(core.currentProgram.exposurePlans[planIndex], 'iso', lists.iso[i].ev)
                });
            }
        }
        return res;
    }

    var shutterPlan = function(planIndex) {
        var res = {
            name: "Shutter",
            type: "options",
            items: []
        }
        for (var i = 0; i < lists.shutter.length; i++) {
            if(lists.shutter[i].ev != null) {
                res.items.push({
                    name: "Shutter",
                    help: "",
                    value: lists.shutter[i].name,
                    action: ui.set(core.currentProgram.exposurePlans[planIndex], 'shutter', lists.shutter[i].ev)
                });
            }
        }
        return res;
    }

    var aperturePlan = function(planIndex) {
        var res = {
            name: "Aperture",
            type: "options",
            items: []
        }
        for (var i = 0; i < lists.aperture.length; i++) {
            if(lists.aperture[i].ev != null) {
                res.items.push({
                    name: "Aperture",
                    help: "",
                    value: lists.aperture[i].name,
                    action: ui.set(core.currentProgram.exposurePlans[planIndex], 'aperture', lists.aperture[i].ev)
                });
            }
        }
        return res;
    }

    var valueDisplay = function(name, object, key) {
        return function() {
            if (object && object.hasOwnProperty(key)) return name + "~" + object[key];
            else return name;

        }
    }

    var isoValueDisplay = function(name, object, key) {
        return function() {
            if (object && object.hasOwnProperty(key)) {
                var itemName = lists.getNameFromEv(lists.iso, object[key]);
                if(name) {
                    return name + "~" + itemName;
                } else {
                    return name;
                }
            }
            return name;

        }
    }

    var apertureValueDisplay = function(name, object, key) {
        return function() {
            if (object && object.hasOwnProperty(key)) {
                var itemName = lists.getNameFromEv(lists.aperture, object[key]);
                if(name) {
                    return name + "~" + itemName;
                } else {
                    return name;
                }
            }
            return name;

        }
    }

    var shutterValueDisplay = function(name, object, key) {
        return function() {
            if (object && object.hasOwnProperty(key)) {
                var itemName = lists.getNameFromEv(lists.shutter, object[key]);
                if(name) {
                    return name + "~" + itemName;
                } else {
                    return name;
                }
            }
            return name;

        }
    }

    var rampingNightCompensation = {
        name: "Night Exposure Compensation",
        type: "options",
        items: [{
            name: "Night Exposure Compensation",
            value: "Automatic",
            help: help.rampingNightCompensation,
            action: ui.set(core.currentProgram, 'nightCompensation', 'auto')
        }, {
            name: "Night Exposure Compensation",
            value: "0 stops",
            help: help.rampingNightCompensation,
            action: ui.set(core.currentProgram, 'nightCompensation', 0)
        }, {
            name: "Night Exposure Compensation",
            value: "-1/3 stops",
            help: help.rampingNightCompensation,
            action: ui.set(core.currentProgram, 'nightCompensation', -1/3)
        }, {
            name: "Night Exposure Compensation",
            value: "-2/3 stops",
            help: help.rampingNightCompensation,
            action: ui.set(core.currentProgram, 'nightCompensation', -2/3)
        }, {
            name: "Night Exposure Compensation",
            value: "-1 stop",
            help: help.rampingNightCompensation,
            action: ui.set(core.currentProgram, 'nightCompensation', -1)
        }, {
            name: "Night Exposure Compensation",
            value: "-1 1/3 stops",
            help: help.rampingNightCompensation,
            action: ui.set(core.currentProgram, 'nightCompensation', -1 - 1 / 3)
        }, {
            name: "Night Exposure Compensation",
            value: "-1 2/3 stops",
            help: help.rampingNightCompensation,
            action: ui.set(core.currentProgram, 'nightCompensation', -1 - 2 / 3)
        }, {
            name: "Night Exposure Compensation",
            value: "-2 stops",
            help: help.rampingNightCompensation,
            action: ui.set(core.currentProgram, 'nightCompensation', -2)
        }]
    }


    var hdrCountPlan = function(planIndex) {
        return {
            name: "HDR Exposures",
            type: "options",
            items: [{
                name: "HDR Exposures",
                value: "Single (no HDR)",
                help: help.rampingNightCompensation,
                action: ui.set(core.currentProgram.exposurePlans[planIndex], 'hdrCount', 0)
            }, {
                name: "HDR Exposures",
                value: "Sets of 2",
                help: help.rampingNightCompensation,
                action: ui.set(core.currentProgram.exposurePlans[planIndex], 'hdrCount', 2)
            }, {
                name: "HDR Exposures",
                value: "Sets of 3",
                help: help.rampingNightCompensation,
                action: ui.set(core.currentProgram.exposurePlans[planIndex], 'hdrCount', 3)
            }, {
                name: "HDR Exposures",
                value: "Sets of 5",
                help: help.rampingNightCompensation,
                action: ui.set(core.currentProgram.exposurePlans[planIndex], 'hdrCount', 5)
            }, {
                name: "HDR Exposures",
                value: "Sets of 7",
                help: help.rampingNightCompensation,
                action: ui.set(core.currentProgram.exposurePlans[planIndex], 'hdrCount', 7)
            }, {
                name: "HDR Exposures",
                value: "Sets of 9",
                help: help.rampingNightCompensation,
                action: ui.set(core.currentProgram.exposurePlans[planIndex], 'hdrCount', 9)
            }, {
                name: "HDR Exposures",
                value: "Sets of 11",
                help: help.rampingNightCompensation,
                action: ui.set(core.currentProgram.exposurePlans[planIndex], 'hdrCount', 11)
            }, {
                name: "HDR Exposures",
                value: "Sets of 13",
                help: help.rampingNightCompensation,
                action: ui.set(core.currentProgram.exposurePlans[planIndex], 'hdrCount', 13)
            }, {
                name: "HDR Exposures",
                value: "Sets of 15",
                help: help.rampingNightCompensation,
                action: ui.set(core.currentProgram.exposurePlans[planIndex], 'hdrCount', 15)
            }]
        }
    } 

    var hdrCountOptions = {
        name: "HDR Exposures",
        type: "options",
        items: [{
            name: "HDR Exposures",
            value: "Single (no HDR)",
            help: help.rampingNightCompensation,
            action: ui.set(core.currentProgram, 'hdrCount', 0)
        }, {
            name: "HDR Exposures",
            value: "Sets of 2",
            help: help.rampingNightCompensation,
            action: ui.set(core.currentProgram, 'hdrCount', 2)
        }, {
            name: "HDR Exposures",
            value: "Sets of 3",
            help: help.rampingNightCompensation,
            action: ui.set(core.currentProgram, 'hdrCount', 3)
        }, {
            name: "HDR Exposures",
            value: "Sets of 5",
            help: help.rampingNightCompensation,
            action: ui.set(core.currentProgram, 'hdrCount', 5)
        }, {
            name: "HDR Exposures",
            value: "Sets of 7",
            help: help.rampingNightCompensation,
            action: ui.set(core.currentProgram, 'hdrCount', 7)
        }, {
            name: "HDR Exposures",
            value: "Sets of 9",
            help: help.rampingNightCompensation,
            action: ui.set(core.currentProgram, 'hdrCount', 9)
        }, {
            name: "HDR Exposures",
            value: "Sets of 11",
            help: help.rampingNightCompensation,
            action: ui.set(core.currentProgram, 'hdrCount', 11)
        }, {
            name: "HDR Exposures",
            value: "Sets of 13",
            help: help.rampingNightCompensation,
            action: ui.set(core.currentProgram, 'hdrCount', 13)
        }, {
            name: "HDR Exposures",
            value: "Sets of 15",
            help: help.rampingNightCompensation,
            action: ui.set(core.currentProgram, 'hdrCount', 15)
        }]
    }

    var hdrStopsPlan = function(planIndex) {
        return {
            name: "HDR Bracket Step",
            type: "options",
            items: [{
                name: "HDR Bracket Step",
                value: "1/3 stops",
                help: help.rampingNightCompensation,
                action: ui.set(core.currentProgram.exposurePlans[planIndex], 'hdrStops', 1/3)
            }, {
                name: "HDR Bracket Step",
                value: "2/3 stops",
                help: help.rampingNightCompensation,
                action: ui.set(core.currentProgram.exposurePlans[planIndex], 'hdrStops', 2/3)
            }, {
                name: "HDR Bracket Step",
                value: "1 stop",
                help: help.rampingNightCompensation,
                action: ui.set(core.currentProgram.exposurePlans[planIndex], 'hdrStops', 1)
            }, {
                name: "HDR Bracket Step",
                value: "1 1/3 stops",
                help: help.rampingNightCompensation,
                action: ui.set(core.currentProgram.exposurePlans[planIndex], 'hdrStops', 1 - 1 / 3)
            }, {
                name: "HDR Bracket Step",
                value: "1 2/3 stops",
                help: help.rampingNightCompensation,
                action: ui.set(core.currentProgram.exposurePlans[planIndex], 'hdrStops', 1 - 2 / 3)
            }, {
                name: "HDR Bracket Step",
                value: "2 stops",
                help: help.rampingNightCompensation,
                action: ui.set(core.currentProgram.exposurePlans[planIndex], 'hdrStops', 2)
            }]
        }
    } 

    var hdrStopsOptions = {
        name: "HDR Bracket Step",
        type: "options",
        items: [{
            name: "HDR Bracket Step",
            value: "1/3 stops",
            help: help.rampingNightCompensation,
            action: ui.set(core.currentProgram, 'hdrStops', 1/3)
        }, {
            name: "HDR Bracket Step",
            value: "2/3 stops",
            help: help.rampingNightCompensation,
            action: ui.set(core.currentProgram, 'hdrStops', 2/3)
        }, {
            name: "HDR Bracket Step",
            value: "1 stop",
            help: help.rampingNightCompensation,
            action: ui.set(core.currentProgram, 'hdrStops', 1)
        }, {
            name: "HDR Bracket Step",
            value: "1 1/3 stops",
            help: help.rampingNightCompensation,
            action: ui.set(core.currentProgram, 'hdrStops', 1 - 1 / 3)
        }, {
            name: "HDR Bracket Step",
            value: "1 2/3 stops",
            help: help.rampingNightCompensation,
            action: ui.set(core.currentProgram, 'hdrStops', 1 - 2 / 3)
        }, {
            name: "HDR Bracket Step",
            value: "2 stops",
            help: help.rampingNightCompensation,
            action: ui.set(core.currentProgram, 'hdrStops', 2)
        }]
    }

    var rampingOptionsMenu = {
        name: "Ramping Options",
        type: "menu",
        items: [{
            name: valueDisplay("Night Exposure", core.currentProgram, 'nightCompensation'),
            action: rampingNightCompensation,
            help: help.rampingNightCompensation
        //}, {
        //    name: valueDisplay("Ramping Algorithm", core.currentProgram, 'rampAlgorithm'),
        //    help: help.rampingAlgorithm,
        //    action: rampingAlgorithmOptions,
        //    condition: function() {
        //        return core.currentProgram.rampMode == 'auto';
        //    }
        }, {
            name: valueDisplay("Highlight Protection", core.currentProgram, 'highlightProtection'),
            help: help.highlightProtection,
            action: highlightProtectionOptions,
            condition: function() {
                return core.currentProgram.rampAlgorithm == 'lum' && core.currentProgram.rampMode == 'auto';
            }
        }, {
            name: isoValueDisplay("Maximum ISO", core.currentProgram, 'isoMax'),
            action: isoMax,
            help: help.isoMax
        }, {
            name: isoValueDisplay("Minimum ISO", core.currentProgram, 'isoMin'),
            action: isoMin,
            help: help.isoMin
        }, {
            name: shutterValueDisplay("Max Shutter", core.currentProgram, 'shutterMax'),
            action: shutterMax,
            help: help.shutterMax
        }, {
            name: valueDisplay("Ramp Params", core.currentProgram, 'rampParameters'),
            action: rampParameters,
            help: help.rampParameters
        }, {
            name: apertureValueDisplay("Min Aperture", core.currentProgram, 'apertureMin'),
            action: apertureMin,
            help: help.apertureMin,
            condition: function() {
                return core.currentProgram.rampParameters && core.currentProgram.rampParameters.indexOf('A') !== -1 && (core.cameraSettings.aperture && core.cameraSettings.details && core.cameraSettings.details.aperture && core.cameraSettings.details.aperture.ev != null);
            }
        }, {
            name: apertureValueDisplay("Max Aperture", core.currentProgram, 'apertureMax'),
            action: apertureMax,
            help: help.apertureMax,
            condition: function() {
                return core.currentProgram.rampParameters && core.currentProgram.rampParameters.indexOf('A') !== -1 && (core.cameraSettings.aperture && core.cameraSettings.details && core.cameraSettings.details.aperture && core.cameraSettings.details.aperture.ev != null);
            }
        }, ]
    }

    var exposureMenu = {
        name: "exposure",
        type: "function",
        fn: function(args, cb) {
            blockInputs = true;
            var stats, ev, exiting = false;
            var getSettingsTimer = null;

            function captureButtonHandler(b) {
                oled.activity();
                power.activity();
                if (b == 1 || b == 4) {
                    exiting = true;
                    liveviewOn = false;
                    blockInputs = false;
                    core.lvOff();
                    console.log("(exposure) disabling handlers...");
                    inputs.removeListener('B', captureButtonHandler);
                    inputs.removeListener('D', captureDialHandler);
                    setTimeout(cb, 500);
                } else if (b == 2) {
                    if (core.cameraZoomed) {
                        core.zoom();
                    } else {
                        core.zoom(0.5, 0.5);
                    }
                }
            }

            function captureDialHandler(d) {
                oled.activity();
                power.activity();
                //console.log("captureDialHandler", d, stats, ev);
                if (core.photo && core.cameraZoomed) {
                    var f = 0;
                    if (d == 'U') {
                        f = +2;
                    }
                    if (d == 'D') {
                        f = -2;
                    }
                    core.focus(f, 1);
                } else {
                    if (d == 'U') {
                        if (stats.ev < stats.maxEv) {
                            ev += 1 / 3;
                            console.log("(exposure) setting ev to ", ev);
                            if(getSettingsTimer) {
                                clearTimeout(getSettingsTimer);
                                getSettingsTimer = null;
                            }
                            core.setEv(ev, {
                                cameraSettings: core.cameraSettings
                            }, function() {
                                getSettingsTimer = setTimeout(core.getSettings, 1000);
                            });
                        }
                    } else if (d == 'D') {
                        if (stats.ev > stats.minEv) {
                            ev -= 1 / 3;
                            console.log("(exposure) setting ev to ", ev);
                            if(getSettingsTimer) {
                                clearTimeout(getSettingsTimer);
                                getSettingsTimer = null;
                            }
                            core.setEv(ev, {
                                cameraSettings: core.cameraSettings
                            }, function() {
                                getSettingsTimer = setTimeout(core.getSettings, 1000);
                            });
                        }
                    }
                }
            }

            liveviewOn = true;
            liveviewOnApp = false;
            core.preview();
            console.log("(exposure) started liveview, getting settings...");
            inputs.on('B', captureButtonHandler);
            core.getSettings(function() {
                console.log("(exposure) done getting settings, enabling knob handler");
                stats = lists.evStats(core.cameraSettings);
                ev = stats.ev;
                if(exiting) return;
                inputs.on('D', captureDialHandler);
            });
        }
    }

    var stopConfirm = {
        name: "stop timelapse?",
        type: "options",
        items: [{
            name: "stop timelapse?",
            value: "no",
            action: {
                type: 'function',
                fn: function(arg, cb) {
                    cb();
                }
            }
        }, {
            name: "stop timelapse?",
            value: "yes",
            action: {
                type: 'function',
                fn: function(arg, cb) {
                    core.stopIntervalometer();
                    cb();
                    ui.back();
                }
            }
        }]
    }


    var timelapseRunningMenu = function() {
        return {
            name: "time-lapse",
            type: "menu",
            items: [{
                name: valueDisplay("Play Preview", core.intervalometerStatus, 'frames'),
                action: {
                    type: "function",
                    fn: function(arg, cb) {
                        core.getCurrentTimelapseFrames(null, function(err, framesPaths) {
                            if(framesPaths) {
                                oled.video(null, framesPaths, 30, cb);
                            }                            
                        });
                    }
                }
            //}, {
            //    name: "Preview Camera #2",
            //    action: {
            //        type: "function",
            //         fn: function(arg, cb) {
            //            clips.getLastTimelapse(function(err, timelapse) {
            //                if (timelapse) {
            //                    var cam = 1;
            //                    if(timelapse.primary_camera == '1') cam = 2;
            //                    db.getTimelapseFrames(timelapse.id, cam, function(err, clipFrames){
            //                        if(!err && clipFrames) {
            //                            var framesPaths = clipFrames.map(function(frame){
            //                                return frame.thumbnail;
            //                            });
            //                            oled.video(null, framesPaths, 30, cb);
            //                        }
            //                    });
            //                } 
            //            });
            //        }
            //    },
            //    help: help.playbackCamera,
            //    condition: function() {
            //        return parseInt(core.currentProgram.cameras) > 1;
            //    }
            }, {
                name: "Stop Time-lapse",
                action: stopConfirm
            }]
        }
    }

    var timelapseStatusMenu = {
        name: "time-lapse",
        type: "timelapse",
        enter: function(){
            core.getCurrentTimelapseFrames(null, function(err, framesPaths) {
                if(framesPaths) {
                    oled.video(null, framesPaths, 30, function(){
                        ui.reload();
                    });
                }                            
            });
        },
        button3: function(){
            ui.load(timelapseRunningMenu());
        },
        help: help.timelapseStatus
    }

    var planGroupMenu = function(groupIndex) {
        return function(cb) {
            if(!core.currentProgram.exposurePlans[groupIndex]) core.currentProgram.exposurePlans[groupIndex] = {};
            var autoIntervalCheck = (function(index){
                return function() {
                    if(!core.currentProgram.exposurePlans[groupIndex]) core.currentProgram.exposurePlans[groupIndex] = {};
                    return core.currentProgram.exposurePlans[index].intervalMode == 'auto';
                }
            })(groupIndex);
            var fixedIntervalCheck = (function(index){
                console.log("setting index for closure to", index);
                return function() {
                    console.log("using closure index", index, core.currentProgram.exposurePlans[index].intervalMode);
                    if(!core.currentProgram.exposurePlans[groupIndex]) core.currentProgram.exposurePlans[groupIndex] = {};
                    return core.currentProgram.exposurePlans[index].intervalMode != 'auto';
                }
            })(groupIndex);
            return cb(null, {
                name: "planGroup" + groupIndex,
                type: 'menu',
                items: [
                    {
                        name: valueDisplay("Exposure Mode", core.currentProgram.exposurePlans[groupIndex], 'mode'),
                        help: help.rampingOptions,
                        action: rampingOptionsPlan(groupIndex),
                    }, {
                        name: shutterValueDisplay("Preset Shutter", core.currentProgram.exposurePlans[groupIndex], 'shutter'),
                        action: shutterPlan(groupIndex),
                        help: "",
                        condition: function() {
                            return core.currentProgram.exposurePlans[groupIndex].mode == 'preset';
                        }
                    }, {
                        name: isoValueDisplay("Preset ISO", core.currentProgram.exposurePlans[groupIndex], 'iso'),
                        action: isoPlan(groupIndex),
                        help: "",
                        condition: function() {
                            return core.currentProgram.exposurePlans[groupIndex].mode == 'preset';
                        }
                    }, {
                        name: apertureValueDisplay("Preset Aperture", core.currentProgram.exposurePlans[groupIndex], 'aperture'),
                        action: aperturePlan(groupIndex),
                        help: "",
                        condition: function() {
                            return core.currentProgram.exposurePlans[groupIndex].mode == 'preset';
                        }
                    }, {
                        name: valueDisplay("Interval Mode", core.currentProgram.exposurePlans[groupIndex], 'intervalMode'),
                        help: help.intervalOptions,
                        action: intervalOptionsPlan(groupIndex),
                    }, {
                        name: valueDisplay("Interval", core.currentProgram.exposurePlans[groupIndex], 'interval'),
                        action: intervalPlan(groupIndex),
                        help: help.interval,
                        condition: function() {
                            return core.currentProgram.exposurePlans[groupIndex].intervalMode != 'auto';
                        }
                    }, {
                        name: valueDisplay("Day Interval", core.currentProgram.exposurePlans[groupIndex], 'dayInterval'),
                        action: dayIntervalPlan(groupIndex),
                        help: help.dayInterval,
                        condition: function() {
                            return core.currentProgram.exposurePlans[groupIndex].intervalMode == 'auto';
                        }
                    }, {
                        name: valueDisplay("Night Interval", core.currentProgram.exposurePlans[groupIndex], 'nightInterval'),
                        action: nightIntervalPlan(groupIndex),
                        help: help.nightInterval,
                        condition: function() {
                            return core.currentProgram.exposurePlans[groupIndex].intervalMode == 'auto';
                        }
                    }, {
                        name: valueDisplay("HDR Exposures", core.currentProgram.exposurePlans[groupIndex], 'hdrCount'),
                        action: hdrCountPlan(groupIndex),
                        help: help.interval,
                    }, {
                        name: valueDisplay("HDR Bracket Step", core.currentProgram.exposurePlans[groupIndex], 'hdrStops'),
                        action: hdrStopsPlan(groupIndex),
                        help: help.interval,
                        condition: function() {
                            return core.currentProgram.exposurePlans[groupIndex].hdrCount > 1;
                        }
                    }
                ]
            });
        }
    }

    var exposurePlansMenu = function(cb) {
        var res = {
            name: "planList",
            type: "menu",
            items: []
        }
        for(var i = 0; i < core.currentProgram.exposurePlans.length; i++) {
            res.items.push({
                name: core.currentProgram.exposurePlans[i].name,
                action: planGroupMenu(i),
                help: "",
            });
        }
        return cb(null, res);
    }

    var getTrackingMotor = function(trackingMotor) {
        if(trackingMotor && trackingMotor != 'none') {
            var parts = trackingMotor.match(/^([A-Z]+)([0-9]+)(r?)$/);
            if(parts && parts.length > 2) {
                return {
                    name: parts[1] + '-' + parts[2],
                    reverse: parts[3] == 'r' ? true : false,
                }
            } else {
                return false;
            }
        } else {
            return false;
        }
    }

    var getMotor = function(motorName, callback) {
        db.get('motion-'+motorName, callback);
    } 

    var exposurePlansReview = function() {
        var info = "";
        var pad = "- ";
        var now = new Date();
        for(var i = 0; i < core.currentProgram.exposurePlans.length; i++) {
            var plan = core.currentProgram.exposurePlans[i];
            info += plan.name + '\t';
            if(i < core.currentProgram.exposurePlans.length - 1 && core.currentProgram.exposurePlans[i + 1].start < now) {
                info += pad + "(skipping)\n"; 
                continue;
            }
            if(i > 0) info += pad + moment(plan.start).fromNow() + '\t';
            info += pad; 
            if(plan.mode == 'preset') {
                info += lists.getNameFromEv(lists.shutter, plan.shutter) + ', ';
                info += 'f/' + lists.getNameFromEv(lists.aperture, plan.aperture) + ', ';
                info += lists.getNameFromEv(lists.iso, plan.iso) + 'ISO';
            } else {
                info +=  "exposure: " + plan.mode;
            }
            info += "\t";
            if(plan.intervalMode == 'auto') {
                info += pad + "night interval: " + plan.nightInterval + "s\t";
                info += pad + "day interval: " + plan.dayInterval + "s\t";
            } else {
                info += pad + "interval: " + plan.interval + "s\t";
            }
            if(plan.hdrCount > 1) {
                info += pad + "HDR exposures: " + plan.hdrCount + "\t";
                info += pad + "HDR steps: " + plan.hdrStops + " stops\t";
            }
            info += pad + "total frames: ";
            var startTime = plan.start <  now ? now : plan.start;
            if(i == core.currentProgram.exposurePlans.length - 1) {
                info += "indefinite";
            } else if(plan.intervalMode == 'fixed') {
                info += Math.floor(((core.currentProgram.exposurePlans[i + 1].start - startTime) / 1000) / plan.interval).toString();
            } else if(plan.intervalMode == 'fixed') {
                info += Math.floor(((core.currentProgram.exposurePlans[i + 1].start - startTime) / 1000) / plan.nightInterval).toString();
                info += '-';
                info += Math.floor(((core.currentProgram.exposurePlans[i + 1].start - startTime) / 1000) / plan.dayInterval).toString();
            } else {
                info += "unknown";
            }

            info += "\n";
        }
        return info;
    }

    var motorOrientationKnown = function() {
        if(!core.motionStatus.motors) return false;

        var motors = [];        
        for(var i = 0; i < core.motionStatus.motors.length; i++) {
            if(core.motionStatus.motors[i].connected) motors.push(core.motionStatus.motors[i]);
        }
        console.log("MAIN: motorOrientationKnown: motors.length", motors.length);
        console.log("MAIN: motorOrientationKnown: core.motionStatus.motors[0]", motors[0]);
        console.log("MAIN: motorOrientationKnown: core.motionStatus.motors[1]", motors[1]);

        if(motors.length > 3) return false;
        if(motors.length == 1 && motors[0].orientation && (motors[0].orientation == 'pan' || motors[0].orientation == 'tilt')) {
            var res = {};
            res[motors[0].orientation] = motors[0];
            res[motors[0].orientation].name = motors[0].driver + "-" + motors[0].motor;
            console.log("MAIN: motorOrientationKnown: res", res);
            return res;
        }
        if(motors.length == 2 && motors[0].orientation && motors[1].orientation && motors[0].orientation != motors[1].orientation && (motors[0].orientation == 'pan' || motors[0].orientation == 'tilt') && (motors[1].orientation == 'pan' || motors[1].orientation == 'tilt')) {
            var res = {};
            res[motors[0].orientation] = motors[0];
            res[motors[0].orientation].name = motors[0].driver + "-" + motors[0].motor;
            res[motors[1].orientation] = motors[1];
            res[motors[1].orientation].name = motors[1].driver + "-" + motors[1].motor;
            console.log("MAIN: motorOrientationKnown: res", res);
            return res;
        }
        return false;
    }

    var timelapseMenu = {
        name: "time-lapse",
        type: "menu",
        alternate: function() {
            if (core.intervalometerStatus.running) {
                return timelapseStatusMenu;
            } else if (core.cameraConnected) {
                return false;
            } else {
                return {
                    name: "connect camera",
                    type: "png",
                    help: help.connectCamera,
                    file: "/home/view/current/media/view-usb-oled.png"
                }
            }
        },
        items: [{
            name: valueDisplay("Camera", core, 'cameraModel'),
            help: help.cameraSelection,
            action: function(cb) {
                var cm = {
                    name: "Primary Camera",
                    type: "options",
                    items: []
                }
                core.cameraList(function(list){
                    for(var i = 0; i < list.length; i++) {
                        cm.items.push({
                            name: "Primary Camera",
                            value: list[i].model,
                            help: help.cameraSelection,
                            action: (function(cam) { return function(cb2) {
                                core.switchPrimary(cam);
                                ui.back();
                                ui.back();
                            };})(list[i])
                        });
                    }
                    cb(null, cm);
                });
            },
            condition: function() {
                return core.cameraCount > 1;
            }
        }, {
            name: valueDisplay("Exposure", core.cameraSettings.stats, 'ev'),
            help: help.exposureMenu,
            action: exposureMenu,
            condition: function() {
                return core.cameraSupports.liveview;
            }
        }, {
            name: valueDisplay("Timelapse Mode", core.currentProgram, 'rampMode'),
            help: help.rampingOptions,
            action: rampingOptions
        /*}, {
            name: valueDisplay("Ramp Direction", core.currentProgram, 'lrtDirection'),
            help: help.lrtDirection,
            action: lrtDirection,
            condition: function() {
                return core.currentProgram.rampAlgorithm == 'lrt' && core.currentProgram.rampMode == 'auto';
            }*/
        }, {
            name: valueDisplay("Interval Mode", core.currentProgram, 'intervalMode'),
            help: help.intervalOptions,
            action: intervalOptions,
            condition: function() {
                return core.currentProgram.rampMode != 'fixed' && core.currentProgram.rampMode != 'eclipse';
            }
        }, {
            name: valueDisplay("Interval", core.currentProgram, 'interval'),
            action: interval,
            help: help.interval,
            condition: function() {
                return (core.currentProgram.intervalMode == 'fixed' || core.currentProgram.rampMode == 'fixed') && core.currentProgram.rampMode != 'eclipse';
            }
        }, {
            name: valueDisplay("Day Interval", core.currentProgram, 'dayInterval'),
            action: dayInterval,
            help: help.dayInterval,
            condition: function() {
                return core.currentProgram.intervalMode == 'auto' && core.currentProgram.rampMode == 'auto';
            }
        }, {
            name: valueDisplay("Night Interval", core.currentProgram, 'nightInterval'),
            action: nightInterval,
            help: help.nightInterval,
            condition: function() {
                return core.currentProgram.intervalMode == 'auto' && core.currentProgram.rampMode == 'auto';
            }
        }, {
            name: valueDisplay("Frames", core.currentProgram, 'frames'),
            action: framesOptions,
            help: help.framesOptions,
            condition: function() {
                return (core.currentProgram.intervalMode == 'fixed' || core.currentProgram.rampMode == 'fixed') && core.currentProgram.rampMode != 'eclipse';
            }
        }, {
            name: valueDisplay("Tracking", core.currentProgram, 'tracking'),
            action: trackingOptions,
            help: help.trackingOptions,
            condition: function() {
                var enabled = core.motionStatus.available;
                if(!enabled) core.currentProgram.tracking = 'none';
                return enabled;
            }
        }, {
            name: valueDisplay("Tracking Pan", core.currentProgram, 'trackingPanMotor'),
            action: trackingPanMotorMenu,
            help: help.trackingPanMotor,
            condition: function() {
                return core.motionStatus.available && ((mcu.validCoordinates() && !motorOrientationKnown()) || core.currentProgram.tracking == '15deg') && core.currentProgram.tracking && core.currentProgram.tracking != 'none';
            }
        }, {
            name: valueDisplay("Tracking Tilt", core.currentProgram, 'trackingTiltMotor'),
            action: trackingTiltMotorMenu,
            help: help.trackingTiltMotor,
            condition: function() {
                return core.motionStatus.available && (mcu.validCoordinates() && !motorOrientationKnown()) && core.currentProgram.tracking && core.currentProgram.tracking != 'none' && core.currentProgram.tracking != '15deg';
            }
        }, {
            name: valueDisplay("Destination", core.currentProgram, 'destination'),
            action: destinationOptions,
            help: help.destinationOptions,
            condition: function() {
                return core.sdPresent;
            }
        }, {
            name: "Eclipse Circumstances",
            action: exposurePlansMenu,
            help: "",
            condition: function() {
                return core.currentProgram.rampMode == 'eclipse';
            }
        }, {
            name: "Ramping Options",
            action: rampingOptionsMenu,
            help: help.rampingOptionsMenu,
            condition: function() {
                return core.currentProgram.rampMode != 'fixed';
            }
        }, {
            name: apertureValueDisplay("Manual Aperture", core.currentProgram, 'manualAperture'),
            action: manualAperture,
            help: help.manualAperture,
            condition: function() {
                return core.currentProgram.rampMode != 'fixed' && !(core.cameraSettings.aperture && core.cameraSettings.details && core.cameraSettings.details.aperture && core.cameraSettings.details.aperture.ev != null);
            }
        }, {
            name: valueDisplay("HDR Exposures", core.currentProgram, 'hdrCount'),
            action: hdrCountOptions,
            help: help.interval,
            condition: function() {
                return core.currentProgram.rampMode == 'auto';
            }
        }, {
            name: valueDisplay("HDR Bracket Step", core.currentProgram, 'hdrStops'),
            action: hdrStopsOptions,
            help: help.interval,
            condition: function() {
                return core.currentProgram.rampMode == 'auto' && core.currentProgram.hdrCount > 1;
            }
        }, {
             name: "Review Program",
            action: function(){
                ui.back();
                ui.alert('Review Planned Events', exposurePlansReview);
            },
            help: "",
            condition: function() {
                return core.currentProgram.exposurePlans.length > 0;
            }
        }, {
           name: "START",
            help: help.startTimelapse,
            action: {
                type: "function",
                fn: function(arg, cb) {
                    core.currentProgram.delay = 1;
                    core.currentProgram.keyframes = null;
                    core.currentProgram.scheduled = null;
                    core.currentProgram.axes = {};
                    core.currentProgram.focusPos = 0;
                    core.currentProgram.coords = mcu.validCoordinates();
                    if(!core.currentProgram.coords) {
                        core.currentProgram.tracking = 'none';
                    }
                    oled.timelapseStatus = null;


                    if(core.currentProgram.tracking != 'none') {
                        var autoOrient = motorOrientationKnown();
                        var panMotor = getTrackingMotor(core.currentProgram.trackingPanMotor);
                        if(core.currentProgram.tracking != "15deg" && (autoOrient && autoOrient.pan)) {
                            panMotor = autoOrient.pan;
                        }
                        var checkTilt = function(){
                            var tiltMotor = (autoOrient && autoOrient.tilt) ? autoOrient.tilt : getTrackingMotor(core.currentProgram.trackingTiltMotor);
                            if(tiltMotor) {
                                getMotor(tiltMotor.name, function(err, tMotor) {
                                    if(err || !tMotor) {
                                        tMotor = tiltMotor;
                                    }
                                    core.currentProgram.trackingTarget = core.currentProgram.tracking;
                                    core.currentProgram.axes[tiltMotor.name] = {
                                        type: 'tracking',
                                        orientation: 'tilt',
                                        trackBelowHorizon: false,
                                        reverse: tiltMotor.reverse,
                                        motor: tMotor
                                    }
                                    core.currentProgram[tiltMotor.name + "Pos"] = 0;
                                    core.startIntervalometer(core.currentProgram);
                                    cb();
                                });
                            } else {
                                core.startIntervalometer(core.currentProgram);
                                cb();
                            }
                        }
                        if(panMotor) {
                            getMotor(panMotor.name, function(err, pMotor) {
                                if(err || !pMotor) {
                                    pMotor = panMotor;
                                }
                                core.currentProgram[panMotor.name + "Pos"] = 0;
                                if(core.currentProgram.tracking == "15deg") {
                                    core.currentProgram.axes[panMotor.name] = {
                                        type: 'constant',
                                        orientation: 'pan',
                                        rate: 15,
                                        reverse: panMotor.reverse,
                                        motor: pMotor
                                    }
                                    core.startIntervalometer(core.currentProgram);
                                    cb();
                                } else {
                                    core.currentProgram.trackingTarget = core.currentProgram.tracking;
                                    core.currentProgram.axes[panMotor.name] = {
                                        type: 'tracking',
                                        orientation: 'pan',
                                        trackBelowHorizon: false,
                                        reverse: panMotor.reverse,
                                        motor: pMotor
                                    }
                                    checkTilt();
                                }
                            });
                        } else {
                            checkTilt();
                        }
                    } else {
                        core.startIntervalometer(core.currentProgram);
                        cb();
                    }
                }
            }
        }, ]
    }

    var createClipsContextMenu = function(clip, callback) {
        db.getTimelapseByName(clip.name, function(err, dbClip) {
            console.log("dbClip:", dbClip, err);
            var res = {
                name: "clipsContext",
                type: "menu",
                items: [{
                    name: "Playback Camera #2",
                    action: {
                        type: "function",
                        arg: clip,
                        fn: function(c, cb2) {
                            if(c.path) {
                                oled.video(c.path, c.frames, 30, cb2);
                            } else {
                                var cam = 1;
                                if(dbClip.primary_camera == '1') cam = 2;
                                db.getTimelapseFrames(c.id, cam, function(err, clipFrames){
                                    if(!err && clipFrames) {
                                        var framesPaths = clipFrames.map(function(frame){
                                            return frame.thumbnail;
                                        });
                                        oled.video(null, framesPaths, 30, cb2);
                                    }
                                });
                            }
                        }
                    },
                    help: help.playbackCamera,
                    condition: function() {
                        return dbClip && parseInt(dbClip.cameras) > 1;
                    }
                }, {
                    name: "Write XMPs to SD card",
                    action: function(){
                        confirmSaveXMPs(clip);
                    },
                    help: help.writeXMPs,
                    condition: function() {
                        return core.sdPresent;
                    }
                }, {
                    name: "Write CSV data to SD",
                    action: function(){
                        confirmSaveSpreadsheet(clip);
                    },
                    help: help.writeSpreadsheet,
                    condition: function() {
                        return core.sdPresent && updates.developerMode;
                    }
                }, {
                    name: "Use time-lapse setup",
                    action: function(){
                        var newProgram = _.extend(core.currentProgram, dbClip.program);
                        console.log("setting current program to ", newProgram);
                        core.loadProgram(newProgram);
                        ui.back();
                        ui.load(timelapseMenu);
                    },
                    help: help.useTimelapseSetup,
                    condition: function() {
                        return dbClip && dbClip.program && !core.intervalometerStatus.running;
                    }
                }, {
                    name: "Send log for review",
                    action: function(){
                        ui.load(createErrorReportReasonMenu(clip.name));
                    },
                    help: help.sendClipLog,
                    condition: function() {
                        return dbClip && dbClip.logfile;
                    }
                }, {
                    name: "Delete Clip",
                    help: help.deleteClip,
                    action: function(){
                        confirmDeleteClip(clip);
                    }
                }, ]
            }
            callback(res);
        });
    }

    var clipsMenu = function(cb) {
        console.log("fetching clips...");
        clips.getRecentTimelapseClips(15, function(err, clips) {
            //console.log("########################################################################################################################");
            if (clips && clips.length > 0) {
                var cm = {
                    name: "timelapse clips",
                    type: "menu",
                    hasImages: true,
                    items: []
                };
                var queued = clips.length;
                var checkDone = function() {
                    queued--;
                    if(queued <= 0) {
                        console.log("done fetching clips, running callback");
                        cb(err, cm);
                    }
                }
                for (var i = 0; i < clips.length; i++) {
                    if (clips[i]) {
                        (function(clip){
                            var size = {
                                x: oled.IMAGE_WIDTH,
                                y: oled.IMAGE_HEIGHT,
                                q: 80
                            }
                            image.downsizeJpeg(new Buffer(clip.image), size, null, function(err, jpegBuf){
                                cm.items.push({
                                    name: clip.name,
                                    line2: clip.frames,
                                    image: jpegBuf,
                                    help: help.clipsMenu,
                                    action: {
                                        type: "function",
                                        arg: clip,
                                        fn: function(c, cb2) {
                                            if(c.path) {
                                                oled.video(c.path, c.frames, 30, cb2);
                                            } else {
                                                db.getTimelapseFrames(c.id, c.primary_camera, function(err, clipFrames){
                                                    if(!err && clipFrames) {
                                                        var framesPaths = clipFrames.map(function(frame){
                                                            return frame.thumbnail;
                                                        });
                                                        oled.video(null, framesPaths, 30, cb2);
                                                    }
                                                });
                                            }
                                        }
                                    },
                                    button3: function(item) {
                                        if(item && item.action && item.action.arg) {
                                            createClipsContextMenu(item.action.arg, function(res) {
                                                ui.load(res);
                                            });
                                        }
                                    }
                                });
                                checkDone();
                            });
                        
                        })(clips[i]);
                    } else {
                        checkDone();
                    }
                }
            } else {
                ui.back();
                ui.back();
                ui.status("no clips available");
                return {
                    name: "timelapse clips",
                    type: "menu",
                    hasImages: true,
                    items: []
                };
            }
        });
    }

    var shutdownNow = function() {
        oled.value([{
            name: "Timelapse+",
            value: "Shutting Down"
        }]);
        oled.update();
        if (core.intervalometerStatus.running) core.stopIntervalometer();
        setTimeout(power.shutdown, 5000); // in case something freezes on the closeSystem() call
        closeSystem(function(){
            console.log("closeSystem complete, running power.shutdown()");
            power.shutdown();
        });
    }

    var powerConfirm = {
        name: "power down?",
        type: "options",
        items: [{
            name: "power off?",
            value: "no",
            action: {
                type: 'function',
                fn: function(arg, cb) {
                    cb();
                }
            }
        }, {
            name: "power off?",
            value: "yes",
            action: {
                type: 'function',
                fn: function() {
                    oled.value([{
                        name: "Timelapse+",
                        value: "Shutting Down"
                    }]);
                    oled.update();
                    //if (!core.intervalometerStatus.running) {
                        setTimeout(power.shutdown, 5000); // in case something freezes on the closeSystem() call
                        closeSystem(function(){
                            console.log("closeSystem complete, running power.shutdown()");
                            power.shutdown();
                        });
                    //}
                }
            }
        }]
    }

    var gestureModeHandle = null;
    var blockGestureHandle = null;
    var blockGesture = false;
    var gestureMode = false;
    var blockInputs = false;


    var captureMenu = {
        name: "capture",
        type: "function",
        help: help.captureMenu,
        alternate: function() {
            if (core.cameraConnected) {
                return false;
            } else {
                return {
                    name: "connect camera",
                    type: "png",
                    file: "/home/view/current/media/view-usb-oled.png",
                    help: help.captureMenu
                }
            }
        },
        fn: function(args, cb) {
            blockInputs = true;
            var stats, ev, exiting = false;

            function captureButtonHandler(b) {
                oled.activity();
                power.activity();
                if (b == 1) {
                    exiting = true;
                    oled.unblock();
                    liveviewOn = false;
                    core.lvOff();
                    blockInputs = false;
                    console.log("(capture) disabling handlers...");
                    inputs.removeListener('B', captureButtonHandler);
                    inputs.removeListener('D', captureDialHandler);
                    setTimeout(cb, 500);
                } else if (b == 4) {
                    liveviewOn = false;
                    core.capture(null, function(err) {
                        if(err) {
                            exiting = true;
                            oled.unblock();
                            liveviewOn = false;
                            blockInputs = false;
                            console.log("(capture) error, disabling handlers...");
                            inputs.removeListener('B', captureButtonHandler);
                            inputs.removeListener('D', captureDialHandler);
                            setTimeout(function(){
                                cb();
                            }, 500);
                            setTimeout(function(){
                                ui.alert('error', err);
                            }, 600);
                        } else {
                            liveviewOn = true;
                            liveviewOnApp = false;
                            core.preview();
                        }
                    });
                }
            }

            function captureDialHandler(d) {
                oled.activity();
                power.activity();
                //console.log("captureDialHandler", d, stats, ev);
                if (d == 'U') {
                    if (stats.ev < stats.maxEv) {
                        ev += 1 / 3;
                        console.log("(capture) setting ev to ", ev);
                        core.setEv(ev, {
                            cameraSettings: core.cameraSettings
                        });
                    }
                } else if (d == 'D') {
                    if (stats.ev > stats.minEv) {
                        ev -= 1 / 3;
                        console.log("(capture) setting ev to ", ev);
                        core.setEv(ev, {
                            cameraSettings: core.cameraSettings
                        });
                    }
                }
            }

            oled.block();
            liveviewOn = true;
            liveviewOnApp = false;
            inputs.on('B', captureButtonHandler);
            console.log("(capture) started liveview, getting settings...");
            core.getSettings(function() {
                console.log("(capture) done getting settings, enabling knob");
                stats = lists.evStats(core.cameraSettings);
                ev = stats.ev;
                if(exiting) return;
                inputs.on('D', captureDialHandler);
            });
            core.preview();
        }
    }

    var versionUpdateConfirmMenuBuild = function(versionTarget) {
        var statusValue = null;
        var cancelPrompt = false;
        return {
            name: "Install version " + versionTarget.version + "?",
            type: "options",
            items: [{
                name: "Install version " + versionTarget.version + "?",
                value: "No - cancel",
                help: help.softwareHelpHeader + ' \n Version release notes: \n ' + versionTarget.notes,
                action: {
                    type: 'function',
                    fn: function(arg, cb) {
                        cb();
                    }
                }
            }, {
                name: "Install version " + versionTarget.version + "?",
                value: "Yes - install",
                help: help.softwareHelpHeader + ' \n Version release notes: \n ' + versionTarget.notes,
                action: {
                    type: 'function',
                    fn: function(arg, cb) {
                        if(versionTarget.zipPath) {// SD install
                            power.disableAutoOff();
                            core.watchdogDisable();
                            ui.busy = true;
                            oled.value([{
                                name: "Installing...",
                                value: "Please Wait"
                            }]);
                            oled.update();
                            updates.installFromPath(versionTarget, function(err){
                                core.unmountSd(function(){
                                    if(err) {
                                        ui.alert('error', "Installation failed!  Reason unknown.");
                                    } else {
                                        oled.value([{
                                            name: "Reloading app...",
                                            value: "Please Wait"
                                        }]);
                                        oled.update();
                                        wifi.unblockBt(function(){
                                            closeSystem(function(){
                                                var killServer = '';
                                                if(core.processId) {
                                                    killServer = '; kill -s 9 ' + core.processId;
                                                }
                                                exec('nohup /bin/sh -c "killall node; sleep 2' + killServer + '; kill -s 9 ' + process.pid + '; /root/startup.sh"', function() {}); // restarting system
                                            });
                                        });
                                    }
                                });
                            });
                        } else {
                            if(updates.installing) {
                                oled.value([{
                                    name: "Error",
                                    value: "Install in progress"
                                }]);
                                oled.update();
                            } else if(versionTarget.installed) {
                                updates.setVersion(versionTarget, function(){
                                    oled.value([{
                                        name: "Reloading app...",
                                        value: "Please Wait"
                                    }]);
                                    oled.update();
                                    closeSystem(function(){
                                        var killServer = '';
                                        if(core.processId) {
                                            killServer = '; kill -s 9 ' + core.processId;
                                        }
                                        exec('nohup /bin/sh -c "killall node; sleep 2' + killServer + '; kill -s 9 ' + process.pid + '; /root/startup.sh"', function() {}); // restarting system
                                    });
                                });
                            } else {
                                power.disableAutoOff();
                                core.watchdogDisable();
                                wifi.blockBt();
                                ui.busy = true;
                                updates.installVersion(versionTarget, function(err){
                                    ui.busy = false;
                                    if(!err) {
                                        updates.setVersion(versionTarget, function(){
                                            ui.status('update successful');
                                            oled.value([{
                                                name: "Reloading app...",
                                                value: "Please Wait"
                                            }]);
                                            oled.update();
                                            wifi.unblockBt(function(){
                                                closeSystem(function(){
                                                    var killServer = '';
                                                    if(core.processId) {
                                                        killServer = '; kill -s 9 ' + core.processId;
                                                    }
                                                    exec('nohup /bin/sh -c "killall node; sleep 2' + killServer + '; kill -s 9 ' + process.pid + '; /root/startup.sh"', function() {}); // restarting system
                                                });
                                            });
                                        });
                                    } else {
                                        wifi.unblockBt();
                                        core.watchdogEnable();
                                        power.enableAutoOff();
                                        ui.status('error updating');
                                        if(cb) cb();
                                        ui.back();
                                    }
                                }, function(statusUpdate) {
                                    oled.activity();
                                    statusValue = [{
                                        name: statusUpdate,
                                        value: "Please Wait",
                                        button3: function() {
                                            oled.value([{
                                                name: "Cancel firmware download?",
                                                value: "go back",
                                                action: function() {
                                                    cancelPrompt = false;
                                                    oled.value(statusValue);
                                                    oled.update();
                                                }
                                            },{
                                                name: "Cancel firmware download?",
                                                value: "cancel download",
                                                action: function() {
                                                    cancelPrompt = false;
                                                    updates.cancel(); // needs confirmation prompt
                                                }
                                            }]);
                                            oled.update();
                                        }
                                    }];
                                    if(!cancelPrompt) {
                                        oled.value(statusValue);
                                        ui.status(statusUpdate);
                                        oled.update();
                                    }
                                    oled.activity();
                                });
                            }
                        }
                    }
                }
            }]
        }
    }


    var softwareMenu = function(cb) {
        var buildUpdateMenu = function(err, versions) {
            if (versions) {
                var sm = {
                    name: "software update",
                    type: "menu",
                    items: [{
                        name: "Install from SD card",
                        help: help.installFromSdCard,
                        action: {
                            type: 'function',
                            fn: function(arg, cb) {
                                core.mountSd(function(err) {
                                    if(err) {
                                        ui.alert('error', "Unable to access SD card");
                                    } else {
                                        updates.getValidVersionFromSdCard(function(err, res) {
                                            if(err) {
                                                core.unmountSd(function(){
                                                    ui.alert('error', "Unable to install from SD card: " + err);
                                                });
                                            } else {
                                                ui.load(versionUpdateConfirmMenuBuild(res), null, null, true);
                                            }
                                        });
                                    }
                                });
                            }
                        }, 
                        condition: function() {
                            return core.sdPresent;
                        }
                    }],
                    alternate: function(){
                        if(updates.installing || updates.installStatus) {
                            return {
                                name: "Installing",
                                type: "options",
                                items: [{
                                    name: "Installing version",
                                    value: updates.installStatus,
                                    help: help.softwareHelpHeader,
                                    action: {
                                        type: 'function',
                                        fn: function(arg, cb) {
                                            if(!updates.installing) updates.installStatus = null;
                                            cb();
                                        }
                                    }
                                }]
                            }
                        } else {
                            return false;
                        }
                    }
                };
                for (var i = 0; i < versions.length; i++) {
                    if (versions[i]) sm.items.push({
                        name: versions[i].version + (versions[i].current ? " (current)" : (versions[i].installed ? " (installed)" : "")),
                        help: help.softwareHelpHeader + ' \n Version release notes: \n ' + versions[i].notes,
                        action: {
                            type: "function",
                            arg: versions[i],
                            fn: function(version, cb) {
                                if(version && !version.current) {
                                    ui.load(versionUpdateConfirmMenuBuild(version), null, null, true);
                                } else {
                                    ui.status('already installed');
                                    if(cb) cb();
                                }

                            }
                        }
                    });
                }
                cb(err, sm);
            }
        }

        if(wifi.connected) {
            updates.getVersions(function(err, versions) {
                if(!err && versions) {
                    var dbVersions = versions.filter(function(v){return v.installed;});
                    console.log("saving installed versions", dbVersions);
                    db.set('versions-installed', dbVersions);
                    buildUpdateMenu(err, versions);
                } else {
                    ui.back();
                    console.log("ERROR: no versions available");
                    oled.value([{
                        name: "Version Update Error",
                        value: "Not Available"
                    }]);
                    oled.update();
                }
            });
        } else {
            updates.getInstalledVersions(function(err, versions) {
                if(!err && versions) {
                    buildUpdateMenu(err, versions);
                } else {
                    ui.back();
                    console.log("ERROR: no installed versions available");
                    oled.value([{
                        name: "Version Update Error",
                        value: "Not Available"
                    }]);
                    oled.update();
                }
            });
            //console.log("Getting cached versions from DB...");
            //db.get('versions-installed', function(err, dbVersions) {
            //    var versions = [];
            //    for(var key in dbVersions) {
            //        if(dbVersions.hasOwnProperty(key)) {
            //            versions.push(dbVersions[key]);
            //        }
            //    }
            //    if(!err && versions) {
            //        for(var i = 0; i < versions.length; i++) {
            //            if(updates.version == versions[i].version) {
            //                versions[i].current = true;
            //            } else {
            //                versions[i].current = false;
            //            }
            //        }
            //        console.log("Building menu from cache", versions);
            //        buildUpdateMenu(err, versions);
            //    } else {
            //        console.log("ERROR: no cached versions available");
            //        oled.value([{
            //            name: "Version Update Error",
            //            value: "WiFi Required"
            //        }]);
            //        oled.update();
            //    }
            //});
        }
    }    

    var wifiScanWait = function() {
        if(wifi.list.length > 0) {
            process.nextTick(function(){
                ui.back();
                ui.load(wifiConnectMenu);
            });
            return "Wifi networks found, reloading...";
        } else {
            return "No wifi networks found.\nScanning...";
        }
    }

    var wifiConnectMenu = function(cb) {
        if(wifi.list.length == 0) {
            cb(null, {
                name: "wifi connect",
                type: "menu",
                items: []
            });
            ui.back();
            ui.alert('wifi connect', wifiScanWait);
            return;
        }
        var m = {
            name: "wifi connect",
            type: "menu"
        }
        m.items = wifi.list.map(function(item){return {
            name:item.ssid + ((wifi.connected && wifi.connected.address == item.address) ? "~connected" : ""), 
            help: help.wifiConnect,
            action: {
                type: 'function',
                arg: item,
                fn: function(res, cb){
                    if(item.encryption_any) {
                        console.log("running textInput", item.address);
                        db.getWifi(item.address, function(err, password) {
                            cb(null, {
                                name: "WiFi password for " + item.ssid,
                                help: help.wifiPassword,
                                type: "textInput",
                                value: password || "",
                                onSave: function(result) {
                                    ui.status('connecting to ' + item.ssid);
                                    wifi.connect(item, result);
                                    db.setWifi(item.address, result);
                                    db.get('wifi-status', function(err, status) {
                                        db.set('wifi-status', {
                                            apMode: false, //status.apMode,
                                            connect: item,
                                            enabled: true,
                                            password: result
                                        });
                                    });
                                    ui.back();
                                }
                            });
                        });
                    } else {
                        ui.status('connecting to ' + item.ssid);
                        wifi.connect(item);
                        db.get('wifi-status', function(err, status) {
                            db.set('wifi-status', {
                                apMode: false, //status.apMode,
                                connect: item,
                                enabled: true
                            });
                        });
                        ui.back();
                        ui.back();
                    }
                }
            },
            button3: function(arg) {
                var w = arg.action.arg;
                var details = "SSID: " + w.ssid + "\t";
                if(w.encryption_wep) {
                    details += "Encryption: WEP\t";
                } else if(w.encryption_wpa) {
                    details += "Encryption: WPA\t";
                } else if(w.encryption_wpa2) {
                    details += "Encryption: WPA2\t";
                } else {
                    details += "Encryption: NONE\t";
                } 
                details += "BSSID: " + w.address + "\t";
                details += "Channel: " + w.channel + "\t";
                ui.alert('Wifi details', details);
            }
        };});
        cb(null, m);
    };

    var setAccessPointNameAction = {
        type: 'function',
        fn: function(res, cb){
            cb(null, {
                name: "WiFi Built-in AP name",
                help: help.wifiAccessPointName,
                type: "textInput",
                value: wifi.apName,
                onSave: function(result) {
                    db.set('wifi-ap-name', result);
                    wifi.setApName(result);
                }
            });
        }
    }

    var setAccessPointPassAction = {
        type: 'function',
        fn: function(res, cb){
            cb(null, {
                name: "WiFi Built-in AP password",
                help: help.wifiAccessPointPassword,
                type: "textInput",
                value: wifi.apPass,
                onSave: function(result) {
                    db.set('wifi-ap-pass', result);
                    wifi.setApPass(result);
                }
            });
        }
    }


    var wifiMenu = {
        name: "wifi",
        type: "menu",
        items: [{
            name: "Connect to Network",
            action: wifiConnectMenu,
            help: help.wifiConnectMenu,
            condition: function() {
                return wifi.enabled;// && !wifi.connected && !wifi.apMode;
            }
        }, {
            name: "Enable Wireless",
            help: help.wifiEnableMenu,
            action: function(){
                wifi.enable(function(){
                    ui.back();
                });
            },
            condition: function() {
                return !wifi.enabled;
            }
        }, {
            name: "Enable built-in AP",
            help: help.wifiApMenu,
            action: function(){
                wifi.enableAP(function(){
                    db.get('wifi-status', function(err, status) {
                        status.apMode = true;
                        status.enabled = true;
                        db.set('wifi-status', status);
                    });
                    ui.back();
                });
            },
            condition: function() {
                return wifi.enabled && !wifi.apMode;
            }
        }, {
            name: "Disable built-in AP",
            help: help.wifiApDisMenu,
            action: function(){
                wifi.disableAP(function(){
                    db.get('wifi-status', function(err, status) {
                        status.apMode = false;
                        status.enabled = true;
                        db.set('wifi-status', status);
                    });
                    ui.back();
                });
            },
            condition: function() {
                return wifi.enabled && wifi.apMode;
            }
        }, {
            name: "Disable Bluetooth",
            help: help.btDisableMenu,
            action: function(){
                wifi.disableBt(function(){
                    db.set('bt-status', {
                        enabled: false
                    });
                    ui.back();
                });
            },
            condition: function() {
                return wifi.btEnabled && wifi.enabled && (wifi.connected || wifi.apMode);
            }
        }, {
            name: "Enable Bluetooth",
            help: help.btEnableMenu,
            action: function(){
                wifi.enableBt(function(){
                    db.set('bt-status', {
                        enabled: true
                    });
                    ui.back();
                });
            },
            condition: function() {
                return !wifi.btEnabled && wifi.enabled && (wifi.connected || wifi.apMode);
            }
        }, {
            name: "Enable Bluetooth",
            help: help.btEnableMenu,
            action: function(){
                ui.back();
                ui.alert('Enable Bluetooth', "Before enabling Bluetooth, first connect to a wifi access point (Connect to Network) or enable the built-in access point (Enable built-in AP)");
            },
            condition: function() {
                return wifi.enabled && !(wifi.connected || wifi.apMode);
            }
        }, {
            name: "Set built-in AP Name",
            help: help.setAccessPointName,
            action: setAccessPointNameAction
        }, {
            name: "Set built-in AP Password",
            help: help.setAccessPointPassword,
            action: setAccessPointPassAction
        }, {
            name: "Disable Wireless",
            help: help.wifiDisableMenu,
            action: function(){
                wifi.disable(function(){
                    db.set('wifi-status', {
                        apMode: false,
                        enabled: false
                    });
                    ui.back();
                });
            },
            condition: function() {
                return wifi.enabled;
            }
        }, ]
    }
    var nmxMotorAttachment = {
        motorEnabled1: 'autodetect',
        motorEnabled2: 'autodetect',
        motorEnabled3: 'autodetect',
    }
    db.get('nmxMotorAttachment', function(err, res) {
        if(!err && res) {
            for(var key in nmxMotorAttachment) {
                if(res.hasOwnProperty(key)) {
                    nmxMotorAttachment[key] = res[key];
                    var m = key.match(/[0-9]/);
                    if(m && m.length > 0) {
                        m = parseInt(m[0]);
                        if(m > 0) core.setNMXMotor(m, nmxMotorAttachment[key]);
                    }
                }
            }
        }
    });
    var buildNmxMotorOptions = function(motorNumber) {
        return {
            name: "NMX Motor " + motorNumber,
            type: "options",
            items: [{
                name: "NMX Motor " + motorNumber,
                value: "autodetect",
                help: help.nmxMotorOptionsAutodetect,
                action: ui.set(nmxMotorAttachment, 'motorEnabled' + motorNumber, 'autodetect', function(cb){
                    db.set('nmxMotorAttachment', nmxMotorAttachment);
                    core.setNMXMotor(motorNumber, "autodetect");
                    core.motionStatusUpdate();
                    cb && cb();
                })
            }, {
                name: "NMX Motor " + motorNumber,
                value: "enabled",
                help: help.nmxMotorOptionsEnable,
                action: ui.set(nmxMotorAttachment, 'motorEnabled' + motorNumber, 'enabled', function(cb){
                    db.set('nmxMotorAttachment', nmxMotorAttachment);
                    core.setNMXMotor(motorNumber, "enabled");
                    core.motionStatusUpdate();
                    cb && cb();
                })
            }, {
                name: "NMX Motor " + motorNumber,
                value: "disabled",
                help: help.nmxMotorOptionsDisable,
                action: ui.set(nmxMotorAttachment, 'motorEnabled' + motorNumber, 'disabled', function(cb){
                    db.set('nmxMotorAttachment', nmxMotorAttachment);
                    core.setNMXMotor(motorNumber, "disabled");
                    core.motionStatusUpdate();
                    cb && cb();
                })
            }]
        }
    }

    var motionSetupMenuNMX = {
        name: "NMX Setup",
        type: "menu",
        items: [{
        //    name: "Connect to NMX",
        //    action: wifiConnectMenu,
        //    help: help.wifiConnectMenu,
        //    condition: function() {
        //        return wifi.enabled;// && !wifi.connected && !wifi.apMode;
        //    }
        //}, {
            name: "Motor1 Attachment",
            help: help.nmxMotorAttachment,
            action: buildNmxMotorOptions(1)
        }, {
            name: "Motor2 Attachment",
            help: help.nmxMotorAttachment,
            action: buildNmxMotorOptions(2)
        }, {
            name: "Motor3 Attachment",
            help: help.nmxMotorAttachment,
            action: buildNmxMotorOptions(3)
        }]
    }

    db.get('auxPulseLength', function(err, length) {
        if(!err && length) {
            core.setAuxPulseLength(length);
        } else {
            core.setAuxPulseLength(200);
        }
    });

    db.get('auxPulseInvert', function(err, invert) {
        if(!err && invert == 'yes') {
            core.setAuxPulseInvert(true);
        } else {
            core.setAuxPulseInvert(false);
        }
    });

    var auxPulseLengthMenu = {
        name: "AUX2 Pulse Length",
        type: "options",
        items: [{
            name: "AUX2 Pulse Length",
            value: "100ms",
            help: help.auxPulseLength,
            action: ui.set(core, 'auxPulseLength', 100, function(cb){
                db.set('auxPulseLength', 100);
                core.setAuxPulseLength(100);
                cb && cb();
            })
        }, {
            name: "AUX2 Pulse Length",
            value: "200ms",
            help: help.auxPulseLength,
            action: ui.set(core, 'auxPulseLength', 200, function(cb){
                db.set('auxPulseLength', 200);
                core.setAuxPulseLength(200);
                cb && cb();
            })
        }, {
            name: "AUX2 Pulse Length",
            value: "300ms",
            help: help.auxPulseLength,
            action: ui.set(core, 'auxPulseLength', 300, function(cb){
                db.set('auxPulseLength', 300);
                core.setAuxPulseLength(300);
                cb && cb();
            })
        }, {
            name: "AUX2 Pulse Length",
            value: "400ms",
            help: help.auxPulseLength,
            action: ui.set(core, 'auxPulseLength', 400, function(cb){
                db.set('auxPulseLength', 400);
                core.setAuxPulseLength(400);
                cb && cb();
            })
        }, {
            name: "AUX2 Pulse Length",
            value: "500ms",
            help: help.auxPulseLength,
            action: ui.set(core, 'auxPulseLength', 500, function(cb){
                db.set('auxPulseLength', 500);
                core.setAuxPulseLength(500);
                cb && cb();
            })
        }, {
            name: "AUX2 Pulse Length",
            value: "600ms",
            help: help.auxPulseLength,
            action: ui.set(core, 'auxPulseLength', 600, function(cb){
                db.set('auxPulseLength', 600);
                core.setAuxPulseLength(600);
                cb && cb();
            })
        }, {
            name: "AUX2 Pulse Length",
            value: "700ms",
            help: help.auxPulseLength,
            action: ui.set(core, 'auxPulseLength', 700, function(cb){
                db.set('auxPulseLength', 700);
                core.setAuxPulseLength(700);
                cb && cb();
            })
        }, {
            name: "AUX2 Pulse Length",
            value: "800ms",
            help: help.auxPulseLength,
            action: ui.set(core, 'auxPulseLength', 800, function(cb){
                db.set('auxPulseLength', 800);
                core.setAuxPulseLength(800);
                cb && cb();
            })
        }, {
            name: "AUX2 Pulse Length",
            value: "900ms",
            help: help.auxPulseLength,
            action: ui.set(core, 'auxPulseLength', 900, function(cb){
                db.set('auxPulseLength', 900);
                core.setAuxPulseLength(900);
                cb && cb();
            })
        }, {
            name: "AUX2 Pulse Length",
            value: "1000ms",
            help: help.auxPulseLength,
            action: ui.set(core, 'auxPulseLength', 1000, function(cb){
                db.set('auxPulseLength', 1000);
                core.setAuxPulseLength(1000);
                cb && cb();
            })
        }, {
            name: "AUX2 Pulse Length",
            value: "1200ms",
            help: help.auxPulseLength,
            action: ui.set(core, 'auxPulseLength', 1200, function(cb){
                db.set('auxPulseLength', 1200);
                core.setAuxPulseLength(1200);
                cb && cb();
            })
        }, {
            name: "AUX2 Pulse Length",
            value: "1400ms",
            help: help.auxPulseLength,
            action: ui.set(core, 'auxPulseLength', 1400, function(cb){
                db.set('auxPulseLength', 1400);
                core.setAuxPulseLength(1400);
                cb && cb();
            })
        }, {
            name: "AUX2 Pulse Length",
            value: "1600ms",
            help: help.auxPulseLength,
            action: ui.set(core, 'auxPulseLength', 1600, function(cb){
                db.set('auxPulseLength', 1600);
                core.setAuxPulseLength(1600);
                cb && cb();
            })
        }, {
            name: "AUX2 Pulse Length",
            value: "1800ms",
            help: help.auxPulseLength,
            action: ui.set(core, 'auxPulseLength', 1800, function(cb){
                db.set('auxPulseLength', 1800);
                core.setAuxPulseLength(1800);
                cb && cb();
            })
        }, {
            name: "AUX2 Pulse Length",
            value: "2000ms",
            help: help.auxPulseLength,
            action: ui.set(core, 'auxPulseLength', 2000, function(cb){
                db.set('auxPulseLength', 2000);
                core.setAuxPulseLength(2000);
                cb && cb();
            })
        }, {
            name: "AUX2 Pulse Length",
            value: "2500ms",
            help: help.auxPulseLength,
            action: ui.set(core, 'auxPulseLength', 2500, function(cb){
                db.set('auxPulseLength', 2500);
                core.setAuxPulseLength(2500);
                cb && cb();
            })
        }, {
            name: "AUX2 Pulse Length",
            value: "3000ms",
            help: help.auxPulseLength,
            action: ui.set(core, 'auxPulseLength', 3000, function(cb){
                db.set('auxPulseLength', 3000);
                core.setAuxPulseLength(3000);
                cb && cb();
            })
        }, {
            name: "AUX2 Pulse Length",
            value: "4000ms",
            help: help.auxPulseLength,
            action: ui.set(core, 'auxPulseLength', 4000, function(cb){
                db.set('auxPulseLength', 4000);
                core.setAuxPulseLength(4000);
                cb && cb();
            })
        }, {
            name: "AUX2 Pulse Length",
            value: "5000ms",
            help: help.auxPulseLength,
            action: ui.set(core, 'auxPulseLength', 5000, function(cb){
                db.set('auxPulseLength', 5000);
                core.setAuxPulseLength(5000);
                cb && cb();
            })
        }, {
            name: "AUX2 Pulse Length",
            value: "6000ms",
            help: help.auxPulseLength,
            action: ui.set(core, 'auxPulseLength', 6000, function(cb){
                db.set('auxPulseLength', 6000);
                core.setAuxPulseLength(6000);
                cb && cb();
            })
        }, {
            name: "AUX2 Pulse Length",
            value: "7000ms",
            help: help.auxPulseLength,
            action: ui.set(core, 'auxPulseLength', 7000, function(cb){
                db.set('auxPulseLength', 7000);
                core.setAuxPulseLength(7000);
                cb && cb();
            })
        }, {
            name: "AUX2 Pulse Length",
            value: "8000ms",
            help: help.auxPulseLength,
            action: ui.set(core, 'auxPulseLength', 8000, function(cb){
                db.set('auxPulseLength', 8000);
                core.setAuxPulseLength(8000);
                cb && cb();
            })
        }, {
            name: "AUX2 Pulse Length",
            value: "9000ms",
            help: help.auxPulseLength,
            action: ui.set(core, 'auxPulseLength', 9000, function(cb){
                db.set('auxPulseLength', 9000);
                core.setAuxPulseLength(9000);
                cb && cb();
            })
        }, {
            name: "AUX2 Pulse Length",
            value: "10000ms",
            help: help.auxPulseLength,
            action: ui.set(core, 'auxPulseLength', 10000, function(cb){
                db.set('auxPulseLength', 10000);
                core.setAuxPulseLength(10000);
                cb && cb();
            })
        }]
    }

    var auxPulseInvertMenu = {
        name: "AUX2 Pulse Invert",
        type: "options",
        items: [{
            name: "AUX2 Pulse Invert",
            value: "No (closed=move)",
            help: help.auxPulseInvert,
            action: ui.set(core, 'auxPulseInvert', 'no', function(cb){
                db.set('auxPulseInvert', 'no');
                core.setAuxPulseInvert(false);
                cb && cb();
            })
        }, {
            name: "AUX2 Pulse Invert",
            value: "Yes (open=move)",
            help: help.auxPulseInvert,
            action: ui.set(core, 'auxPulseInvert', 'yes', function(cb){
                db.set('auxPulseInvert', 'yes');
                core.setAuxPulseInvert(true);
                cb && cb();
            })
        }]
    }

    var motionSetupMenuAUX = {
        name: "AUX Setup",
        type: "menu",
        items: [{
            name: "Pulse Length",
            help: help.auxPulseLength,
            action: auxPulseLengthMenu
        }, {
            name: "Invert Pulse",
            help: help.auxPulseInvert,
            action: auxPulseInvertMenu
        }]
    }

    var motionSetupMenu = {
        name: "NMX Setup",
        type: "menu",
        items: [{
            name: "Configure NMX",
            help: help.configureNMX,
            action: motionSetupMenuNMX
        },{
            name: "AUX2 Sync Setup",
            help: help.configureAUX,
            action: motionSetupMenuAUX
        }]
    }

    var chargeIndicatorMenu = {
        name: "Charge Indicator LED",
        type: "options",
        items: [{
            name: "Charge Indicator LED",
            value: "enabled",
            help: help.chargeIndicatorMenu,
            action: ui.set(power, 'chargeLight', 'enabled', function(cb){
                db.set('chargeLightDisabled', "no");
                power.init(false);
                cb && cb();
            })
        }, {
            name: "Charge Indicator LED",
            value: "disabled",
            help: help.chargeIndicatorMenu,
            action: ui.set(power, 'chargeLight', 'disabled', function(cb){
                db.set('chargeLightDisabled', "yes");
                power.init(true);
                cb && cb();
            })
        }]
    }

    var gpsEnableMenu = {
        name: "GPS Enabled",
        type: "options",
        items: [{
            name: "GPS Enabled",
            value: "enabled",
            help: help.gpsEnableMenu,
            action: ui.set(power, 'gpsEnabled', 'enabled', function(cb){
                db.set('gpsEnabled', "yes");
                power.gps(true);
                cb && cb();
            })
        }, {
            name: "GPS Enabled",
            value: "disabled",
            help: help.gpsEnableMenu,
            action: ui.set(power, 'gpsEnabled', 'disabled', function(cb){
                db.set('gpsEnabled', "no");
                power.gps(false);
                cb && cb();
            })
        }]
    }

    var gestureEnableMenu = {
        name: "Gesture Sensor",
        type: "options",
        items: [{
            name: "Gesture Sensor",
            value: "enabled",
            help: help.gestureEnableMenu,
            action: ui.set(inputs, 'gestureStatus', 'enabled', function(cb){
                db.set('gestureSensor', "yes");
                inputs.startGesture();
                cb && cb();
            })
        }, {
            name: "Gesture Sensor",
            value: "disabled",
            help: help.gestureEnableMenu,
            action: ui.set(inputs, 'gestureStatus', 'disabled', function(cb){
                db.set('gestureSensor', "no");
                inputs.stopGesture();
                cb && cb();
            })
        }]
    }

    var developerModeMenu = {
        name: "Developer Mode",
        type: "options",
        items: [{
            name: "Developer Mode",
            value: "disabled",
            help: help.developerModeMenu,
            action: ui.set(updates, 'developerMode', false, function(cb){
                db.set('developerMode', "no");
                cb && cb();
            })
        }, {
            name: "Developer Mode",
            value: "enabled",
            help: help.developerModeMenu,
            action: ui.set(updates, 'developerMode', true, function(cb){
                db.set('developerMode', "yes");
                cb && cb();
            })
        }]
    }


    var createErrorReportReasonMenu = function(tlName) {
        ui.back();
        return {
            name: "Error Report - Reason",
            type: "options",
            items: [{
                name: "Error Report - Reason",
                value: "Time-lapse",
                help: help.errorReportReasonMenu,
                action: function() {
                    db.sendLog(tlName, 'timelapse', function() {
                        app.sendLogs();
                        ui.back();
                        ui.alert('Success', help.logsQueued);
                    });
                }
            }, {
                name: "Error Report - Reason",
                value: "Interval",
                help: help.errorReportReasonMenu,
                action: function() {
                    db.sendLog(tlName, 'interval', function() {
                        app.sendLogs();
                        ui.back();
                        ui.alert('Success', help.logsQueued);
                    });
                }
            }, {
                name: "Error Report - Reason",
                value: "SD card",
                help: help.errorReportReasonMenu,
                action: function() {
                    db.sendLog(tlName, 'sdcard', function() {
                        app.sendLogs();
                        ui.back();
                        ui.alert('Success', help.logsQueued);
                    });
                }
            }, {
                name: "Error Report - Reason",
                value: "Motion",
                help: help.errorReportReasonMenu,
                action: function() {
                    db.sendLog(tlName, 'motion', function() {
                        app.sendLogs();
                        ui.back();
                        ui.alert('Success', help.logsQueued);
                    });
                }
            }, {
                name: "Error Report - Reason",
                value: "Other",
                help: help.errorReportReasonMenu,
                action: function() {
                    db.sendLog(tlName, 'other', function() {
                        app.sendLogs();
                        ui.back();
                        ui.alert('Success', help.logsQueued);
                    });
                }
            }]
        }
    }


    var autoPowerOffMenu = {
        name: "Auto Power Off",
        type: "options",
        items: [{
            name: "Auto Power Off",
            value: "disabled",
            help: help.autoPowerOffMenu,
            action: ui.set(power, 'autoOffMinutes', false, function(cb){
                power.setAutoOff(power.autoOffMinutes);
                db.set('autoOffMinutes', false);
                cb && cb();
            })
        }, {
            name: "Auto Power Off",
            value: "10 minutes",
            help: help.autoPowerOffMenu,
            action: ui.set(power, 'autoOffMinutes', 10, function(cb){
                power.setAutoOff(power.autoOffMinutes);
                db.set('autoOffMinutes', 10);
                cb && cb();
            })
        }, {
            name: "Auto Power Off",
            value: "20 minutes",
            help: help.autoPowerOffMenu,
            action: ui.set(power, 'autoOffMinutes', 20, function(cb){
                power.setAutoOff(power.autoOffMinutes);
                db.set('autoOffMinutes', 20);
                cb && cb();
            })
        }, {
            name: "Auto Power Off",
            value: "30 minutes",
            help: help.autoPowerOffMenu,
            action: ui.set(power, 'autoOffMinutes', 30, function(cb){
                power.setAutoOff(power.autoOffMinutes);
                db.set('autoOffMinutes', 30);
                cb && cb();
            })
        }]
    }
    var factoryResetConfirmMenu = {
        name: "Erase all Settings?",
        type: "options",
        items: [{
            name: "Erase all Settings?",
            value: "No - cancel",
            help: help.eraseAllSettingsMenu,
            action: {
                type: 'function',
                fn: function(arg, cb) {
                    cb();
                }
            }
        }, {
            name: "Erase all Settings?",
            value: "Yes - erase all",
            help: help.eraseAllSettingsMenu,
            action: {
                type: 'function',
                fn: function(arg, cb) {
                    db.eraseAll();
                    clips.eraseAll();
                    exec("sudo rm /etc/udev/rules.d/70-persistent-net.rules");
                    setTimeout(cb, 500);
                }
            }
        }]
    }

    var colorThemeMenu = {
        name: "Color Theme",
        type: "options",
        items: [{
            name: "Color Theme",
            value: "VIEW Default",
            help: help.colorThemeMenu,
            action: ui.set(oled, 'theme', 'VIEW Default', function(cb){
                db.set('colorTheme', "default");
                oled.setTheme("default");
                cb && cb();
            })
        }, {
            name: "Color Theme",
            value: "Night Red",
            help: help.colorThemeMenu,
            action: ui.set(oled, 'theme', 'Night Red', function(cb){
                db.set('colorTheme', "red");
                oled.setTheme("red");
                cb && cb();
            })
        }, {
            name: "Color Theme",
            value: "High Contrast",
            help: help.colorThemeMenu,
            action: ui.set(oled, 'theme', 'High Contrast', function(cb){
                db.set('colorTheme', "hc");
                oled.setTheme("hc");
                cb && cb();
            })
        }]
    }

    var audioAlertsMenu = {
        name: "Audio Alerts",
        type: "options",
        items: [{
            name: "Audio Alerts",
            value: "disabled",
            help: help.audioAlertsMenu,
            action: ui.set(ui, 'audio', 'disabled', function(cb){
                db.set('audioAlerts', "disabled");
                cb && cb();
            })
        }, {
            name: "Audio Alerts",
            value: "enabled",
            help: help.audioAlertsMenu,
            action: ui.set(ui, 'audio', 'enabled', function(cb){
                db.set('audioAlerts', "enabled");
                cb && cb();
            })
        }]
    }

    var buttonModeMenu = {
        name: "Button Backlights",
        type: "options",
        items: [{
            name: "Button Backlights",
            value: "Disabled",
            help: help.buttonModeMenu,
            action: ui.set(power, 'buttonMode', 'disabled', function(cb){
                db.set('buttonMode', "disabled");
                power.setButtons("disabled");
                cb && cb();
            })
        }, {
            name: "Button Backlights",
            value: "Power Blink",
            help: help.buttonModeMenu,
            action: ui.set(power, 'buttonMode', 'blink', function(cb){
                db.set('buttonMode', "blink");
                power.setButtons("blink");
                cb && cb();
            })
        }, {
            name: "Button Backlights",
            value: "Power Illuminated",
            help: help.buttonModeMenu,
            action: ui.set(power, 'buttonMode', 'power', function(cb){
                db.set('buttonMode', "power");
                power.setButtons("power");
                cb && cb();
            })
        }, {
            name: "Button Backlights",
            value: "All Illuminated",
            help: help.buttonModeMenu,
            action: ui.set(power, 'buttonMode', 'all', function(cb){
                db.set('buttonMode', "all");
                power.setButtons("all");
                cb && cb();
            })
        }]
    }

    var interfaceSettingsMenu = {
        name: "UI Preferences",
        type: "menu",
        items: [{
            name: valueDisplay("Charge LED", power, 'chargeLight'),
            action: chargeIndicatorMenu,
            help: help.chargeIndicatorMenu
        },{
            name: valueDisplay("Gesture Sense", inputs, 'gestureStatus'),
            action: gestureEnableMenu,
            help: help.gestureEnableMenu
        },{
            name: "Calibrate Gesture",
            action: function(cb) {
                cb();
                ui.back();
                gestureString = "Calibrating gesture sensor.\nKeep area in front of sensor clear during calibration.\n";
                ui.alert('Calibrating...', function(){return gestureString;});
                inputs.calibrateGesture(function(err, status, done) {
                    gestureString = "Calibrating gesture sensor.\nKeep area in front of sensor clear during calibration.\n";
                    gestureString += status + "\n";
                    if(done) {
                        gestureString = "Calibration Complete!\nMove your hand in front to test the sensor.\n";
                        ui.back();
                        ui.alert('Gesture Test', function(){return gestureString;}, 200);
                    } else {

                    }
                });
            },
            condition: function(){
                return inputs.gestureStatus == 'enabled';
            },
            help: help.gestureEnableMenu
        },{
            name: valueDisplay("Theme", oled, 'theme'),
            action: colorThemeMenu,
            help: help.colorThemeMenu
        },{
            name: valueDisplay("Audio Alerts", ui, 'audio'),
            action: audioAlertsMenu,
            help: help.audioAlertsMenu
        },{
            name: valueDisplay("Buttons", power, 'buttonMode'),
            action: buttonModeMenu,
            help: help.buttonModeMenu
        }, ]
    }
    var limitPrecison = function(n, p) {
        var f = Math.pow(10, p);
        n = Math.round(n * f) / f;
        return n;
    }
    var gpsInfo = function() {
        var info = "";
        if(power.gpsEnabled != 'disabled' && mcu.gpsAvailable) {
            var coords = mcu.validCoordinates();
            if(coords) {
                //var now = moment(new Date(mcu.gps.time || mcu.lastGpsFix.time));
                var now = moment();
                info = "Lat: " + limitPrecison(coords.lat, 6) + "\t";
                info += "Lon: " + limitPrecison(coords.lon, 6) + "\t";
                info += "Altitude: " + limitPrecison(coords.alt, 1) + "\t";
                info += "Date: " + now.format("D MMMM YYYY") + "\t";
                info += "Time: " + now.format("h:mm:ss A") + "\t";
                info += "Timezone: " + now.format("z (ZZ)") + "\t";
                if(mcu.gps.fix) {
                    info += "GPS Fix: YES\t";
                } else {
                    info += "GPS Fix: NO (cached data)\t";
                }
                if(mcu.gps.satsActive) info += "Active Sats: " + mcu.gps.satsActive.length + "\t";
            } else {
               info = "GPS enabled\tAcquiring a position fix...\t";
               info += "Visible Sats: " + mcu.gps.satsVisible.length + "\t";
               if(mcu.gps.time) info += "Time: " + mcu.gps.time + "\t";
            }
        } else {
            info = "GPS unavailable.  The module is either powered off or not installed.";
        }
        return info;
    }

    var systemInfo = function(callback) {
        var info = "";
        info += "Timelapse+ VIEW\t";
        info += "UID: " + app.serial + "\t";
        info += "Version: " + updates.version + "\t";
        info += "MCU Firmware: " + mcu.version + "\t";
        info += "LibGPhoto2: " + updates.libgphoto2Version + "\t";
        info += "GPS Module: " + (gpsExists ? 'installed':'not installed') + "\t";

        var ip = "--";
        var mac = "--";

        exec('ifconfig', function(err, stdout) {
            var lines = stdout.split('\n');
            for(var i = 0; i < lines.length; i++) {
                var line = lines[i].trim();
                if(line.substr(0, 5) == 'wlan0') {
                    var res = line.match(/HWaddr ([0-9a-f][0-9a-f]:[0-9a-f][0-9a-f]:[0-9a-f][0-9a-f]:[0-9a-f][0-9a-f]:[0-9a-f][0-9a-f]:[0-9a-f][0-9a-f])/);
                    if(res && res.length > 1) {
                        mac = res[1];
                    }
                    if(i + 1 < lines.length) {
                        line = lines[i + 1];
                        res = line.match(/inet addr:([0-9]+.[0-9]+.[0-9]+.[0-9]+)/);
                        if(res && res.length > 1) {
                            ip = res[1];
                        }
                    }
                    break;
                }
            }
            info += "Wifi IP: " + ip + "\t";
            info += "Wifi MAC: " + mac + "\t";

            return callback && callback(null, info);
        });
    }

    var registrationEmail = false;
    db.get('registrationEmail', function(err, email) {
        if(!err && email) registrationEmail = email;
    });

    var registrationInfo = function() {
        var info = "";
        if(registrationEmail) {
                info += "This VIEW device is registered to " + registrationEmail + "\n";
                if(app.remote) {
                    info += "For remote operation, open app.view.tl on your phone and sign in with the above email address.\n";
                } else {
                    info += "Connect the VIEW to wifi to enable remote operation via app.view.tl\n";
                }
        } else {
            if(app.authCode) {
                info += "To complete registration and pair with the remote app, please complete the following:\n";
                info += "1) On your phone, open http://app.view.tl and sign in.\n";
                info += "2) Once signed into app.view.tl, click 'Add device' and enter this number: " + app.authCode + "\n";
            } else {
                info += "This device has not yet been registered with the remote app via app.view.tl\nTo complete this process, connect the VIEW to wifi and come back to this menu for further instructions.";
            }
        }
        return info;
    }

    var astroInfo = function() {
        var info = "";
        var coords = mcu.validCoordinates();
        if(coords) {
            var sunmoon = meeus.sunmoon(new Date(), coords.lat, coords.lon, coords.alt);
            var now = moment();
            var sunrise = moment(sunmoon.suntimes.rise);
            var sunset = moment(sunmoon.suntimes.set);
            var moonrise = moment(sunmoon.moontimes.rise);
            var moonset = moment(sunmoon.moontimes.set);

            info += "Current Time: " + now.format("h:mm:ss A") + "\t";
            info += "Sun sets at " + sunset.format("h:mm:ss A") + "\t   (" + sunset.fromNow() + ")\t";
            info += "Sun rises at " + sunrise.format("h:mm:ss A") + "\t   (" + sunrise.fromNow() + ")\t";
            info += "Moon rises at " + moonrise.format("h:mm:ss A") + "\t   (" + moonrise.fromNow() + ")\t";
            info += "Moon sets at " + moonset.format("h:mm:ss A") + "\t   (" + moonset.fromNow() + ")\t";
            var phase = "unknown";
            var phaseNumber = (sunmoon.mooninfo.phase * 180 / Math.PI) / 180 + 0.5
            if(phaseNumber == 0 || phaseNumber == 1) phase = "New Moon"; 
            else if(phaseNumber < 0.25) phase = "Waxing Crescent"; 
            else if(phaseNumber == 0.25) phase = "First Quarter";
            else if(phaseNumber > 0.25 && phaseNumber < 0.5) phase = "Waxing Gibbous";
            else if(phaseNumber == 0.5) phase = "Full Moon";
            else if(phaseNumber > 0.5 && phaseNumber < 0.75) phase = "Waning Gibbous";
            else if(phaseNumber == 0.75) phase = "Last Quarter";
            else if(phaseNumber > 0.75) phase = "Waning Crescent";
            info += "Phase: " + phase + "\t";
            info += "Moon illumination: " + Math.round(sunmoon.mooninfo.illumination * 100) + "%\t";
        } else {
           info = "GPS position info unavailable\t";
        }
        return info;
    }

    var getEclipseData = function() {
        var coords = mcu.validCoordinates();
        if(coords) {
            var data = eclipse.data;
            if(!data || data.lat != coords.lat || data.lon != coords.lon) {
                data = eclipse.calculate({lat: coords.lat, lon: coords.lon, alt: 300}); // hardcode altitude for now
                console.log("Eclipse data:", data);
            }
            return data;
        }
        return null;
    }

    var eclipseInfo = function() {
        var info = "";
        var coords = mcu.validCoordinates();
        if(coords) {
            var data = getEclipseData();
            if(data != null) {
                console.log("eclipse data:", data);
                var now = moment();
                var c1 = data.c1_timestamp ? moment(data.c1_timestamp) : null;
                var c2 = data.c2_timestamp ? moment(data.c2_timestamp) : null;
                var c3 = data.c3_timestamp ? moment(data.c3_timestamp) : null;
                var c4 = data.c4_timestamp ? moment(data.c4_timestamp) : null;
                info += "Next eclipse: " + c1.format("DD MMM YYYY") + ", with first contact starting at " + c1.format("h:mm:ss A ZZ") + "\t";
                info += "(" + c1.fromNow() + ")\n";
                if(c2 && c3) {
                    info += "This is a total eclipse, observable from the current location.  Totality will last a total of " + data.duration + ", starting at " + c2.format('h:mm:ss A');
                } else if(data.eclipseType == "T") {
                    info += "This is a total eclipse, but only a partial eclipse with " + Math.round(data.coverage * 100) + "% coverage will be observable at the current location.";
                } else if(data.eclipseType == "A") {
                    info += "This is a annular eclipse with " + Math.round(data.coverage * 100) + "% coverage observable from the current location.";
                } else {
                    info += "This is a partial eclipse with " + Math.round(data.coverage * 100) + "% coverage observable from the current location.";
                }
            } else {
                info += "No upcoming eclipses were found for the current location";                
            }
        } else {
           info = "GPS position info unavailable\t";
        }
        return info;
    }

    var setLatitudeAction = {
        type: 'function',
        fn: function(res, cb){
            cb(null, {
                name: "Custom Latitude",
                help: help.setCoordinates,
                type: "numberInput",
                value: mcu.customLatitude,
                onSave: function(result) {
                    db.set('custom-latitude', result);
                    console.log("MAIN: setting custom latitude to", result);
                    mcu.customLatitude = result;
                }
            });
        }
    }

    var setLongitudeAction = {
        type: 'function',
        fn: function(res, cb){
            cb(null, {
                name: "Custom Longitude",
                help: help.setCoordinates,
                type: "numberInput",
                value: mcu.customLongitude,
                onSave: function(result) {
                    db.set('custom-longitude', result);
                    console.log("MAIN: setting custom longitude to", result);
                    mcu.customLongitude = result;
                }
            });
        }
    }

    var setTimeAction = {
        type: 'function',
        fn: function(res, cb){
            cb(null, {
                name: "Current UTC time (hh:mm:ss)",
                help: help.setTime,
                type: "timeInput",
                value: new Date(),
                onSave: function(result) {
                    console.log("MAIN: setting time to", result.toString());
                    mcu.setTime(result);
                }
            });
        }
    }

    var setDateAction = {
        type: 'function',
        fn: function(res, cb){
            cb(null, {
                name: "Current UTC date",
                help: help.setDate,
                type: "dateInput",
                value: new Date(),
                onSave: function(result) {
                    console.log("MAIN: setting date to", result.toString());
                    mcu.setDate(result);
                }
            });
        }
    }

    var settingsMenu = {
        name: "settings",
        type: "menu",
        items: [{
            name: "Wireless Setup",
            action: wifiMenu,
            help: help.wifiMenu
        }, {
            name: "UI Preferences",
            action: interfaceSettingsMenu,
            help: help.interfaceSettingsMenu
        }, {
            name: "Software Version",
            action: softwareMenu,
            help: help.softwareMenu
        }, {
            name: "Motion Equipment",
            action: motionSetupMenu,
            help: help.motionSetupMenu
        }, {
            name: "Auto Power Off",
            action: autoPowerOffMenu,
            help: help.autoPowerOffMenu
        }, {
            name: "GPS Module",
            action: gpsEnableMenu,
            help: help.gpsEnableMenu,
            condition: function() {
                return gpsExists;
            },
        }, {
            name: "Set GPS latitude",
            help: help.setCoordinates,
            action: setLatitudeAction,
            condition: function() {
                return !gpsExists || power.gpsEnabled != 'enabled';
            },
        }, {
            name: "Set GPS longitude",
            help: help.setCoordinates,
            action: setLongitudeAction,
            condition: function() {
                return !gpsExists || power.gpsEnabled != 'enabled';
            },
        }, {
            name: "Set UTC Time",
            help: help.setTime,
            action: setTimeAction
        }, {
            name: "Set UTC Date",
            help: help.setDate,
            action: setDateAction
        }, {
            name: "Factory Reset",
            action: factoryResetConfirmMenu,
            help: help.eraseAllSettingsMenu
        }, {
            name: "Developer Mode",
            action: developerModeMenu,
            help: help.developerModeMenu
        }, {
            name: "Send camera report",
            action: function(){
                core.runSupportTest(function() {
                    ui.back();
                    app.sendLogs();
                });
            },
            condition: function() {
                return core.cameraConnected && !core.intervalometerStatus.running;
            },
            help: help.sendCameraReport
        }, {
            name: "Send log for review",
            action: function(){
                ui.load(createErrorReportReasonMenu(null));
            },
            help: help.sendLogsMenu
        }]
    }

    var infoMenu = {
        name: "info menu",
        type: "menu",
        items: [
        {
            name: "Power Info",
            action: function(){
                ui.back();
                ui.alert('Power Info', power.infoText);
            },
            help: help.powerInfo
        }, {
            name: "System Info",
            action: function(){
                ui.back();
                systemInfo(function(err, info) {
                    ui.alert('System Info', info);
                });
            },
            help: help.systemInfo
        }, {
            name: "Registration & App",
            action: function(){
                ui.back();
                ui.alert('Registration', registrationInfo);
            },
            help: help.registrationInfo
        }, {
            name: "GPS Info",
            action: function(){
                ui.back();
                ui.alert('GPS Info', gpsInfo);
            },
            condition: function() {
                return mcu.gpsAvailable;
            },
            help: help.gpsInfo
        }, {
            name: "Sun and Moon",
            action: function(){
                ui.back();
                ui.alert('Sun and Moon', astroInfo);
            },
            condition: function() {
                return mcu.validCoordinates();
            },
            help: help.sunAndMoon
        }, {
            name: "Eclipse Info",
            action: function(){
                ui.back();
                ui.alert('Solar Eclipse Info', eclipseInfo);
            },
            condition: function() {
                return mcu.validCoordinates();
            },
            help: help.eclipseInfo
        }]
    }

    var mainMenu = {
        name: "main menu",
        type: "menu",
        items: [{
            name: "Time-lapse",
            action: timelapseMenu,
            help: help.timelapseMenu
        }, {
            name: "Capture",
            action: captureMenu,
            help: help.captureMenu,
            condition: function() {
                return core.cameraSupports.liveview && !core.intervalometerStatus.running;
            }
        }, {
            name: "Time-lapse Clips",
            action: clipsMenu,
            help: help.clipsMenu
        }, {
            name: "Information",
            action: infoMenu,
            help: help.infoMenu
        }, {
            name: "Settings",
            action: settingsMenu,
            help: help.settingsMenu
        } ]
    }

    ui.init(oled);
    ui.load(mainMenu);

    inputs.on('D', function(move) {
        power.activity();
        if(oled.videoRunning) return;

        blockGestureTimer();
        if (blockInputs) return;

        if (move == "U") {
            ui.up();
        }
        if (move == "D") {
            ui.down();
        }
        if (move == "U+") {
            ui.up(true);
        }
        if (move == "D+") {
            ui.down(true);
        }
    });

    inputs.on('B', function(move) {
        power.activity();
        if(oled.videoRunning) {
            oled.stopVideo();
            return;
        }
        blockGestureTimer();
        if (blockInputs) return;

        if (move == "1") {
            ui.backButton();
        }
        if (move == "2") {
            ui.enter();
        }
        if (move == "3") {
            ui.button3();
        }
        if (move == "4") {
            ui.enter(true);
        }

        if (move == "5") {
            ui.help();
        }

        if (move == 6) {
            ui.load(powerConfirm, null, null, true);
        }
    });

    var confirmSaveXMPs = function(clip) {
        ui.confirmationPrompt("Save new XMPs to SD?", "write to SD", "cancel", help.saveXMPs, function(cb){
            oled.value([{
                name: "Writing to card",
                value: "please wait"
            }]);
            oled.update();
            if(clip) {
                clips.saveXMPsToCard(clip.index, function(err) {
                    ui.back();
                    if(err) {
                        ui.alert('Error Writing', "Error writing XMPs: " + err, null, true);
                    } else {
                        cb();
                    }
                }); 
            } else {
                ui.back();
                //cb();
            }
        }, null);
    }

    var confirmSaveSpreadsheet = function(clip) {
        ui.confirmationPrompt("Save CSV file to SD?", "write to SD", "cancel", help.writeSpreadsheet, function(cb){
            oled.value([{
                name: "Writing to card",
                value: "please wait"
            }]);
            oled.update();
            if(clip) {
                clips.saveSpreadsheetToCard(clip.index, function(err) {
                    ui.back();
                    if(err) {
                        ui.alert('Error Writing', "Error writing CSV: " + err, null, true);
                    } else {
                        cb();
                    }
                }); 
            } else {
                ui.back();
                //cb();
            }
        }, null);
    }

    var confirmDeleteClip = function(clip) {
        ui.confirmationPrompt("Delete " + clip.name + "?", "cancel", "Delete", help.deleteClip, null, function(cb){
            oled.value([{
                name: "Deleting Clip",
                value: "please wait"
            }]);
            oled.update();
            if(clip) {
                clips.deleteTimelapseClip(clip.index, function(err) {
                    ui.back();
                    cb();
                });
            } else {
                ui.back();
                cb();
            }
        });
    }

    var authDisplayed = false;
    var displayAuthCode = function(code) {
        authDisplayed = true;
        ui.load({
            name: "Enter code on app",
            type: "options",
            items: [{
                name: "Enter code on app",
                value: code,
                help: help.appCode,
                action: {
                    type: 'function',
                    fn: function(arg, cb) {
                        authDisplayed = false;
                        cb();
                    }
                }
            }, {
                name: "Enter code on app",
                value: "cancel",
                help: help.appCode,
                action: {
                    type: 'function',
                    fn: function(arg, cb) {
                        authDisplayed = false;
                        cb();
                    }
                }
            }]
        }, null, null, true);
    }

    var saveDefault = false;
    app.on('auth-required', function(code) {
        if(updates.installing) return;
        //if(authDisplayed) {
        //    ui.back();
        //    authDisplayed = false;
        //}
        oled.activity();
        power.activity();
        saveDefault = ui.defaultStatusString;
        ui.defaultStatus("app.view.tl code: " + code);
        ui.status("app.view.tl code: " + code);
        //displayAuthCode(code);
    });

    app.on('auth-complete', function(email) {
        console.log("connected to view.tl:", email);
        if(email && registrationEmail != email) {
            console.log("updating registrationInfo for", email);
            registrationEmail = email;
            db.set('registrationEmail', email);
        }
        if(authDisplayed) {
            ui.back();
            authDisplayed = false;
        }
        oled.activity();
        power.activity();
        if(saveDefault) ui.defaultStatus(saveDefault);
        saveDefault = false;
        ui.status('connected to view.tl');
    });

    app.on('logs-uploaded', function(count) {
        ui.alert('Success', help.logFilesUploaded);    
    })

    core.on('media.insert', function(type) {
        console.log("media inserted: ", type);
        oled.activity();
        power.activity();
        if(type = 'sd') {
            core.currentProgram.destination = 'sd';
            ui.reload();
        }
        clips.getLastTimelapse(function(err, timelapse) {
            if(!err && timelapse) confirmSaveXMPs(timelapse);
        });
    });

    core.on('media.remove', function(type) {
        console.log("media removed: ", type);
        if(type = 'sd') {
            core.currentProgram.destination = 'camera';
            ui.reload();
        }
    });



    var blockGestureTimer = function() {
        if (blockGestureHandle) clearTimeout(blockGestureHandle);
        if (gestureMode) {
            gestureMode = false;
            ui.reload();
        }
        blockGesture = true;
        blockGestureHandle = setTimeout(function() {
            blockGesture = false;
        }, 30000);
    }

    var gestureVideoPlaying = false;
    var gestureModeTimer = function() {
        if (gestureModeHandle) clearTimeout(gestureModeHandle);
        if (!gestureMode) {
            gestureMode = true;
            //oled.png('/home/view/current/media/gesture-oled.png');
        }
        gestureModeHandle = setTimeout(function() {
            if (gestureMode) {
                if(gestureVideoPlaying) {
                    gestureModeTimer();
                } else {
                    gestureMode = false;
                    oled.hide();
                    ui.reload();
                }
            }
        }, 5000);
    }


    inputs.on('G', function(move) {
        console.log("Gesture: " + move);
        gestureString += move;
        if(gestureString.length > 500) gestureString = "";
        power.activity();
        if (blockInputs) return;
        if(!core.intervalometerStatus.running) return; // only use gesture sensor when a time-lapse is running
        if (blockGesture) {
            console.log("(blocked)");
            return;
        }
        gestureModeTimer();
        if (!oled.visible) {
            oled.show();
            return;
        }

        if (move == "U") {
            //ui.up();
        }
        if (move == "D") {
            //ui.down();
        }
        if (move == "L") {
            if(gestureVideoPlaying) {
                gestureVideoPlaying = false;
                oled.stopVideo();
                gestureModeTimer();
            } else if(ui.currentOrigin() == 'alert') {
                ui.back();
            } else {
                gestureMode = false;
                oled.hide();
            }
        }
        if (move == "R") {
            if (!oled.visible) {
                oled.show();
            } else if(gestureVideoPlaying) {
                oled.videoSkipFrames(30*10);
            } else {
                console.log("running preview via gesture...");
                gestureVideoPlaying = true;
                core.getCurrentTimelapseFrames(null, function(err, framesPaths) {
                    if(framesPaths) {
                        oled.video(null, framesPaths, 30, function() {
                            gestureVideoPlaying = false;
                            gestureModeTimer();
                        });
                    } else {
                        gestureVideoPlaying = false;
                        gestureModeTimer();
                    }                            
                }) 
            }
        }
    });

}

var systemClosed = false;
function closeSystem(callback) {
    systemClosed = true;
    console.log("Shutting down!");
    app.close();
    if (VIEW_HARDWARE) {
        console.log("closing inputs...");
        inputs.stop();
    }
    try {
        db.set('intervalometer.currentProgram', core.currentProgram);
        if(mcu.lastGpsFix && !mcu.lastGpsFix.fromDb) {
            mcu.lastGpsFix.fromDb = true;
            console.log("saving gps data: ", mcu.lastGpsFix);
            db.set('lastGpsFix', mcu.lastGpsFix);
        }
    } catch(e) {
        console.log("Error while saving timelapse settings:", e);
    }
    console.log("closing db...");
    var cbDone = false;
    db.close(function(){
        console.log("db closed.");
        cbDone = true;
        if (VIEW_HARDWARE) {
            oled.close();
            //callback && callback();
        } else {
            //callback && callback();
        }
    });

    cbDone = true;
    callback && callback();

    //setTimeout(function(){
    //    if(!cbDone) {
    //        console.log("db failed to close, continuing...");
    //        cbDone = true;
    //        callback && callback();
    //    }
    //}, 1000);
    //db.setCache('intervalometer.status', core.intervalometerStatus);
}

nodeCleanup(function (exitCode, signal) {
    if(signal) {
        console.log("Shutting down from signal", signal);
    } else if (exitCode) {
        console.log("Shutting down from error", exitCode);
    } else {
        console.log("Shutting down normally, assuming closeSystem is already called.");
        return;
    }
    if(updates.updatingKernel) {
        console.log("Kernel update in progress, delaying shutdown by 10 seconds...");
        setTimeout(function() {
            process.exit();
        }, 10000);
        return;
    }
    if(systemClosed) {
        nodeCleanup.uninstall(); // don't call cleanup handler again
        console.log("Shutting down, second attempt, sending SIGKILL");
        process.kill(process.pid, 'SIGKILL');
    } else {
        closeSystem(function() {
            console.log("Shutting down complete, exiting");
            //console.log("_getActiveHandles:", process._getActiveHandles());
            //console.log("_getActiveRequests:", process._getActiveRequests());
            nodeCleanup.uninstall();
            exec("sleep 2; kill -s 9 " + process.pid, function(){

            });
            process.kill(process.pid);
        });
    }
    return false;
});

db.get('intervalometer.currentProgram', function(err, data) {
    if(!err && data) {
        console.log("Loading saved intervalometer settings...", data);
        core.loadProgram(data);
    }
});

db.get('chargeLightDisabled', function(err, en) {
    if(!err) {
        power.init(en == "yes");
    }
});

db.get('gpsEnabled', function(err, en) {
    if(err || !en) {
        if(mcu.gpsAvailable === null) {
            mcu.once('gps', function(status) {
                if(!gpsExists) {
                    gpsExists = (status > 0);
                    db.set('gpsExists', gpsExists ? 'yes' : 'no');
                }
                power.gps(status > 0);
            });
        } else {
            if(!gpsExists) {
                gpsExists = mcu.gpsAvailable;
                db.set('gpsExists', gpsExists ? 'yes' : 'no');
            }
            power.gps(mcu.gpsAvailable);
        }
    } else {
        power.gps(en != "no");
    }
});
db.get('gpsExists', function(err, e) {
    if(!err) gpsExists = (e == 'yes');
});

db.get('custom-latitude', function(err, lat) {
    mcu.customLatitude = lat;
});

db.get('custom-longitude', function(err, lon) {
    mcu.customLongitude = lon;
});


db.get('buttonMode', function(err, mode) {
    power.setButtons(mode);
});

db.get('gestureSensor', function(err, en) {
    if(en != "no") {
        setTimeout(function(){
            inputs.startGesture();
        }, 60000);
    } else {
        inputs.stopGesture();
    }
});

db.get('colorTheme', function(err, theme) {
    if(!err && theme) {
        oled.setTheme(theme);
    }
});

db.get('audioAlerts', function(err, audio) {
    if(!err && audio) {
        ui.audio = audio;
    }
});

db.get('developerMode', function(err, en) {
    if(!err) {
        updates.developerMode = (en == "yes");
    }
});

db.get('autoOffMinutes', function(err, minutes) {
    if(!err) {
        if(minutes === null) minutes = 10;
        if(!minutes) minutes = false;
        power.setAutoOff(minutes);
    }
});

db.get('lastGpsFix', function(err, res) {
    if(!err && res && !mcu.lastGpsFix) {
        res.fromDb = true;
        mcu.lastGpsFix = res;
    }
});

db.get('timezone', function(err, tz) {
    if(!err && tz) {
        mcu.setTz(tz);
    }
});

mcu.on('timezone', function(tz) {
    db.get('timezone', function(err, tzOld) {
        if(err || !tzOld || tzOld != tz) {
            db.set('timezone', tz);
        }
    });
});

mcu.on('gps', function(index) {
    oled.setIcon('gps', index == 2);
    ui.reload();
});

light.start();

core.watchdogEnable();

app.on('message', function(msg) {
    power.activity();
    try {
        switch(msg.type) {
            case 'dbGet':
                if(msg.key) {
                    (function(key, reply) {
                        db.get(key, function(err, val){
                            if(val === undefined) val = null;
                            console.log("dbVal:", key, val ? val.id : val);
                            reply('dbVal', {
                                key: key,
                                val: val,
                                error: err
                            });
                        });
                    })(msg.key, msg.reply);
                }
                break;

            case 'dbSet':
                if(msg.key) {
                    (function(key, val, reply) {
                        if(val === undefined) val = null;
                        db.set(key, val, function(err){
                            reply('dbSet', {
                                error: err,
                                key: key,
                            });
                        });
                    })(msg.key, msg.val, msg.reply);
                }
                break;

            case 'clip-log-report':
                if(msg.name) {
                    console.log("Log report:", msg);
                    (function(name, reply) {
                        db.sendLog(name, 'UNKNOWN', function() {
                            app.sendLogs();
                            reply('clip-log-report', {
                                message: help.logsQueued,
                            });
                        });
                    })(msg.name, msg.reply);
                }
                break;

            case 'camera-images':
                var response = {};
                core.getFilesList(function(err, files){
                    if(msg.start && msg.start > 0) {
                        response.startIndex = msg.start;
                    } else {
                        response.startIndex = 0;
                    }
                    response.totalImages = files ? files.length : 0;
                    response.count = response.totalImages - response.startIndex > 25 ? 25 : response.totalImages - response.startIndex;
                    if(files && response.count > 0) {
                        response.fileNames = files.slice(response.startIndex, response.startIndex + response.count);
                        async.mapSeries(response.fileNames, core.downloadThumbnail, function(err, results) {
                            response.images = results;
                            response.error = err;
                            msg.reply('camera-images', response);
                        });
                    } else {
                        msg.reply('camera-images', response);
                    }
                });
                break;

            case 'motion':            
                if (msg.key == "move" && msg.motor && msg.driver) {
                    console.log("moving motor " + msg.motor);
                    (function(driver, motor, steps, reply) {
                        core.moveMotion(driver, motor, steps, function(err, position) {
                            reply('move', {
                                complete: true,
                                motor: motor,
                                driver: driver,
                                position: position
                            });
                        });
                    })(msg.driver, msg.motor, msg.val, msg.reply);
                } else if (msg.key == "joystick" && msg.motor && msg.driver) {
                    console.log("moving motor " + msg.motor);
                    (function(driver, motor, speed, reply) {
                        core.moveMotionJoystick(driver, motor, speed, function(err, position) {
                            reply('move', {
                                complete: true,
                                motor: motor,
                                driver: driver,
                                position: position
                            });
                        });
                    })(msg.driver, msg.motor, msg.val, msg.reply);
                } else if (msg.key == "zero" && msg.motor && msg.driver) {
                    console.log("zero motor " + msg.motor);
                    (function(driver, motor, reply) {
                        core.zeroMotion(driver, motor, function(err) {
                            reply('move', {
                                complete: true,
                                motor: motor,
                                driver: driver,
                                position: 0
                            });
                        });
                    })(msg.driver, msg.motor, msg.reply);
                } else if (msg.key == "cancelCalibration" && msg.motor && msg.driver) {
                    console.log("calibrating motor " + msg.motor);
                    (function(driver, motor, reply) {
                        core.motionCancelCalibration(driver, motor, function(err, backlash) {
                            reply('cancelCalibration', {
                                complete: true,
                                error: err,
                                motor: motor,
                                driver: driver,
                                backlash: backlash
                            });
                        });
                    })(msg.driver, msg.motor, msg.reply);
                } else if (msg.key == "calibrate" && msg.motor && msg.driver) {
                    console.log("calibrating motor " + msg.motor);
                    (function(driver, motor, reply) {
                        core.motionCalibrateBacklash(driver, motor, function(err, backlash) {
                            reply('calibrate', {
                                complete: true,
                                error: err,
                                motor: motor,
                                driver: driver,
                                backlash: backlash
                            });
                        });
                    })(msg.driver, msg.motor, msg.reply);
                } else if (msg.key == "setPosition" && msg.motor && msg.driver && msg.position != null) {
                    console.log("setPosition", msg.driver, "motor", msg.motor, "pos", msg.position);
                    (function(driver, motor, position, reply) {
                        core.setMotionPosition(driver, motor, position, function(err) {
                            reply('move', {
                                complete: true,
                                motor: motor,
                                driver: driver,
                                position: position
                            });
                        });
                    })(msg.driver, msg.motor, msg.position, msg.reply);
                } else if (msg.key == "setBacklash" && msg.motor && msg.driver && msg.backlash != null) {
                    console.log("setBacklash", msg.driver, "motor", msg.motor, "backlash", msg.backlash);
                    (function(driver, motor, backlash, reply) {
                        core.motionSetBacklash(driver, motor, backlash, function(err) {
                            reply('setBacklash', {
                                complete: true,
                                motor: motor,
                                driver: driver,
                                backlash: backlash
                            });
                        });
                    })(msg.driver, msg.motor, msg.backlash, msg.reply);
                }
                break;

            case 'focus':
                if (msg.key == "manual") {
                    (function(lastLV) {
                        if(!lastLV && core.cameraModel.match(/canon|nikon/i)) {
                            core.preview(function(){
                                core.focus(msg.val, msg.repeat, function(err, pos){
                                    console.log("MAIN: focus complete");
                                    msg.reply('focus', {
                                        complete: true,
                                        position: pos
                                    });
                                    core.lvOff();
                                });
                            });
                        } else {
                            core.focus(msg.val, msg.repeat, function(err, pos){
                                console.log("MAIN: focus complete");
                                msg.reply('focus', {
                                    complete: true,
                                    position: pos
                                });
                            });
                        }
                    })(liveviewOn);
                } else {
                    msg.reply('focus', {
                        complete: true,
                        position: pos
                    });
                }
                break;

            case 'capture':
                (function(lastLV) {
                    liveviewOn = 0;
                    core.capture(null, function(err){
                        if(err) {
                            msg.reply('captureError', {msg:err});
                        }
                        setTimeout(function(){
                            if(lastLV && liveviewOn !== false) {
                                liveviewOn = true;
                                core.preview();
                            } else {
                                liveviewOn = false;
                            }
                        }, 2000);
                    });
                })(liveviewOn);
                break;
    
            case 'capture-test':
                core.captureTest(function(err){
                    if(err) {
                        msg.reply('captureError', {msg:err});
                    }
                });
                break;

            case 'save-program':
                core.loadProgram(msg.program);
                break;

            case 'run':
                if(!msg.program.coords || msg.program.coords.src != 'app') msg.program.coords = mcu.validCoordinates();
                core.loadProgram(msg.program);
                core.startIntervalometer(msg.program, msg.date);
                break;

            case 'stop':
                core.stopIntervalometer();
                break;

            case 'moveTracking':
                core.moveTracking(msg.axis, msg.degrees);
                break;

            case 'moveFocus':
                core.moveFocus(msg.steps);
                break;

            case 'updateProgram':
                core.updateProgram(msg.updates);
                break;

            case 'dynamicChange':
                core.dynamicChange(msg.parameter, msg.newValue, msg.frames);
                break;

            case 'reconfigureProgram':
                msg.reply('timelapseProgram', {program:reconfigureProgram(msg.program)});
                break

            case 'timelapse-clips':
                clips.getRecentTimelapseClips(30, function(err, clips) {
                    if (clips) {
                        msg.reply('timelapse-clips', {
                            clips: clips.map(function(clip) {
                                if (clip.image) clip.image = new Buffer(clip.image).toString('base64');
                                return clip;
                            })
                        });
                    }
                });
                break;

            case 'timelapse-clip-info':
                db.getTimelapseByName(msg.name, function(err, dbClip) {
                    if (dbClip) {
                        msg.reply('timelapse-clip-info', {
                            info: dbClip
                        });
                    }
                });
                break;

            case 'current-images':
                core.getCurrentTimelapseFrames(null, function(err, framesPaths) {
                    if(framesPaths) {
                        var startFrame = 0;
                        if(msg.start) startFrame = parseInt(msg.start);
                        if(!startFrame) startFrame = 0;
                        if(startFrame >= framesPaths.length) {
                            msg.reply('current-images', {
                                index: 'current',
                                fragment: 0,
                                fragments: 0,
                                images: []
                            });
                        } else {
                            framesPaths = framesPaths.slice(startFrame);
                            var fragmentSize = 50;
                            var fragments = Math.ceil(framesPaths.length / fragmentSize);
                            var fragment = 0;
                            var sendFragment = function(start){
                                console.log("sending time-lapse fragment " + fragment + " of " + fragments);
                                clips.getTimelapseImagesFromPaths(framesPaths.slice(fragment * fragmentSize, fragment * fragmentSize + fragmentSize), true, function(err, images) {
                                    if(!err && images) {
                                        msg.reply('timelapse-images', {
                                            index: 'current',
                                            start: fragment * fragmentSize + start,
                                            fragment: fragment,
                                            fragments: fragments,
                                            images: images.map(function(image) {
                                                image = new Buffer(image).toString('base64');
                                                return image;
                                            })
                                        }, function() {
                                            fragment++;
                                            if(fragment < fragments) process.nextTick(function(){sendFragment(start)});
                                        });
                                    } else {
                                        msg.reply('timelapse-images', {
                                            index: 'current',
                                            start: fragment * fragmentSize + start,
                                            fragment: fragment,
                                            fragments: fragments,
                                            images: [],
                                            err: err
                                        }, function() {
                                            fragment++;
                                            if(fragment < fragments) process.nextTick(function(){sendFragment(start)});
                                        });
                                    }
                                });
                            };
                            sendFragment(msg.start);
                        }
                    }                            
                });
                break;

            case 'timelapse-images':
                clips.getClipFramesCount(msg.index, function(err, frames) {
                    if(!err && frames) {
                        var fragmentSize = 50;
                        var fragments = Math.ceil(frames / fragmentSize);
                        var fragment = 0;

                        var sendFragment = function(){
                            console.log("sending time-lapse fragment " + fragment + " of " + fragments);
                            clips.getTimelapseImagesHq(msg.index, fragment * fragmentSize, fragmentSize, function(err, images) {
                                if(!err && images) {
                                    msg.reply('timelapse-images', {
                                        index: msg.index,
                                        fragment: fragment,
                                        fragments: fragments,
                                        images: images.map(function(image) {
                                            image = new Buffer(image).toString('base64');
                                            return image;
                                        })
                                    }, function() {
                                        fragment++;
                                        if(fragment < fragments) process.nextTick(sendFragment);
                                    });
                                } else {
                                    msg.reply('timelapse-images', {
                                        index: msg.index,
                                        fragment: fragment,
                                        fragments: fragments,
                                        images: []
                                    }, function() {
                                        fragment++;
                                        if(fragment < fragments) process.nextTick(sendFragment);
                                    });
                                }
                            });
                        };
                        sendFragment();
                    } else {
                        msg.reply('timelapse-images', {
                            index: msg.index,
                            error: "failed to retrieve images"
                        });
                    }

                });
                break;

            case 'xmp-to-card':
                clips.saveXMPsToCard(msg.index, function(err) {
                    msg.reply('xmp-to-card', {
                        index: msg.index,
                        error: err
                    });
                });
                break;

            case 'delete-clip':
                clips.deleteTimelapseClip(msg.index, function(err) {
                    msg.reply('delete-clip', {
                        index: msg.index,
                        error: err
                    });
                });
                break;

            case 'previewStream':
                if (!liveviewOnStream && !core.intervalometerStatus.running) {
                    liveviewOnStream = true;
                    liveviewOn = false;
                    liveviewOnApp = true;
                    liveviewRequestStart = false;
                    core.previewFull();
                }
                break;

            case 'previewStop':
                console.log("liveview stop request");
                clearTimeout(liveviewOnAppTimeout);
                setTimeout(function(){
                    console.log("liveview stop request");
                    liveviewOn = false;
                    liveviewOnApp = false;
                    liveviewOnStream = false;
                    liveviewRequestStart = false;
                    core.lvOff();
                    ui.reload();
                    if(!core.intervalometerStatus.running) power.performance('medium');
                }, 200);
                break;

            case 'preview':
                console.log("preview request, liveview active:", liveviewOn);
                if (liveviewOn) {
                    liveviewOnApp = true;
                    if (previewImage) {
                        if(previewImage.time > previewImageLastTime) {
                            console.log("preview request, using cached frame:", !!previewImage);
                            previewImageLastTime = previewImage.time;
                            app.send('photo');
                            app.send('thumbnail', previewImage);
                        } else {
                            liveviewRequestStart = true;
                        }
                    }
                } else {
                    if(!core.intervalometerStatus.running) {
                        previewImageLastTime = new Date();
                        liveviewRequestStart = true;
                        liveviewOn = true;
                        liveviewOnApp = true;
                        power.performance('high');
                        core.preview();
                    }
                }
                if(liveviewOnAppTimeout) clearTimeout(liveviewOnAppTimeout);
                liveviewOnAppTimeout = setTimeout(function(){
                    if(liveviewOnApp) {
                        console.log("liveview app timeout");
                        liveviewOn = false;
                        liveviewOnApp = false;
                        liveviewOnStream = false;
                        liveviewRequestStart = false;
                        core.lvOff();
                        ui.reload();
                        if(!core.intervalometerStatus.running) power.performance('medium');
                    }
                }, 5000);
                break;

            case 'zoom':
                if (!msg.reset && msg.xPercent && msg.yPercent) {
                    core.zoom(msg.xPercent, msg.yPercent);
                } else {
                    core.zoom();
                }
                break;

            case 'set':
                if (msg.key && msg.val) core.set(msg.key, msg.val);
                break;

            case 'dismiss-error':
                ui.dismissAlert();
                break;

            case 'setEv':
                if (msg.ev) {
                    if (core.cameraConnected) {
                        core.setEv(msg.ev, {}, function() {
                            core.getSettings(function() {
                                core.cameraSettings.stats = lists.evStats(core.cameraSettings);
                                msg.reply('settings', {
                                    settings: core.cameraSettings
                                });
                            });
                        });
                    }
                }
                break;

            case 'setEvUp':
                if (core.cameraConnected) {
                    core.getSettings(function() {
                        core.cameraSettings.stats = lists.evStats(core.cameraSettings);
                        core.setEv(core.cameraSettings.stats.ev+1/3, {}, function() {
                            core.getSettings(function() {
                                core.cameraSettings.stats = lists.evStats(core.cameraSettings);
                                msg.reply('settings', {
                                    settings: core.cameraSettings
                                });
                            });
                        });
                    });
                }
                break;

            case 'setEvDown':
                if (core.cameraConnected) {
                    core.getSettings(function() {
                        core.cameraSettings.stats = lists.evStats(core.cameraSettings);
                        core.setEv(core.cameraSettings.stats.ev-1/3, {}, function() {
                            core.getSettings(function() {
                                core.cameraSettings.stats = lists.evStats(core.cameraSettings);
                                msg.reply('settings', {
                                    settings: core.cameraSettings
                                });
                            });
                        });
                    });
                }
                break;

            case 'get':
                if (msg.key == "settings") {
                    if (core.cameraConnected) {
                        if(core.intervalometerStatus && core.intervalometerStatus.running) {
                            settings: core.cameraSettings
                        } else {
                            core.getSettings(function() {
                                core.cameraSettings.stats = lists.evStats(core.cameraSettings);
                                msg.reply('settings', {
                                    settings: core.cameraSettings
                                });
                            });
                        }
                    } else {
                        msg.reply('settings', {
                            settings: null,
                        });
                    }
                } else if (msg.key == "light") {
                    msg.reply('light', {
                        light: light.ev()
                    });
                } else if (msg.key == "battery") {
                    updateAppBattery();
                } else if (msg.key == "motion") {
                    core.motionStatusUpdate(function(motion){
                        msg.reply('motion', motion);
                    });
                } else if (msg.key == "program") {
                    if(!core.currentProgram.keyframes) {
                        core.currentProgram.keyframes = [{
                            focus: 0,
                            ev: "not set",
                            motor: {}
                        }]
                    }
                    msg.reply('timelapseProgram', {program: core.currentProgram});
                } else if (msg.key == "status") {
                    msg.reply('intervalometerStatus', {status: core.intervalometerStatus});
                } else if (msg.key == "thumbnail") {
                    if (core.photo && core.photo.jpeg) {
                        msg.reply('thumbnail', {
                            jpeg: new Buffer(core.photo.jpeg).toString('base64'),
                            zoomed: core.photo.zoomed,
                            type: core.photo.type
                        });
                    }
                } else if (msg.key == "camera") {
                    msg.reply('camera', {
                        connected: core.cameraConnected,
                        model: core.cameraConnected ? core.cameraModel : '',
                        supports: core.cameraConnected ? core.cameraSupports : {}
                    });
                    if (cache.intervalometerStatus) {
                        msg.reply('intervalometerStatus', {
                            status: cache.intervalometerStatus
                        });
                    }
                }
                break;

            default:
                throw "invalid message: unknown type";
        }
    } catch (err) {
        console.log("Error while processing message:", msg, err);
        return;
    }
});

var thmIndex = "1";
core.on('camera.photo', function() {
    if (core.photo && core.photo.jpeg) {
        console.log("EVENT: camera.photo, type=", core.photo.type);
        if (core.intervalometerStatus.running) {
            liveviewOn = false;
            liveviewOnStream = false;
            liveviewRequestStart = false;
            var size = {
                x: 105,
                y: 65,
                q: 80
            }
            if (VIEW_HARDWARE) {
                image.downsizeJpeg(new Buffer(core.photo.jpeg), size, null, function(err, jpgBuf) {
                    if (!err && jpgBuf) {
                        image.saveTemp("oledthm" + thmIndex, jpgBuf, function(err, path) {
                            if(thmIndex == "1") thmIndex = "2"; else thmIndex = "1"; // alternate to avoid reading partial file
                            oled.updateThumbnailPreview(path);
                        });
                    }
                });
            }
        } else {
            if(core.photo.type == 'preview-full') {
                if(liveviewOnStream) core.previewFull();
                app.addJpegFrame(core.photo.jpeg);
            } else {
                //app.addJpegFrame(core.photo.jpeg);
                //app.addJpegFrame(core.photo.jpeg);
                var size = {
                    x: 160,
                    q: 80
                }
                if (VIEW_HARDWARE && (core.photo.type != 'preview' || (liveviewOn && !liveviewOnApp))) {
                    console.log("displaying image...", core.photo.type);
                    image.downsizeJpeg(new Buffer(core.photo.jpeg), size, null, function(err, jpgBuf) {
                        if (!err && jpgBuf) {
                            image.saveTemp("oledthm", jpgBuf, function(err, path) {
                                var isoText = (core.cameraSettings && core.cameraSettings.iso) ? core.cameraSettings.iso : "---";
                                var shutterText = (core.cameraSettings && core.cameraSettings.shutter) ? core.cameraSettings.shutter : "---";
                                var apertureText = (core.cameraSettings && core.cameraSettings.aperture) ? core.cameraSettings.aperture : "---";

                                oled.liveview(path, shutterText + "    f/" + apertureText + "    ISO " + isoText);
                            });
                        }
                    });
                }
            }
        }

        previewImage = {
            jpeg: core.photo.base64,
            zoomed: core.photo.zoomed,
            imageType: core.photo.type,
            histogram: core.photo.histogram,
            time: new Date()
        };

        if (previewImage.imageType == "photo" || previewImage.imageType == "test" || previewImage.imageType == "thumbnail" || liveviewRequestStart) {
            liveviewRequestStart = false;
            previewImageLastTime = previewImage.time;
            setTimeout(function(){
                app.send('photo');
                app.send('thumbnail', previewImage);
            }, liveviewRequestStart ? 50 : 0);
        }
        if (previewImage.imageType == "preview" && !core.intervalometerStatus.running) {
            if(liveviewOn) {
                console.log("LV: requesting next frame");
                setTimeout(core.preview, liveviewOnApp ? 150 : 0);
            }
        }
    } else {
        console.log("EVENT: camera.photo UNKNOWN, type=", core.photo);
    }
});

core.on('camera.histogram', function(histogram) {
    oled.updateHistogram(histogram);
    app.send('histogram', {
        histogram: histogram
    });
});

app.on('connected', function(connected) {
    oled.setIcon('web', connected);
    ui.reload();
});

core.on('camera.settings', function() {
    app.send('settings', {
        settings: core.cameraSettings
    });
});

var btBlockedForSony = false;
core.on('camera.connected', function() {
    if(core.cameraModel == "SonyWifi") {
        app.disableRemote();
        wifi.noReset = true;
        if(wifi.btEnabled) {
            wifi.blockBt();
            console.log("MAIN: blocking BT for SonyWifi");
            btBlockedForSony = true;
        }
    }
    oled.setIcon('camera', true);
    setTimeout(function() {
        app.send('camera', {
            connected: true,
            model: core.cameraModel,
            supports: core.cameraSupports
        });
        if (VIEW_HARDWARE) {
            ui.status(core.cameraModel);
            ui.reload();
        }
    }, 1000);
});

var defaultStatus = "VIEW " + updates.getCurrentVersion();
ui.defaultStatus(defaultStatus);
ui.status(defaultStatus);
console.log("Setting default status to '" + defaultStatus + "'")

core.on('camera.exiting', function() {    
    if(btBlockedForSony) {
        wifi.unblockBt();
        wifi.noReset = false;
    }
    oled.setIcon('camera', false);
    app.send('camera', {
        connected: false,
        model: '',
        supports: {}
    });
    if (VIEW_HARDWARE) {
        ui.defaultStatus(defaultStatus);
        ui.status("camera disconnected");
        ui.reload();
    }
});

core.on('camera.error', function(err) {
    if(!liveviewOn) app.send('error', {
        error: err
    });
});

core.on('camera.status', function(msg) {
    app.send('status', {
        status: msg
    });
    if (!blockInputs && VIEW_HARDWARE) {
        ui.status(msg);
        if (core.cameraConnected) {
            ui.defaultStatus(core.cameraModel);
        } else {
            ui.defaultStatus(defaultStatus);
        }
    }
});

core.on('intervalometer.currentProgram', function(msg) {
    app.send('timelapseProgram', {program: core.currentProgram});
});

core.on('intervalometer.status', function(msg) {
    //console.log("intervalometer.status", core.intervalometerStatus);
    //console.log("core.cameraSettings", core.cameraSettings);
    //return;
    if(msg.running) {
        mcu.disableGpsTimeUpdate = true;
        power.disableAutoOff();
    } else if(cache.intervalometerStatus.running) {
        power.enableAutoOff();
        mcu.disableGpsTimeUpdate = false;
    }
    app.send('intervalometerStatus', {
        status: msg
    });
    cache.intervalometerStatus = msg;

//img116x70, isoText, apertureText, shutterText, intervalSeconds, intervalModeChar, hist60, ramp30, frames, remaining, durationSeconds, bufferSeconds, shutterSeconds
    var evText = (Math.round(lists.getEvFromSettings(core.cameraSettings) * 10) / 10).toString();
    var statusScreen = {
        isoText: msg.cameraSettings.iso,
        shutterText: msg.cameraSettings.shutter,
        apertureText: (msg.cameraSettings.details && msg.cameraSettings.details.aperture) ? ("f/" + msg.cameraSettings.details.aperture.name) : ("f/" + lists.getNameFromEv(lists.aperture, core.currentProgram.manualAperture) + ' (m)'),
        evText: evText + " EV",
        intervalSeconds: msg.intervalMs / 1000,
        bufferSeconds: msg.autoSettings ? msg.autoSettings.paddingTimeMs / 1000 : 5,
        rampModeText: core.currentProgram.rampMode,
        intervalModeText: core.currentProgram.rampMode == 'auto' ? core.currentProgram.intervalMode : 'fixed',
        frames: msg.frames,
        remaining: msg.framesRemaining,
        shutterSeconds: msg.cameraSettings.details.shutter ? lists.getSecondsFromEv(msg.cameraSettings.details.shutter.ev) : 0,
        durationSeconds: (new Date() / 1000) - msg.startTime,
        captureStartTime: msg.captureStartTime,
        running: msg.running
    }
    console.log("statusScreen", statusScreen);
    oled.updateTimelapseStatus(statusScreen);
    ui.reload();
    if (msg.message != "running" && !blockInputs && VIEW_HARDWARE) {
        ui.status(msg.message);
    }
});

core.on('camera.connectionError', function(msg) {
    if(ui.currentOrigin() == 'alert') {
        ui.back();
    }
    ui.alert('ERROR', msg, null, true);
    app.send('connectionError', {
        msg: msg
    });
    console.log("Camera connection ERROR: ", msg);
});

core.on('intervalometer.error', function(msg) {
    if(ui.currentOrigin() == 'alert') {
        ui.back();
    }
    ui.alert('ERROR', msg, null, true);
    app.send('intervalometerError', {
        msg: msg
    });
    console.log("Intervalometer ERROR: ", msg);
});

core.on('motion.status', function(status) {
    console.log("motion.status", status)
    app.send('motion', status);
    if (status.available) {
        oled.setIcon('bt', true);
        //stopScan();
        ui.reload();
    } else {
        oled.setIcon('bt', false);
        ui.reload();
        if(status.reload && wifi.btEnabled) {
            console.log("motion disconnected, reloading BT")
            wifi.resetBt(function(){
                //startScan();
            });
        }
    }
});

nodeModuleCache.stop();


