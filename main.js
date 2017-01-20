/*jslint node:true,vars:true,bitwise:true */
'use strict';

var VIEW_HARDWARE = true; // is this running on official VIEW hardware?

console.log('Starting up...');

var _ = require('underscore');
var async = require('async');
var exec = require('child_process').exec;
var crypto = require('crypto');
var fs = require('fs');
console.log('Server modules loaded');

var sys = require('sys')
console.log('System modules loaded');

var noble = require('noble');
console.log('BT modules loaded');

require('rootpath')();
var camera = require('./camera/camera.js');
//var screen = require('./hardware/screen.js');
var updates = require('./system/updates.js');
var intervalometer = require('./intervalometer/intervalometer.js');
var nmx = require('./drivers/nmx.js');
var image = require('./camera/image/image.js');
if (VIEW_HARDWARE) {
    var light = require('./hardware/light.js');
    var oled = require('./hardware/oled.js');
    var ui = require('./interface/ui.js');
    var help = require('./interface/help.js');
    var inputs = require('./hardware/inputs.js');
    var power = require('./hardware/power.js');
}
intervalometer.addNmx(nmx);

var wifi = require('./system/wifi.js');
wifi.power = power; // allow wifi module to control power
var app = require("./system/app.js");
var db = require("./system/db.js");

var previewImage = null;
var liveviewOn = false;

var cache = {};

var Segfault = require('segfault');
Segfault.registerHandler("segfault.log");
var nodeCleanup = require('node-cleanup');

process.stdin.resume();

intervalometer.addDb(db);

