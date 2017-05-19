/*jslint node:true,vars:true,bitwise:true */
'use strict';

var VIEW_HARDWARE = true; // is this running on official VIEW hardware?

console.log('Starting up...');

var _ = require('underscore');
var async = require('async');
var exec = require('child_process').exec;
var crypto = require('crypto');
var fs = require('fs');
var moment = require('moment');
console.log('Server modules loaded');

var sys = require('sys')
console.log('System modules loaded');

require('rootpath')();
var lists = require('./camera/ptp/lists.js');
var updates = require('./system/updates.js');
var clips = require('./intervalometer/clips.js');
var core = require('./intervalometer/intervalometer-client.js');
//var nmx = require('./drivers/nmx.js');
var image = require('./camera/image/image.js');
if (VIEW_HARDWARE) {
    var light = require('./hardware/light.js');
    var oled = require('./hardware/oled.js');
    var ui = require('./interface/ui.js');
    var help = require('./interface/help.js');
    var inputs = require('./hardware/inputs.js');
    var power = require('./hardware/power.js');
    var mcu = require('./hardware/mcu.js');
}

var wifi = require('./system/wifi.js');
if(power) wifi.power = power; // allow wifi module to control power
var app = require("./system/app.js");
var db = require("./system/db.js");

var suncalc = require('suncalc');

var previewImage = null;
var liveviewOn = false;
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