console.log('Modules loaded.');

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
    inputs.start();

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
                                } else if(wifiStatus.connect) {
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


    var wifiConnectionTime = 0;
    wifi.on('connect', function(ssid) {
        oled.setIcon('wifi', true);
        wifiConnectionTime = new Date().getTime();
        ui.status('wifi connected to ' + ssid);
        ui.reload();
    });
    wifi.on('enabled', function(enabled) {
        oled.setIcon('wifi', false);
        ui.reload();
    });
    wifi.on('disabled', function(enabled) {
        oled.setIcon('wifi', false);
        ui.reload();
    });
    wifi.on('disconnect', function(previousConnection) {
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
            action: ui.set(intervalometer.currentProgram, 'rampMode', 'fixed')
        }, {
            name: "Timelapse Mode",
            value: "Auto Ramping",
            help: help.rampingOptions,
            action: ui.set(intervalometer.currentProgram, 'rampMode', 'auto')
        }]
    }

    var framesOptions = {
        name: "frames",
        type: "options",
        items: [{
            name: "Frames",
            value: "100",
            help: help.framesOptions,
            action: ui.set(intervalometer.currentProgram, 'frames', 100)
        }, {
            name: "Frames",
            value: "200",
            help: help.framesOptions,
            action: ui.set(intervalometer.currentProgram, 'frames', 200)
        }, {
            name: "Frames",
            value: "300",
            help: help.framesOptions,
            action: ui.set(intervalometer.currentProgram, 'frames', 300)
        }, {
            name: "Frames",
            value: "400",
            help: help.framesOptions,
            action: ui.set(intervalometer.currentProgram, 'frames', 400)
        }, {
            name: "Frames",
            value: "500",
            help: help.framesOptions,
            action: ui.set(intervalometer.currentProgram, 'frames', 500)
        }, {
            name: "Frames",
            value: "600",
            help: help.framesOptions,
            action: ui.set(intervalometer.currentProgram, 'frames', 600)
        }, {
            name: "Frames",
            value: "700",
            help: help.framesOptions,
            action: ui.set(intervalometer.currentProgram, 'frames', 700)
        }, {
            name: "Frames",
            value: "800",
            help: help.framesOptions,
            action: ui.set(intervalometer.currentProgram, 'frames', 800)
        }, {
            name: "Frames",
            value: "900",
            help: help.framesOptions,
            action: ui.set(intervalometer.currentProgram, 'frames', 900)
        }, {
            name: "Frames",
            value: "1200",
            help: help.framesOptions,
            action: ui.set(intervalometer.currentProgram, 'frames', 1200)
        }, {
            name: "Frames",
            value: "1500",
            help: help.framesOptions,
            action: ui.set(intervalometer.currentProgram, 'frames', 1500)
        }, {
            name: "Frames",
            value: "1800",
            help: help.framesOptions,
            action: ui.set(intervalometer.currentProgram, 'frames', 1800)
        }, {
            name: "Frames",
            value: "Until Stopped",
            help: help.framesOptions,
            action: ui.set(intervalometer.currentProgram, 'frames', Infinity)
        }]
    }

    var intervalOptions = {
        name: "interval mode",
        type: "options",
        items: [{
            name: "Interval Mode",
            value: "Fixed Length",
            help: help.intervalOptions,
            action: ui.set(intervalometer.currentProgram, 'intervalMode', 'fixed')
        }, {
            name: "Interval Mode",
            value: "Auto Variable",
            help: help.intervalOptions,
            action: ui.set(intervalometer.currentProgram, 'intervalMode', 'auto')
        }, {
            name: "Interval Mode",
            value: "External AUX2",
            help: help.intervalOptions,
            action: ui.set(intervalometer.currentProgram, 'intervalMode', 'aux')
        }]
    }

    var destinationOptions = {
        name: "destination",
        type: "options",
        items: [{
            name: "Save To",
            value: "Camera",
            help: help.destinationOptions,
            action: ui.set(intervalometer.currentProgram, 'destination', 'camera')
        }, {
            name: "Save To",
            value: "SD Card",
            help: help.destinationOptions,
            action: ui.set(intervalometer.currentProgram, 'destination', 'sd')
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
        action: ui.set(intervalometer.currentProgram, 'nightInterval', i)
    });
    for (var i = 12; i < 35; i += 2) nightInterval.items.push({
        name: "Night Interval",
        help: help.nightInterval,
        value: i + " seconds",
        action: ui.set(intervalometer.currentProgram, 'nightInterval', i)
    });
    for (var i = 35; i < 90; i += 5) nightInterval.items.push({
        name: "Night Interval",
        help: help.nightInterval,
        value: i + " seconds",
        action: ui.set(intervalometer.currentProgram, 'nightInterval', i)
    });

    var dayInterval = {
        name: "day interval",
        type: "options",
        items: []
    }
    for (var i = 2; i < 12; i++) dayInterval.items.push({
        name: "Day Interval",
        help: help.dayInterval,
        value: i + " seconds",
        action: ui.set(intervalometer.currentProgram, 'dayInterval', i)
    });
    for (var i = 12; i < 35; i += 2) dayInterval.items.push({
        name: "Day Interval",
        help: help.dayInterval,
        value: i + " seconds",
        action: ui.set(intervalometer.currentProgram, 'dayInterval', i)
    });
    for (var i = 35; i < 90; i += 5) dayInterval.items.push({
        name: "Day Interval",
        help: help.dayInterval,
        value: i + " seconds",
        action: ui.set(intervalometer.currentProgram, 'dayInterval', i)
    });

    var interval = {
        name: "interval",
        type: "options",
        items: []
    }
    for (var i = 2; i < 12; i++) interval.items.push({
        name: "Interval",
        help: help.interval,
        value: i + " seconds",
        action: ui.set(intervalometer.currentProgram, 'interval', i)
    });
    for (var i = 12; i < 35; i += 2) interval.items.push({
        name: "Interval",
        help: help.interval,
        value: i + " seconds",
        action: ui.set(intervalometer.currentProgram, 'interval', i)
    });
    for (var i = 35; i < 90; i += 5) interval.items.push({
        name: "Interval",
        help: help.interval,
        value: i + " seconds",
        action: ui.set(intervalometer.currentProgram, 'interval', i)
    });


    var manualAperture = {
        name: "Manual Aperture",
        type: "options",
        items: []
    }
    for (var i = 0; i < camera.lists.aperture.length; i++) {
        if(camera.lists.aperture[i].ev != null && camera.lists.aperture[i].ev <= -2) {
            manualAperture.items.push({
                name: "Manual Aperture",
                help: help.manualAperture,
                value: camera.lists.aperture[i].name,
                action: ui.set(intervalometer.currentProgram, 'manualAperture', camera.lists.aperture[i].ev)
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
        action: ui.set(intervalometer.currentProgram, 'isoMax', null)
    });
    for (var i = 0; i < camera.lists.iso.length; i++) {
        if(camera.lists.iso[i].ev != null && camera.lists.iso[i].ev <= -2) {
            isoMax.items.push({
                name: "Maximum ISO",
                help: help.isoMax,
                value: camera.lists.iso[i].name,
                action: ui.set(intervalometer.currentProgram, 'isoMax', camera.lists.iso[i].ev)
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
        action: ui.set(intervalometer.currentProgram, 'isoMin', null)
    });
    for (var i = 0; i < camera.lists.iso.length; i++) {
        if(camera.lists.iso[i].ev != null && camera.lists.iso[i].ev >= -2) {
            isoMin.items.push({
                name: "Minimum ISO",
                help: help.isoMin,
                value: camera.lists.iso[i].name,
                action: ui.set(intervalometer.currentProgram, 'isoMin', camera.lists.iso[i].ev)
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
        action: ui.set(intervalometer.currentProgram, 'shutterMax', null)
    });
    for (var i = 0; i < camera.lists.shutter.length; i++) {
        if(camera.lists.shutter[i].ev != null && camera.lists.shutter[i].ev <= -6) {
            shutterMax.items.push({
                name: "Max Shutter Length",
                help: help.shutterMax,
                value: camera.lists.shutter[i].name,
                action: ui.set(intervalometer.currentProgram, 'shutterMax', camera.lists.shutter[i].ev)
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
                var itemName = camera.lists.getNameFromEv(camera.lists.iso, object[key]);
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
                var itemName = camera.lists.getNameFromEv(camera.lists.aperture, object[key]);
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
                var itemName = camera.lists.getNameFromEv(camera.lists.shutter, object[key]);
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
            action: ui.set(intervalometer.currentProgram, 'nightCompensation', 0)
        }, {
            name: "Night Exposure Compensation",
            value: "-1/3 stops",
            help: help.rampingNightCompensation,
            action: ui.set(intervalometer.currentProgram, 'nightCompensation', -1/3)
        }, {
            name: "Night Exposure Compensation",
            value: "-2/3 stops",
            help: help.rampingNightCompensation,
            action: ui.set(intervalometer.currentProgram, 'nightCompensation', -2/3)
        }, {
            name: "Night Exposure Compensation",
            value: "-1 stop",
            help: help.rampingNightCompensation,
            action: ui.set(intervalometer.currentProgram, 'nightCompensation', -1)
        }, {
            name: "Night Exposure Compensation",
            value: "-1 1/3 stops",
            help: help.rampingNightCompensation,
            action: ui.set(intervalometer.currentProgram, 'nightCompensation', -1 - 1 / 3)
        }, {
            name: "Night Exposure Compensation",
            value: "-1 2/3 stops",
            help: help.rampingNightCompensation,
            action: ui.set(intervalometer.currentProgram, 'nightCompensation', -1 - 2 / 3)
        }, {
            name: "Night Exposure Compensation",
            value: "-2 stops",
            help: help.rampingNightCompensation,
            action: ui.set(intervalometer.currentProgram, 'nightCompensation', -2)
        }]
    }

    var rampingOptionsMenu = {
        name: "Ramping Options",
        type: "menu",
        items: [{
            name: valueDisplay("Night Exposure", intervalometer.currentProgram, 'nightCompensation'),
            action: rampingNightCompensation,
            help: help.rampingNightCompensation
        }, {
            name: isoValueDisplay("Maximum ISO", intervalometer.currentProgram, 'isoMax'),
            action: isoMax,
            help: help.isoMax
        }, {
            name: isoValueDisplay("Minimum ISO", intervalometer.currentProgram, 'isoMin'),
            action: isoMin,
            help: help.isoMin
        }, {
            name: shutterValueDisplay("Max Shutter", intervalometer.currentProgram, 'shutterMax'),
            action: shutterMax,
            help: help.shutterMax
        }, ]
    }

    var exposureMenu = {
        name: "capture",
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
                    camera.ptp.lvOff();
                    inputs.removeListener('B', captureButtonHandler);
                    inputs.removeListener('D', captureDialHandler);
                    setTimeout(cb, 500);
                } else if (b == 2) {
                    if (camera.zoomed) {
                        camera.ptp.zoom();
                    } else {
                        camera.ptp.zoom(0.5, 0.5);
                    }
                }
            }

            function captureDialHandler(d) {
                oled.activity();
                power.activity();
                //console.log("captureDialHandler", d, stats, ev);
                if (camera.ptp.photo && camera.zoomed) {
                    var f = 0;
                    if (d == 'U') {
                        f = +2;
                    }
                    if (d == 'D') {
                        f = -2;
                    }
                    camera.ptp.focus(f);
                } else {
                    if (d == 'U') {
                        if (stats.ev < stats.maxEv) {
                            ev += 1 / 3;
                            console.log("setting ev to ", ev);
                            camera.setEv(ev, {
                                settingsDetails: camera.ptp.settings.details
                            });
                        }
                    } else if (d == 'D') {
                        if (stats.ev > stats.minEv) {
                            ev -= 1 / 3;
                            console.log("setting ev to ", ev);
                            camera.setEv(ev, {
                                settingsDetails: camera.ptp.settings.details
                            });
                        }
                    }
                }
            }

            liveviewOn = true;
            camera.ptp.preview();
            camera.ptp.getSettings(function() {
                stats = camera.evStats(camera.ptp.settings);
                ev = stats.ev;
                inputs.on('B', captureButtonHandler);
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
                    intervalometer.cancel();
                    cb();
                    ui.back();
                }
            }
        }]
    }


    var timelapseRunningMenu = {
        name: "time-lapse",
        type: "menu",
        items: [{
            name: valueDisplay("Play Preview", intervalometer.status, 'frames'),
            action: {
                type: "function",
                fn: function(arg, cb) {
                    var timelapse = intervalometer.getLastTimelapse(function(err, timelapse) {
                        if (timelapse) oled.video(timelapse.path, timelapse.frames, 30, cb);
                    });
                }
            }
        }, {
            name: "Stop Time-lapse",
            action: stopConfirm
        }]
    }

    var timelapseStatusMenu = {
        name: "time-lapse",
        type: "timelapse",
        enter: function(){
            var timelapse = intervalometer.getLastTimelapse(function(err, timelapse) {
                if (timelapse) oled.video(timelapse.path, timelapse.frames, 30, function(){
                    ui.reload();
                });
            });
        },
        button3: function(){
            ui.load(timelapseRunningMenu);
        },
        help: help.timelapseStatus
    }

    var timelapseMenu = {
        name: "time-lapse",
        type: "menu",
        alternate: function() {
            if (intervalometer.status.running) {
                return timelapseStatusMenu;
            } else if (camera.ptp.connected) {
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
            name: valueDisplay("Camera", camera.ptp, 'model'),
            help: help.cameraSelection,
            action: function(cb) {
                cm = {
                    name: "Primary Camera",
                    type: "options",
                    items: []
                }
                var list = camera.ptp.cameraList();
                for(var i = 0; i < list.length; i++) {
                    cm.items.push({
                        name: "Primary Camera",
                        value: list[i].model,
                        help: help.cameraSelection,
                        action: (function(cam) { return function(cb2) {
                            camera.ptp.switchPrimary(cam);
                            cb2();
                            ui.back();
                        };})(list[i])
                    });
                }
                cb(null, cm);
            },
            condition: function() {
                return camera.ptp.count > 1;
            }
        }, {
            name: valueDisplay("Exposure", camera.ptp.settings.stats, 'ev'),
            help: help.exposureMenu,
            action: exposureMenu,
            condition: function() {
                return camera.ptp.supports.liveview;
            }
        }, {
            name: valueDisplay("Timelapse Mode", intervalometer.currentProgram, 'rampMode'),
            help: help.rampingOptions,
            action: rampingOptions
        }, {
            name: valueDisplay("Interval Mode", intervalometer.currentProgram, 'intervalMode'),
            help: help.intervalOptions,
            action: intervalOptions,
            condition: function() {
                return intervalometer.currentProgram.rampMode != 'fixed';
            }
        }, {
            name: valueDisplay("Interval", intervalometer.currentProgram, 'interval'),
            action: interval,
            help: help.interval,
            condition: function() {
                return intervalometer.currentProgram.intervalMode == 'fixed' || intervalometer.currentProgram.rampMode == 'fixed';
            }
        }, {
            name: valueDisplay("Day Interval", intervalometer.currentProgram, 'dayInterval'),
            action: dayInterval,
            help: help.dayInterval,
            condition: function() {
                return intervalometer.currentProgram.intervalMode == 'auto' && intervalometer.currentProgram.rampMode == 'auto';
            }
        }, {
            name: valueDisplay("Night Interval", intervalometer.currentProgram, 'nightInterval'),
            action: nightInterval,
            help: help.nightInterval,
            condition: function() {
                return intervalometer.currentProgram.intervalMode == 'auto' && intervalometer.currentProgram.rampMode == 'auto';
            }
        }, {
            name: valueDisplay("Frames", intervalometer.currentProgram, 'frames'),
            action: framesOptions,
            help: help.framesOptions,
            condition: function() {
                return intervalometer.currentProgram.intervalMode == 'fixed' || intervalometer.currentProgram.rampMode == 'fixed';
            }
        }, {
            name: valueDisplay("Destination", intervalometer.currentProgram, 'destination'),
            action: destinationOptions,
            help: help.destinationOptions,
            condition: function() {
                return camera.ptp.sdPresent;
            }
        }, {
            name: "Ramping Options",
            action: rampingOptionsMenu,
            help: help.rampingOptionsMenu,
            condition: function() {
                return intervalometer.currentProgram.rampMode != 'fixed';
            }
        }, {
            name: apertureValueDisplay("Manual Aperture", intervalometer.currentProgram, 'manualAperture'),
            action: manualAperture,
            help: help.manualAperture,
            condition: function() {
                return intervalometer.currentProgram.rampMode != 'fixed' && !(camera.ptp.settings.aperture && camera.ptp.settings.details && camera.ptp.settings.details.aperture && camera.ptp.settings.details.aperture.ev != null);
            }
        }, {
            name: "START",
            help: help.startTimelapse,
            action: {
                type: "function",
                fn: function(arg, cb) {
                    intervalometer.currentProgram.keyframes = null;
                    oled.timelapseStatus = null;
                    intervalometer.run(intervalometer.currentProgram);
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
                    name: "Write XMPs to SD card",
                    action: function(){
                        confirmSaveXMPs(clip);
                    },
                    help: help.writeXMPs,
                    condition: function() {
                        return camera.ptp.sdPresent;
                    }
                }, {
                    name: "Use time-lapse setup",
                    action: function(){
                        var newProgram = _.extend(intervalometer.currentProgram, dbClip.program);
                        console.log("setting current program to ", newProgram);
                        intervalometer.load(newProgram);
                        ui.back();
                        ui.load(timelapseMenu);
                    },
                    help: help.useTimelapseSetup,
                    condition: function() {
                        return dbClip && dbClip.program && !intervalometer.status.running;
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
        intervalometer.getRecentTimelapseClips(15, function(err, clips) {
            console.log("########################################################################################################################");
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
                                            oled.video(c.path, c.frames, 30, cb2);
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
        if (intervalometer.status.running) intervalometer.cancel();
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
                    //if (!intervalometer.status.running) {
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
            if (camera.ptp.connected) {
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
                    camera.ptp.lvOff();
                    blockInputs = false;
                    inputs.removeListener('B', captureButtonHandler);
                    inputs.removeListener('D', captureDialHandler);
                    setTimeout(cb, 500);
                } else if (b == 4) {
                    liveviewOn = false;
                    camera.ptp.capture(null, function(err) {
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
                            camera.ptp.preview();
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
                        camera.setEv(ev, {
                            settingsDetails: camera.ptp.settings.details
                        });
                    }
                } else if (d == 'D') {
                    if (stats.ev > stats.minEv) {
                        ev -= 1 / 3;
                        console.log("setting ev to ", ev);
                        camera.setEv(ev, {
                            settingsDetails: camera.ptp.settings.details
                        });
                    }
                }
            }

            oled.block();
            liveviewOn = true;
            camera.ptp.getSettings(function() {
                stats = camera.evStats(camera.ptp.settings);
                ev = stats.ev;
                inputs.on('B', captureButtonHandler);
                inputs.on('D', captureDialHandler);
            });
            camera.ptp.preview();
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
                                    exec('nohup /bin/sh /root/startup.sh', function() {}); // restarting system
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
                                                exec('nohup /bin/sh /root/startup.sh', function() {}); // restarting system
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
                        name: versions[i].version + (versions[i].current ? " (current)" : ""),
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
            console.log("Getting cached versions from DB...");
            db.get('versions-installed', function(err, dbVersions) {
                var versions = [];
                for(var key in dbVersions) {
                    if(dbVersions.hasOwnProperty(key)) {
                        versions.push(dbVersions[key]);
                    }
                }
                if(!err && versions) {
                    for(var i = 0; i < versions.length; i++) {
                        if(updates.version == versions[i].version) {
                            versions[i].current = true;
                        } else {
                            versions[i].current = false;
                        }
                    }
                    console.log("Building menu from cache", versions);
                    buildUpdateMenu(err, versions);
                } else {
                    console.log("ERROR: no cached versions available");
                    oled.value([{
                        name: "Version Update Error",
                        value: "WiFi Required"
                    }]);
                    oled.update();
                }
            });
        }
    }    

    var wifiConnectMenu = {
        name: "wifi connect",
        type: "menu",
        items: {name:'searching...', action:null}
    };
    var wifiListHandler = function(list){
        wifiConnectMenu.items = list.map(function(item){return {
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
                                    db.set('wifi-status', {
                                        apMode: false,
                                        connect: item,
                                        enabled: true,
                                        password: result
                                    });
                                    ui.back();
                                }
                            });
                        });
                    } else {
                        ui.status('connecting to ' + item.ssid);
                        wifi.connect(item);
                        db.set('wifi-status', {
                            apMode: false,
                            connect: item,
                            enabled: true
                        });
                        ui.back();
                        ui.back();
                    }
                }
            }
        };});
    }
    wifi.listHandler(wifiListHandler);

    var wifiMenu = {
        name: "wifi",
        type: "menu",
        items: [{
            name: "Connect to AP",
            action: wifiConnectMenu,
            help: help.wifiConnectMenu,
            condition: function() {
                return wifi.enabled;// && !wifi.connected && !wifi.apMode;
            }
        }, {
            name: "Enable Wifi",
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
            name: "Enable TL+VIEW AP",
            help: help.wifiApMenu,
            action: function(){
                wifi.enableAP(function(){
                    db.set('wifi-status', {
                        apMode: true,
                        enabled: true
                    });
                    ui.back();
                });
            },
            condition: function() {
                return wifi.enabled && !wifi.apMode;
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
            name: "Disable Wifi",
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
                    intervalometer.eraseAll();
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
            name: valueDisplay("Theme", oled, 'theme'),
            action: colorThemeMenu,
            help: help.colorThemeMenu
        },{
            name: valueDisplay("Buttons", power, 'buttonMode'),
            action: buttonModeMenu,
            help: help.buttonModeMenu
        }, ]
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
            name: "Factory Reset",
            action: factoryResetConfirmMenu,
            help: help.eraseAllSettingsMenu
        }, {
            name: "Power Info",
            action: function(){
                ui.back();
                ui.alert('Power Info', power.infoText());
            },
            help: help.powerInfo
        }, {
            name: "Developer Mode",
            action: developerModeMenu,
            help: help.developerModeMenu
        }, {
            name: "Send camera report",
            action: function(){
                camera.ptp.runSupportTest(function() {
                    ui.back();
                    app.sendLogs();
                });
            },
            condition: function() {
                return camera.ptp.connected && !intervalometer.status.running;
            },
            help: help.sendCameraReport
        }, {
            name: "Send log for review",
            action: function(){
                ui.load(createErrorReportReasonMenu(null));
            },
            help: help.sendLogsMenu
        }, ]
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
                return camera.ptp.supports.liveview && !intervalometer.status.running;
            }
        }, {
            name: "Time-lapse Clips",
            action: clipsMenu,
            help: help.clipsMenu
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
                intervalometer.saveXMPsToCard(clip.index, function(err) {
                    ui.back();
                    cb();
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
                intervalometer.deleteTimelapseClip(clip.index, function(err) {
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

    app.on('auth-required', function(code) {
        if(updates.installing) return;
        if(authDisplayed) {
            ui.back();
            authDisplayed = false;
        }
        oled.activity();
        power.activity();
        displayAuthCode(code);
    });

    app.on('auth-complete', function(code) {
        if(authDisplayed) {
            ui.back();
            authDisplayed = false;
        }
        oled.activity();
        power.activity();
        ui.status('connected to view.tl');
    });

    app.on('logs-uploaded', function(count) {
        ui.alert('Success', help.logFilesUploaded);    
    })

    camera.ptp.on('media-insert', function(type) {
        console.log("media inserted: ", type);
        oled.activity();
        power.activity();
        if(type = 'sd') {
            intervalometer.currentProgram.destination = 'sd';
            ui.reload();
        }
        intervalometer.getLastTimelapse(function(err, timelapse) {
            if(!err && timelapse) confirmSaveXMPs(timelapse);
        });
    });

    camera.ptp.on('media-remove', function(type) {
        console.log("media removed: ", type);
        if(type = 'sd') {
            intervalometer.currentProgram.destination = 'camera';
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
        power.activity();
        if (blockInputs) return;
        if(!intervalometer.status.running) return; // only use gesture sensor when a time-lapse is running
        console.log("Gesture: " + move);
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
                var timelapse = intervalometer.getLastTimelapse(function(err, timelapse) {
                    if (timelapse) oled.video(timelapse.path, timelapse.frames, 30, function() {
                        gestureVideoPlaying = false;
                        gestureModeTimer();
                    });
                });
                //}
            }
        }
    });

}

var scanTimerHandle = null;
var scanTimerHandle2 = null;
var scanTimerHandle3 = null;
var btleScanStarting = false;

function clearScanTimeouts() {
    if(scanTimerHandle) clearTimeout(scanTimerHandle);
    if(scanTimerHandle2) clearTimeout(scanTimerHandle2);
    if(scanTimerHandle3) clearTimeout(scanTimerHandle3);
    scanTimerHandle = null;
    scanTimerHandle2 = null;
    scanTimerHandle3 = null;
}

function startScan() {
    if(btleScanStarting || updates.installing) return;
    btleScanStarting = true;
    clearScanTimeouts()
    scanTimerHandle = setTimeout(startScan, 30000);
    if (noble.state == "poweredOn") {
        scanTimerHandle2 = setTimeout(function() {
            noble.stopScanning();
        }, 500);
        scanTimerHandle3 = setTimeout(function() {
            if (noble.state == "poweredOn") {
                //console.log("Starting BLE scan...");
                noble.startScanning(nmx.btServiceIds, false, function(err){
                    //console.log("BLE scan started: ", err);
                });
            }
            btleScanStarting = false;
        }, 8000);
    } else {
        btleScanStarting = false;
        if(wifi.btEnabled) {
            wifi.resetBt();
        }
    }
}
startScan();

function stopScan() {
    clearScanTimeouts();
    noble.stopScanning();
}

noble.on('stateChange', function(state) {
    console.log("BLE state changed to", state);
    if (state == "poweredOn") {
        setTimeout(function() {
            startScan()
        });
    }
});

noble.on('discover', function(peripheral) {
    //console.log('ble', peripheral);
    stopScan();
    nmx.connect(peripheral);
});


nmx.connect();

nmx.on('status', function(status) {
    if (status.connected) {
        oled.setIcon('bt', true);
        stopScan();
        ui.reload();
    } else {
        oled.setIcon('bt', false);
        ui.reload();
        wifi.resetBt(function(){
            startScan();
        });
    }
});

var systemClosed = false;
function closeSystem(callback) {
    systemClosed = true;
    console.log("Shutting down!");
    nmx.disconnect();
    if (VIEW_HARDWARE) {
        console.log("closing inputs...");
        inputs.stop();
    }
    try {
        db.set('intervalometer.currentProgram', intervalometer.currentProgram);
    } catch(e) {
        console.log("Error while saving timelapse settings:", e);
    }
    setTimeout(function() {
        console.log("closing db...");
        db.close(function(){
            console.log("db closed.");
            if (VIEW_HARDWARE) {
                oled.close();
                callback && callback();
            } else {
                callback && callback();
            }
        });
    }, 1000);
    //db.setCache('intervalometer.status', intervalometer.status);
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
            console.log("_getActiveHandles:", process._getActiveHandles());
            console.log("_getActiveRequests:", process._getActiveRequests());
            nodeCleanup.uninstall();
            process.exit();
        });
    }
    return false;
});