console.log('Modules loaded.');

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
        db.get('wifi-status', function(err, wifiStatus) {
            if(wifiStatus) {
                if(wifiStatus.enabled) {
                    wifi.btEnabled = true;
                    wifi.enable(function(){
                        db.get('bt-status', function(err, status) {
                            if(status && status.enabled) {
                                wifi.enableBt();
                            } else {
                                wifi.disableBt();
                            }
                        });
                        setTimeout(function(){
                            if(!wifi.connected) {
                                if(wifiStatus.apMode) {
                                    wifi.enableAP();
                                }
                                if(wifiStatus.connect) {
                                    wifi.connect(wifiStatus.connect, wifiStatus.password);
                                }
                            }
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
                            } else {
                                wifi.disableBt();
                            }
                        });

                        if(!wifi.connected) {
                            wifi.enableAP();
                        }
                    },5000);
                });
            }
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
    wifi.on('connect', function(ssid) {
        app.enableRemote();
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
            core.resetBt();
            wifi.resetBt();
        }
        if(reload) ui.reload();
    });
    wifi.on('disabled', function(reload) {
        wifiWasDisabled = true;
        app.disableRemote();
        oled.setIcon('wifi', false);
        if(reload) ui.reload();
    });
    wifi.on('disconnect', function(previousConnection) {
        app.disableRemote();
        oled.setIcon('wifi', false);
        ui.status('wifi disconnected');
        if(previousConnection && previousConnection.address) {
            var currentTime = wifiConnectionTime = new Date().getTime();
            if(currentTime - wifiConnectionTime < 30 * 1000) {
                // show alert -- authentication probably failed
                ui.alert('Error', "WiFi failed to connect to " + previousConnection.ssid + ".\nTry again, double-checking that the password is correct.\nNote: if it continues to fail to connect, try a different access point if possible.  There might be an issue with connection to Apple Airport wireless routers.  This will hopefully be resolved in the near future.");
            } else {
                wifiConnectionTime = new Date().getTime();
                wifi.disable(function(){
                    setTimeout(configureWifi, 2000);
                });
            }
        }
        ui.reload();
    });

    power.on('charging', function(status) {
        oled.chargeStatus(status);
    });

    power.on('warning', function(status) {
        if(status) ui.status('low battery');
    });

    power.on('percentage', function(percentage) {
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
            action: ui.set(core.currentProgram, 'rampMode', 'fixed')
        }, {
            name: "Timelapse Mode",
            value: "Auto Ramping",
            help: help.rampingOptions,
            action: ui.set(core.currentProgram, 'rampMode', 'auto')
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
    for (var i = 5; i < 12; i++) interval.items.push({
        name: "Interval",
        help: help.interval,
        value: i + " seconds",
        action: ui.set(core.currentProgram, 'interval', i)
    });
    for (var i = 12; i < 35; i += 2) interval.items.push({
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

    var rampingOptionsMenu = {
        name: "Ramping Options",
        type: "menu",
        items: [{
            name: valueDisplay("Night Exposure", core.currentProgram, 'nightCompensation'),
            action: rampingNightCompensation,
            help: help.rampingNightCompensation
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
            var stats, ev;

            function captureButtonHandler(b) {
                oled.activity();
                power.activity();
                if (b == 1 || b == 4) {
                    liveviewOn = false;
                    blockInputs = false;
                    core.lvOff();
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
                            console.log("setting ev to ", ev);
                            core.setEv(ev, {
                                cameraSettings: core.cameraSettings
                            });
                        }
                    } else if (d == 'D') {
                        if (stats.ev > stats.minEv) {
                            ev -= 1 / 3;
                            console.log("setting ev to ", ev);
                            core.setEv(ev, {
                                cameraSettings: core.cameraSettings
                            });
                        }
                    }
                }
            }

            liveviewOn = true;
            core.preview();
            console.log("started liveview, getting settings...");
            inputs.on('B', captureButtonHandler);
            core.getSettings(function() {
                console.log("done getting settings, enabling knob handler");
                stats = lists.evStats(core.cameraSettings);
                ev = stats.ev;
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
                        clips.getLastTimelapse(function(err, timelapse) {
                            if (timelapse) {
                                if(timelapse.path) {
                                    oled.video(timelapse.path, timelapse.frames, 30, cb);
                                } else {
                                    db.getTimelapseFrames(timelapse.id, timelapse.primary_camera, function(err, clipFrames){
                                        if(!err && clipFrames) {
                                            var framesPaths = clipFrames.map(function(frame){
                                                return frame.thumbnail;
                                            });
                                            oled.video(null, framesPaths, 30, cb);
                                        }
                                    });
                                }
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
            var timelapse = clips.getLastTimelapse(function(err, timelapse) {
                if (timelapse) {
                    if(timelapse.path) {
                        oled.video(timelapse.path, timelapse.frames, 30, function(){
                            ui.reload();
                        });
                    } else {
                        db.getTimelapseFrames(timelapse.id, timelapse.primary_camera, function(err, clipFrames){
                            if(!err && clipFrames) {
                                var framesPaths = clipFrames.map(function(frame){
                                    return frame.thumbnail;
                                });
                                oled.video(null, framesPaths, 30, function(){
                                    ui.reload();
                                });
                            }
                        });
                    }
                } 
            });
        },
        button3: function(){
            ui.load(timelapseRunningMenu());
        },
        help: help.timelapseStatus
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
        }, {
            name: valueDisplay("Interval Mode", core.currentProgram, 'intervalMode'),
            help: help.intervalOptions,
            action: intervalOptions,
            condition: function() {
                return core.currentProgram.rampMode != 'fixed';
            }
        }, {
            name: valueDisplay("Interval", core.currentProgram, 'interval'),
            action: interval,
            help: help.interval,
            condition: function() {
                return core.currentProgram.intervalMode == 'fixed' || core.currentProgram.rampMode == 'fixed';
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
                return core.currentProgram.intervalMode == 'fixed' || core.currentProgram.rampMode == 'fixed';
            }
        }, {
            name: valueDisplay("Destination", core.currentProgram, 'destination'),
            action: destinationOptions,
            help: help.destinationOptions,
            condition: function() {
                return core.sdPresent;
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
            name: "START",
            help: help.startTimelapse,
            action: {
                type: "function",
                fn: function(arg, cb) {
                    core.currentProgram.keyframes = null;
                    oled.timelapseStatus = null;
                    core.startIntervalometer(core.currentProgram);
                    cb();
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
            var stats, ev;

            function captureButtonHandler(b) {
                oled.activity();
                power.activity();
                if (b == 1) {
                    oled.unblock();
                    liveviewOn = false;
                    core.lvOff();
                    blockInputs = false;
                    inputs.removeListener('B', captureButtonHandler);
                    inputs.removeListener('D', captureDialHandler);
                    setTimeout(cb, 500);
                } else if (b == 4) {
                    liveviewOn = false;
                    core.capture(null, function(err) {
                        if(err) {
                            oled.unblock();
                            liveviewOn = false;
                            blockInputs = false;
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
                        console.log("setting ev to ", ev);
                        core.setEv(ev, {
                            cameraSettings: core.cameraSettings
                        });
                    }
                } else if (d == 'D') {
                    if (stats.ev > stats.minEv) {
                        ev -= 1 / 3;
                        console.log("setting ev to ", ev);
                        core.setEv(ev, {
                            cameraSettings: core.cameraSettings
                        });
                    }
                }
            }

            oled.block();
            liveviewOn = true;
            inputs.on('B', captureButtonHandler);
            console.log("started liveview, getting settings...");
            core.getSettings(function() {
                console.log("done getting settings, enabling knob");
                stats = lists.evStats(core.cameraSettings);
                ev = stats.ev;
                inputs.on('D', captureDialHandler);
            });
            core.preview();
        }
    }

    var versionUpdateConfirmMenuBuild = function(versionTarget) {
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
                                    exec('nohup /bin/sh -c "killall node; sleep 2; kill -s 9 ' + process.pid + '; /root/startup.sh"', function() {}); // restarting system
                                });
                            });
                        } else {
                            power.disableAutoOff();
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
                                                exec('nohup /bin/sh -c "killall node; sleep 2; kill -s 9 ' + process.pid + '; /root/startup.sh"', function() {}); // restarting system
                                            });
                                        });
                                    });
                                } else {
                                    wifi.unblockBt();
                                    ui.status('error updating');
                                    if(cb) cb();
                                    ui.back();
                                }
                            }, function(statusUpdate) {
                                oled.value([{
                                    name: statusUpdate,
                                    value: "Please Wait"
                                }]);
                                ui.status(statusUpdate);
                                oled.update();
                                oled.activity();
                            });
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
                    items: [],
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
            }
        };});
        cb(null, m);
    };
    var wifiListHandler = function(list){
    }
    wifi.listHandler(wifiListHandler);

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
                return wifi.btEnabled && wifi.enabled;
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
                return !wifi.btEnabled && wifi.enabled;
            }
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
            if(mcu.lastGpsFix) {
                var now = moment(new Date(mcu.gps.time || mcu.lastGpsFix.time));
                info = "GPS enabled\t";
                info += "Lat: " + limitPrecison(mcu.lastGpsFix.lat, 6) + "\t";
                info += "Lon: " + limitPrecison(mcu.lastGpsFix.lon, 6) + "\t";
                info += "Altitude: " + limitPrecison(mcu.lastGpsFix.alt, 1) + "\t";
                info += "Date: " + now.format("D MMMM YYYY") + "\t";
                info += "Time: " + now.format("h:mm:ss A") + "\t";
                info += "Timezone: " + now.format("z (ZZ)") + "\t";
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

    var systemInfo = function() {
        var info = "";
        info += "Timelapse+ VIEW\t";
        info += "UID: " + app.serial + "\t";
        info += "Version: " + updates.version + "\t";
        info += "MCU Firmware: " + mcu.version + "\t";
        info += "LibGPhoto2: " + updates.libgphoto2Version + "\t";
        info += "GPS Module: " + (gpsExists ? 'installed':'not installed') + "\t";
        return info;
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
        if(mcu.lastGpsFix) {
            var suntimes = suncalc.getTimes(mcu.gps.time || mcu.lastGpsFix.time, mcu.lastGpsFix.lat, mcu.lastGpsFix.lon, true);
            var moontimes = suncalc.getMoonTimes(mcu.gps.time || mcu.lastGpsFix.time, mcu.lastGpsFix.lat, mcu.lastGpsFix.lon, true);
            var mooninfo = suncalc.getMoonIllumination(mcu.gps.time || mcu.lastGpsFix.time, true);
            var now = moment(new Date(mcu.gps.time || mcu.lastGpsFix.time));
            var sunrise = moment(new Date(suntimes.sunrise));
            var sunset = moment(new Date(suntimes.sunset));
            var moonrise = moment(new Date(moontimes.rise));
            var moonset = moment(new Date(moontimes.set));
            info += "Current Time: " + now.format("h:mm:ss A") + "\t";
            info += "Sun sets at " + sunset.format("h:mm:ss A") + "\t   (" + sunset.fromNow() + ")\t";
            info += "Sun rises at " + sunrise.format("h:mm:ss A") + "\t   (" + sunrise.fromNow() + ")\t";
            info += "Moon rises at " + moonrise.format("h:mm:ss A") + "\t   (" + moonrise.fromNow() + ")\t";
            info += "Moon sets at " + moonset.format("h:mm:ss A") + "\t   (" + moonset.fromNow() + ")\t";
            var phase = "unknown";
            if(mooninfo.phase == 0 || mooninfo.phase == 1) phase = "New Moon"; 
            else if(mooninfo.phase < 0.25) phase = "Waxing Crescent"; 
            else if(mooninfo.phase == 0.25) phase = "First Quarter";
            else if(mooninfo.phase > 0.25 && mooninfo.phase < 0.5) phase = "Waxing Gibbous";
            else if(mooninfo.phase == 0.5) phase = "Full Moon";
            else if(mooninfo.phase > 0.5 && mooninfo.phase < 0.75) phase = "Waning Gibbous";
            else if(mooninfo.phase == 0.75) phase = "Last Quarter";
            else if(mooninfo.phase > 0.75) phase = "Waning Crescent";
            info += "Phase: " + phase + "\t";
            info += "Moon illumination: " + Math.round(mooninfo.fraction * 100) + "%\t";
        } else {
           info = "GPS position info unavailable\t";
        }
        return info;
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
                ui.alert('System Info', systemInfo());
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
                return mcu.gpsAvailable;
            },
            help: help.sunAndMoon
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
            oled.png('/home/view/current/media/gesture-oled.png');
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
                gestureVideoPlaying = true;
                clips.getLastTimelapse(function(err, timelapse) {
                    if (timelapse) {
                        if(timelapse.path) {
                            oled.video(timelapse.path, timelapse.frames, 30, function() {
                                gestureVideoPlaying = false;
                                gestureModeTimer();
                            });
                        } else {
                            db.getTimelapseFrames(timelapse.id, timelapse.primary_camera, function(err, clipFrames){
                                if(!err && clipFrames) {
                                    var framesPaths = clipFrames.map(function(frame){
                                        return frame.thumbnail;
                                    });
                                    oled.video(null, framesPaths, 30, function() {
                                        gestureVideoPlaying = false;
                                        gestureModeTimer();
                                    });
                                }
                            });
                        }
                    } 
                });
            }
        }
    });

}

var systemClosed = false;
function closeSystem(callback) {
    systemClosed = true;
    console.log("Shutting down!");
    app.close();
    //nmx.disconnect();
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

app.on('message', function(msg) {
    power.activity();
    try {
        switch(msg.type) {
            case 'dbGet':
                if(msg.key) {
                    (function(key, reply) {
                        db.get(key, function(err, val){
                            if(val === undefined) val = null;
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

            case 'motion':            
                if (msg.key == "move" && msg.motor && msg.driver) {
                    console.log("moving motor " + msg.motor);
                    (function(driver, motor, steps, reply) {
                        if(driver == 'NMX') core.moveNMX(motor, steps, function(err, position) {
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
                        if(driver == 'NMX') core.moveNMXjoystick(motor, speed, function(err, position) {
                            reply('move', {
                                complete: true,
                                motor: motor,
                                driver: driver,
                                position: position
                            });
                        });
                    })(msg.driver, msg.motor, msg.val, msg.reply);
                } else if (msg.key == "zero" && msg.motor && msg.driver) {
                    console.log("moving motor " + msg.motor);
                    (function(driver, motor, reply) {
                        if(driver == 'NMX') core.zeroNMX(motor, function(err) {
                            reply('move', {
                                complete: true,
                                motor: motor,
                                driver: driver,
                                position: 0
                            });
                        });
                    })(msg.driver, msg.motor, msg.reply);
                }
                break;

            case 'focus':
                if (msg.key == "manual") {
                    core.focus(msg.val, msg.repeat, function(err){
                        console.log("MAIN: focus complete");
                        msg.reply('focus', {
                            complete: true,
                        });
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
    
            case 'run':
                core.startIntervalometer(msg.program);
                break;

            case 'stop':
                core.stopIntervalometer();
                break;

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

            case 'timelapse-images':
                clips.getClipFramesCount(msg.index, function(err, frames) {
                    if(!err && frames) {
                        var fragments = Math.ceil(frames / 100);
                        var fragment = 0;

                        var sendFragment = function(){
                            console.log("sending time-lapse fragment " + fragment + " of " + fragments);
                            clips.getTimelapseImages(msg.index, fragment * 100, 100, function(err, images) {
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

            case 'preview':
                if (liveviewOn) {
                    if (previewImage) msg.reply(previewImage);
                } else {
                    if(!core.intervalometerStatus.running) core.preview();
                }
                break;

            case 'previewStop':
                core.lvOff();
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

            case 'get':
                if (msg.key == "settings") {
                    if (core.cameraConnected) {
                        core.getSettings(function() {
                            core.cameraSettings.stats = lists.evStats(core.cameraSettings);
                            msg.reply('settings', {
                                settings: core.cameraSettings
                            });
                        });
                    } else {
                        msg.reply('settings', {
                            settings: null,
                        });
                    }
                } else if (msg.key == "light") {
                    msg.reply('light', {
                        light: light.ev()
                    });
                } else if (msg.key == "motion") {
                    var motion = getMotionStatus();
                    msg.reply('motion', motion);
                } else if (msg.key == "program") {
                    if(!core.currentProgram.keyframes) {
                        core.currentProgram.keyframes = [{
                            focus: 0,
                            ev: "not set",
                            motor: {}
                        }]
                    }
                    msg.reply('timelapseProgram', {program: core.currentProgram});
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

        if (core.intervalometerStatus.running) {
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
            var size = {
                x: 160,
                q: 80
            }
            if (VIEW_HARDWARE && (core.photo.type != 'preview' || liveviewOn)) {
                image.downsizeJpeg(new Buffer(core.photo.jpeg), size, null, function(err, jpgBuf) {
                    if (!err && jpgBuf) {
                        image.saveTemp("oledthm", jpgBuf, function(err, path) {
                            oled.jpeg(path, 0, 15, true);
                            oled.update(true);
                        });
                    }
                });
            }
        }

        previewImage = {
            jpeg: core.photo.base64,
            zoomed: core.photo.zoomed,
            type: core.photo.type
        };

        if(core.intervalometerStatus.running) liveviewOn = false;
        if (previewImage.type == "photo" || !liveviewOn) {
            app.send('photo');
            app.send('thumbnail', previewImage);
        } else if (previewImage.type == "preview" && !core.intervalometerStatus.running) {
            liveviewOn = true;
            console.log("LV: requesting next frame");
            core.preview();
        }
    }
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
        if(wifi.btEnabled) {
            wifi.blockBt();
            btBlockedForSony = true;
        }
    }
    oled.setIcon('camera', true);
    setTimeout(function() {
        app.send('camera', {
            connected: true,
            model: core.cameraModel
        });
        if (VIEW_HARDWARE) {
            ui.status(core.cameraModel);
            ui.reload();
        }
    }, 1000);
});

var s = "VIEW " + updates.getCurrentVersion();
ui.defaultStatus(s);
ui.status(s);
console.log("Setting default status to '" + s + "'")

core.on('camera.exiting', function() {    
    if(btBlockedForSony) {
        wifi.unblockBt();
    }
    oled.setIcon('camera', false);
    app.send('camera', {
        connected: false,
        model: ''
    });
    if(btBlockedForSony)
    if (VIEW_HARDWARE) {
        ui.defaultStatus("VIEW " + updates.version);
        ui.status("camera disconnected");
        ui.reload();
    }
});

core.on('camera.error', function(err) {
    app.send('error', {
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
            ui.defaultStatus("VIEW " + updates.version);
        }
    }
});

core.on('intervalometer.status', function(msg) {
    //console.log("intervalometer.status", core.intervalometerStatus);
    //console.log("core.cameraSettings", core.cameraSettings);
    //return;
    if(msg.running) {
        power.disableAutoOff();
    } else if(cache.intervalometerStatus.running) {
        power.enableAutoOff();
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
        apertureText: (msg.cameraSettings.details && msg.cameraSettings.details.aperture) ? ("f/" + msg.cameraSettings.aperture) : ("f/" + lists.getNameFromEv(lists.aperture, core.currentProgram.manualAperture) + ' (m)'),
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

var nmxStatus = {connected:false};
function getMotionStatus(status) {
    if(!status) {
        status = core.nmxStatus || nmxStatus;
    }
    nmxStatus = status;
    var available = status.connected && (status.motor1 || status.motor2 || status.motor2);
    var motors = [];
    motors.push({driver:'NMX', motor:1, connected:status.motor1, position:status.motor1pos});
    motors.push({driver:'NMX', motor:2, connected:status.motor2, position:status.motor2pos});
    motors.push({driver:'NMX', motor:3, connected:status.motor3, position:status.motor3pos});
    return {
        available: available,
        motors: motors
    };
}

core.on('nmx.status', function(status) {
    var motion = getMotionStatus(status);
    app.send('motion', motion);
    if (status.connected) {
        oled.setIcon('bt', true);
        //stopScan();
        ui.reload();
    } else {
        oled.setIcon('bt', false);
        ui.reload();
        wifi.resetBt(function(){
            //startScan();
        });
    }
});