db.get('intervalometer.currentProgram', function(err, data) {
    if(!err && data) {
        console.log("Loading saved intervalometer settings...", data);
        intervalometer.load(data);
    }
});

db.get('chargeLightDisabled', function(err, en) {
    if(!err) {
        power.init(en == "yes");
    }
});

db.get('buttonMode', function(err, mode) {
    power.setButtons(mode);
});

db.get('gestureSensor', function(err, en) {
    if(en != "no") {
        inputs.startGesture();
    } else {
        inputs.stopGesture();
    }
});

db.get('colorTheme', function(err, theme) {
    if(!err && theme) {
        oled.setTheme(theme);
    }
});

db.get('developerMode', function(err, en) {
    if(!err) {
        updates.developerMode = (en == "yes");
    }
});

db.get('gps', function(err, en) {
    if(!err) {
        power.gps(en == "yes");
    }
});

db.get('autoOffMinutes', function(err, minutes) {
    if(!err) {
        if(minutes === null) minutes = 10;
        if(!minutes) minutes = false;
        power.setAutoOff(minutes);
    }
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
                        if(driver == 'NMX') nmx.move(motor, steps, function() {
                            reply('move', {
                                complete: true,
                                motor: motor,
                                driver: driver
                            });
                        });
                    })(msg.driver, msg.motor, msg.val, msg.reply);
                }
                break;

            case 'focus':
                if (msg.key == "manual") {
                    camera.ptp.focus(msg.val, msg.repeat);
                }
                break;

            case 'capture':
                (function(lastLV) {
                    liveviewOn = 0;
                    camera.ptp.capture(null, function(err){
                        if(err) {
                            msg.reply('captureError', {msg:err});
                        }
                        setTimeout(function(){
                            if(lastLV && liveviewOn !== false) {
                                liveviewOn = true;
                                camera.ptp.preview();
                            } else {
                                liveviewOn = false;
                            }
                        }, 2000);
                    });
                })(liveviewOn);
                break;

            case 'test':
                camera.autoSetEv();
                //camera.testBulb();
                break;
    
            case 'run':
                intervalometer.run(msg.program);
                break;

            case 'stop':
                intervalometer.cancel();
                break;

            case 'timelapse-clips':
                intervalometer.getRecentTimelapseClips(30, function(err, clips) {
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
                intervalometer.getTimelapseImages(msg.index, function(err, images) {
                    msg.reply('timelapse-images', {
                        index: msg.index,
                        images: images.map(function(image) {
                            image = new Buffer(image).toString('base64');
                            return image;
                        })
                    });
                });
                break;

            case 'xmp-to-card':
                intervalometer.saveXMPsToCard(msg.index, function(err) {
                    msg.reply('xmp-to-card', {
                        index: msg.index,
                        error: err
                    });
                });
                break;

            case 'delete-clip':
                intervalometer.deleteTimelapseClip(msg.index, function(err) {
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
                    camera.ptp.preview();
                }
                break;

            case 'previewStop':
                camera.ptp.lvOff();
                break;

            case 'zoom':
                if (!msg.reset && msg.xPercent && msg.yPercent) {
                    camera.ptp.zoom(msg.xPercent, msg.yPercent);
                } else {
                    camera.ptp.zoom();
                }
                break;

            case 'set':
                if (msg.key && msg.val) camera.ptp.set(msg.key, msg.val);
                break;

            case 'dismiss-error':
                ui.dismissAlert();
                break;

            case 'setEv':
                if (msg.ev) {
                    if (camera.ptp.connected) {
                        camera.setEv(msg.ev, {}, function() {
                            camera.ptp.getSettings(function() {
                                camera.ptp.settings.stats = camera.evStats(camera.ptp.settings);
                                msg.reply('settings', {
                                    settings: camera.ptp.settings
                                });
                            });
                        });
                    }
                }
                break;

            case 'get':
                if (msg.key == "settings") {
                    if (camera.ptp.connected) {
                        camera.ptp.getSettings(function() {
                            camera.ptp.settings.stats = camera.evStats(camera.ptp.settings);
                            msg.reply('settings', {
                                settings: camera.ptp.settings
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
                    msg.reply('timelapseProgram', {program: intervalometer.currentProgram});
                } else if (msg.key == "thumbnail") {
                    if (camera.ptp.photo && camera.ptp.photo.jpeg) {
                        msg.reply('thumbnail', {
                            jpeg: new Buffer(camera.ptp.photo.jpeg).toString('base64'),
                            zoomed: camera.ptp.photo.zoomed,
                            type: camera.ptp.photo.type
                        });
                    }
                } else if (msg.key == "camera") {
                    msg.reply('camera', {
                        connected: camera.ptp.connected,
                        model: camera.ptp.connected ? camera.ptp.model : '',
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
camera.ptp.on('photo', function() {
    if (camera.ptp.photo && camera.ptp.photo.jpeg) {

        if (intervalometer.status.running) {
            var size = {
                x: 105,
                y: 65,
                q: 80
            }
            if (VIEW_HARDWARE) {
                image.downsizeJpeg(new Buffer(camera.ptp.photo.jpeg), size, null, function(err, jpgBuf) {
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
            if (VIEW_HARDWARE) {
                image.downsizeJpeg(new Buffer(camera.ptp.photo.jpeg), size, null, function(err, jpgBuf) {
                    if (!err && jpgBuf) {
                        image.saveTemp("oledthm", jpgBuf, function(err, path) {
                            oled.jpeg(path);
                            oled.update(true);
                        });
                    }
                });
            }
        }

        previewImage = {
            jpeg: new Buffer(camera.ptp.photo.jpeg).toString('base64'),
            zoomed: camera.ptp.photo.zoomed,
            type: camera.ptp.photo.type
        };

        if(intervalometer.status.running) liveviewOn = false;
        if (previewImage.type == "photo" || !liveviewOn) {
            app.send('photo');
            app.send('thumbnail', previewImage);
        } else if (previewImage.type == "preview" && !intervalometer.status.running) {
            liveviewOn = true;
            camera.ptp.preview();
        }
    }
});

app.on('connected', function(connected) {
    oled.setIcon('web', connected);
    ui.reload();
});

camera.ptp.on('settings', function() {
    app.send('settings', {
        settings: camera.ptp.settings
    });
});

camera.ptp.on('nmxSerial', function(status) {
    if (status == "connected") {
        console.log("NMX attached");
        nmx.connect(camera.ptp.nmxDevice);
    } else {
        console.log("NMX detached");
        nmx.disconnect();
    }
});

camera.ptp.on('connected', function() {
    oled.setIcon('camera', true);
    setTimeout(function() {
        app.send('camera', {
            connected: true,
            model: camera.ptp.model
        });
        if (VIEW_HARDWARE) {
            ui.status(camera.ptp.model);
            ui.reload();
        }
    }, 1000);
});

camera.ptp.on('exiting', function() {
    oled.setIcon('camera', false);
    app.send('camera', {
        connected: false,
        model: ''
    });
    if (VIEW_HARDWARE) {
        ui.defaultStatus("VIEW " + updates.version);
        ui.status("camera disconnected");
        ui.reload();
    }
});

camera.ptp.on('error', function(err) {
    app.send('error', {
        error: err
    });
});

camera.ptp.on('status', function(msg) {
    app.send('status', {
        status: msg
    });
    if (!blockInputs && VIEW_HARDWARE) {
        ui.status(msg);
        if (camera.ptp.connected) {
            ui.defaultStatus(camera.ptp.model);
        } else {
            ui.defaultStatus("VIEW " + updates.version);
        }
    }
});

intervalometer.on('status', function(msg) {
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
    var evText = (Math.round(camera.getEvFromSettings(camera.ptp.settings) * 10) / 10).toString();
    var statusScreen = {
        isoText: camera.ptp.settings.iso,
        shutterText: camera.ptp.settings.shutter,
        apertureText: "f/" + camera.ptp.settings.details.aperture ? camera.ptp.settings.aperture : camera.lists.getNameFromEv(camera.lists.aperture, intervalometer.currentProgram.manualAperture),
        evText: evText + " EV",
        intervalSeconds: msg.intervalMs / 1000,
        bufferSeconds: intervalometer.autoSettings.paddingTimeMs / 1000,
        rampModeText: intervalometer.currentProgram.rampMode,
        intervalModeText: intervalometer.currentProgram.rampMode == 'auto' ? intervalometer.currentProgram.intervalMode : 'fixed',
        frames: msg.frames,
        remaining: msg.framesRemaining,
        shutterSeconds: camera.ptp.settings.details.shutter ? camera.lists.getSecondsFromEv(camera.ptp.settings.details.shutter.ev) : 0,
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

intervalometer.on('error', function(msg) {
    ui.alert('ERROR', msg);
    app.send('intervalometerError', {
        msg: msg
    });
    console.log("Intervalometer ERROR: ", msg);
});

function getMotionStatus() {
    var status = nmx.getStatus();
    var available = status.connected && (status.motor1 || status.motor2 || status.motor2);
    var motors = [];
    motors.push({driver:'NMX', motor:1, connected:status.motor1});
    motors.push({driver:'NMX', motor:2, connected:status.motor2});
    motors.push({driver:'NMX', motor:3, connected:status.motor3});
    return {
        available: available,
        motors: motors
    };
}

nmx.on('status', function(){
    var motion = getMotionStatus();
    app.send('motion', motion);
});

