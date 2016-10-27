/*jslint node:true,vars:true,bitwise:true */
'use strict';

var VIEW_HARDWARE = true; // is this running on official VIEW hardware?

console.log('Starting up...');

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
    var menu = require('./hardware/menu.js');
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

console.log('Modules loaded.');

var scanIntervalHandle = null;

if (VIEW_HARDWARE) {
    menu.init();
    inputs.start();

    var configureWifi = function() {
        db.get('wifi-status', function(err, wifiStatus) {
            if(wifiStatus) {
                if(wifiStatus.enabled) {
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
                            if(wifiStatus.apMode) {
                                wifi.enableAP();
                            } else if(wifiStatus.connect) {
                                wifi.connect(wifiStatus.connect, wifiStatus.password);
                            }
                        }
                    },5000);
                });
            }
        });
    }
    configureWifi();

    wifi.on('connect', function(ssid) {
        menu.status('wifi connected to ' + ssid);
        ui.reload();
    });
    wifi.on('disconnect', function(previousConnection) {
        menu.status('wifi disconnected');
        if(previousConnection && previousConnection.address) {
            wifi.disable(function(){
                setTimeout(configureWifi, 2000);
            });
        }
        ui.reload();
    });

    power.on('charging', function(status) {
        menu.chargeStatus(status);
    });

    power.on('percentage', function(percentage) {
        menu.batteryPercentage(percentage);
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

    var valueDisplay = function(name, object, key) {
        return function() {
            if (object && object.hasOwnProperty(key)) return name + "~" + object[key];
            else return name;

        }
    }

    var exposureMenu = {
        name: "capture",
        type: "function",
        fn: function(args, cb) {
            blockInputs = true;
            var stats, ev;

            function captureButtonHandler(b) {
                menu.activity();
                if (b == 1 || b == 4) {
                    liveviewOn = false;
                    blockInputs = false;
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
                menu.activity();
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
        name: "cancel timelapse?",
        type: "options",
        items: [{
            name: "cancel timelapse?",
            value: "no",
            action: {
                type: 'function',
                fn: function(arg, cb) {
                    cb();
                }
            }
        }, {
            name: "cancel timelapse?",
            value: "yes",
            action: {
                type: 'function',
                fn: function(arg, cb) {
                    intervalometer.cancel();
                    cb();
                }
            }
        }]
    }


    var timelapseRunningMenu = {
        name: "time-lapse",
        type: "menu",
        items: [{
            name: "PREVIEW",
            action: {
                type: "function",
                fn: function(arg, cb) {
                    var timelapse = intervalometer.getLastTimelapse(function(err, timelapse) {
                        if (timelapse) menu.video(timelapse.path, timelapse.frames, 24, cb);
                    });
                }
            }
        }, {
            name: valueDisplay("Status: Running", intervalometer.status, 'frames'),
            action: stopConfirm
        }]
    }

    var timelapseMenu = {
        name: "time-lapse",
        type: "menu",
        alternate: function() {
            if (intervalometer.status.running) {
                return timelapseRunningMenu;
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
            name: valueDisplay("Exposure", camera.ptp.settings.stats, 'ev'),
            help: help.exposureMenu,
            action: exposureMenu
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
                return intervalometer.currentProgram.intervalMode == 'fixed';
            }
        }, {
            name: valueDisplay("Day Interval", intervalometer.currentProgram, 'dayInterval'),
            action: dayInterval,
            help: help.dayInterval,
            condition: function() {
                return intervalometer.currentProgram.intervalMode == 'auto';
            }
        }, {
            name: valueDisplay("Night Interval", intervalometer.currentProgram, 'nightInterval'),
            action: nightInterval,
            help: help.nightInterval,
            condition: function() {
                return intervalometer.currentProgram.intervalMode == 'auto';
            }
        }, {
            name: valueDisplay("Frames", intervalometer.currentProgram, 'frames'),
            action: framesOptions,
            help: help.framesOptions,
            condition: function() {
                return intervalometer.currentProgram.intervalMode == 'fixed';
            }
        }, {
            name: valueDisplay("Destination", intervalometer.currentProgram, 'destination'),
            action: destinationOptions,
            help: help.destinationOptions,
            condition: function() {
                return camera.ptp.sdPresent;
            }
        }, {
            name: "START",
            help: help.startTimelapse,
            action: {
                type: "function",
                fn: function(arg, cb) {
                    if (intervalometer.currentProgram.intervalMode == "auto") intervalometer.currentProgram.interval = 0;
                    intervalometer.run(intervalometer.currentProgram);
                    cb();
                }
            }
        }, ]
    }

    var clipsMenu = function(cb) {
        intervalometer.getRecentTimelapseClips(10, function(err, clips) {
            if (clips) {
                var cm = {
                    name: "timelapse clips",
                    type: "menu",
                    items: []
                };
                for (var i = 0; i < clips.length; i++) {
                    if (clips[i]) cm.items.push({
                        name: clips[i].name + " (" + clips[i].frames + ")",
                        help: help.clipsMenu,
                        action: {
                            type: "function",
                            arg: clips[i],
                            fn: function(clip, cb) {
                                menu.video(clip.path, clip.frames, 24, cb);
                            }
                        },
                        button3: function(item) {
                            if(camera.ptp.sdPresent && item && item.action && item.action.arg) {
                                confirmSaveXMPs(item.action.arg);
                            }
                        }
                    });
                }
                cb(err, cm);
            }
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
                    menu.value([{
                        name: "Timelapse+",
                        value: "Shutting Down"
                    }]);
                    menu.update();
                    if (!intervalometer.status.running) {
                        closeSystem(function(){
                            exec('init 0', function() {});
                        });
                    }
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
                menu.activity();
                if (b == 1) {
                    liveviewOn = false;
                    blockInputs = false;
                    inputs.removeListener('B', captureButtonHandler);
                    inputs.removeListener('D', captureDialHandler);
                    setTimeout(cb, 500);
                } else if (b == 4) {
                    camera.ptp.capture();
                }
            }

            function captureDialHandler(d) {
                menu.activity();
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
                            menu.value([{
                                name: "Error",
                                value: "Install in progress"
                            }]);
                            menu.update();
                        } else if(versionTarget.installed) {
                            updates.setVersion(versionTarget, function(){
                                menu.value([{
                                    name: "Reloading app...",
                                    value: "Please Wait"
                                }]);
                                menu.update();
                                exec('killall node; /bin/sh /root/startup.sh', function() {}); // restarting system
                            });
                        } else {
                            updates.installVersion(versionTarget, function(err){
                                if(!err) {
                                    updates.setVersion(versionTarget, function(){
                                        menu.status('update successful');
                                        menu.value([{
                                            name: "Reloading app...",
                                            value: "Please Wait"
                                        }]);
                                        menu.update();
                                        exec('killall node; /bin/sh /root/startup.sh', function() {}); // restarting system
                                    });
                                } else {
                                    menu.status('error updating');
                                    if(cb) cb();
                                    //ui.back();
                                }
                            }, function(statusUpdate) {
                                menu.value([{
                                    name: statusUpdate,
                                    value: "Please Wait"
                                }]);
                                menu.status(statusUpdate);
                                menu.update();
                                menu.activity();
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
                                name: "Installing version " + versionTarget.version + "?",
                                type: "options",
                                items: [{
                                    name: "Installing version " + versionTarget.version + "?",
                                    value: updates.installStatus,
                                    help: help.softwareHelpHeader + ' \n Version release notes: \n ' + versionTarget.notes,
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
                                    ui.load(versionUpdateConfirmMenuBuild(version));
                                } else {
                                    menu.status('already installed');
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
                var dbVersions = versions.filter(function(v){return v.installed;});
                db.set('versions-installed', dbVersions);
                buildUpdateMenu(err, versions);
            });
        } else {
            db.get('versions-installed', function(err, versions) {
                if(!err && versions) {
                    for(var i = 0; i < versions.length; i++) {
                        if(updates.version == versions[i].version) {
                            versions[i].current = true;
                        } else {
                            versions[i].current = false;
                        }
                    }
                    buildUpdateMenu(err, versions);
                } else {
                    menu.value([{
                        name: "Version Update",
                        value: "WiFi Required"
                    }]);
                    menu.update();
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
                                    menu.status('connecting to ' + item.ssid);
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
                        menu.status('connecting to ' + item.ssid);
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
                return wifi.btEnabled;
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
                return !wifi.btEnabled;
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
            action: {
                type: 'function',
                fn: function(arg, cb) {
                    if(power.lightDisabled !== false) {
                        db.set('chargeLightDisabled', "no");
                        power.init(false);
                    }
                    cb();
                }
            }
        }, {
            name: "Charge Indicator LED",
            value: "disabled",
            help: help.chargeIndicatorMenu,
            action: {
                type: 'function',
                fn: function(arg, cb) {
                    if(power.lightDisabled !== true) {
                        db.set('chargeLightDisabled', "yes");
                        power.init(true);
                    }
                    cb();
                }
            }
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

    var rampingOptions = {
        name: "timelapse mode",
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
            help: help.rampingNightCompensation,
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
            name: "Charge Indicator",
            action: chargeIndicatorMenu,
            help: help.chargeIndicatorMenu
        }, {
            name: "Software Version",
            action: softwareMenu,
            help: help.softwareMenu
        }, {
            name: "Ramping Options",
            action: rampingOptionsMenu,
            help: help.rampingOptionsMenu
        }, {
            name: "Factory Reset",
            action: factoryResetConfirmMenu,
            help: help.eraseAllSettingsMenu
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
                return !intervalometer.status.running;
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

    ui.init(menu);
    ui.load(mainMenu);

    inputs.on('D', function(move) {
        if(menu.videoRunning) return;

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
        if(menu.videoRunning) {
            menu.stopVideo();
            return;
        }
        blockGestureTimer();
        if (blockInputs) return;

        if (move == "1") {
            ui.back();
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
            ui.load(powerConfirm);
        }
    });

    var confirmSaveXMPs = function(clip) {
        ui.load({
            name: "Save new XMPs to SD?",
            type: "options",
            items: [{
                name: "Save new XMPs to SD?",
                value: "write to SD",
                action: {
                    type: 'function',
                    fn: function(arg, cb) {
                        menu.value([{
                            name: "Writing to card",
                            value: "please wait"
                        }]);
                        menu.update();
                        if(clip) intervalometer.saveXMPsToCard(clip.index, function(err) {
                            cb();
                        }); else cb();
                    }
                }
            }, {
                name: "Save new XMPs to SD?",
                value: "cancel",
                action: {
                    type: 'function',
                    fn: function(arg, cb) {
                        cb();
                    }
                }
            }]
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
                action: {
                    type: 'function',
                    fn: function(arg, cb) {
                        authDisplayed = false;
                        cb();
                    }
                }
            }]
        });
    }

    app.on('auth-required', function(code) {
        if(authDisplayed) {
            ui.back();
            authDisplayed = false;
        }
        menu.activity();
        displayAuthCode(code);
    });

    app.on('auth-complete', function(code) {
        if(authDisplayed) {
            ui.back();
            authDisplayed = false;
        }
        menu.activity();
        menu.status('connected to view.tl');
    });

    camera.ptp.on('media', function(type) {
        console.log("media inserted: ", type);
        menu.activity();
        intervalometer.getLastTimelapse(function(err, timelapse) {
            confirmSaveXMPs(timelapse);
        });
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

    var gestureModeTimer = function() {
        if (gestureModeHandle) clearTimeout(gestureModeHandle);
        if (!gestureMode) {
            gestureMode = true;
            menu.png('/home/view/current/media/gesture-oled.png');
        }
        gestureModeHandle = setTimeout(function() {
            if (gestureMode) {
                gestureMode = false;
                ui.reload();
                menu.hide();
            }
        }, 5000);
    }

    inputs.on('G', function(move) {
        if (blockInputs) return;
        console.log("Gesture: " + move);
        if (blockGesture) {
            console.log("(blocked)");
            return;
        }
        gestureModeTimer();
        if (!menu.visible) {
            menu.show();
            return;
        }

        if (move == "U") {
            //ui.up();
        }
        if (move == "D") {
            //ui.down();
        }
        if (move == "L") {
            menu.hide();
        }
        if (move == "R") {
            if (!menu.visible) {
                menu.show();
            } else {
                //if (menu.selected == 1) {
                //    camera.ptp.capture();
                //    setTimeout(menu.update, 8000);
                //}
                //if (menu.selected == 2) {
                var timelapse = intervalometer.getLastTimelapse(function(err, timelapse) {
                    if (timelapse) menu.video(timelapse.path, timelapse.frames, 24, function() {
                        ui.reload();
                    });
                });
                //}
            }
        }
    });

}


function startScan() {
    if (!scanIntervalHandle) scanIntervalHandle = setInterval(startScan, 60000);
    if (noble.state == "poweredOn") {
        setTimeout(function() {
            noble.stopScanning();
        }, 500);
        setTimeout(function() {
            noble.startScanning(['b8e0606762ad41ba9231206ae80ab550']);
        }, 5000);
    } else {
        noble.on('stateChange', function(state) {
            console.log("BLE state changed to", state);
            if (state == "poweredOn") {
                setTimeout(function() {
                    startScan()
                });
            }
        });
    }
}
startScan();

noble.on('discover', function(peripheral) {
    //console.log('ble', peripheral);
    nmx.connect(peripheral);
});


nmx.connect();

nmx.on('status', function(status) {
    if (status.connected) {
        noble.stopScanning();
        clearInterval(scanIntervalHandle);
        scanIntervalHandle = null;
    } else {
        startScan();
    }
});

function closeSystem(callback) {
    console.log("Shutting down!");
    db.set('intervalometer.currentProgram', intervalometer.currentProgram);
    //db.setCache('intervalometer.status', intervalometer.status);
    nmx.disconnect();
    if (VIEW_HARDWARE) {
        menu.close();
        inputs.stop();
    }
    db.close(callback);
}

process.on('exit', function() {
    closeSystem();
});

db.get('intervalometer.currentProgram', function(err, data) {
    if(!err && data) {
        console.log("Loading saved intervalometer settings...", data);
        for(var key in data) {
            intervalometer.currentProgram[key] = data[key];
        }
    }
});

db.get('chargeLightDisabled', function(err, en) {
    if(!err) {
        power.init(en == "yes");
    }
});

db.get('gps', function(err, en) {
    if(!err) {
        power.gps(en == "yes");
    }
});

light.start();

app.on('message', function(msg) {
    try {
        switch(msg.type) {
            case 'nmx':            
                if (msg.key == "move" && msg.motor) {
                    console.log("moving motor " + msg.motor);
                    nmx.move(msg.motor, msg.val, function() {
                        msg.reply('move', {
                            complete: true,
                            motor: msg.motor
                        });
                    });
                }
                break;

            case 'focus':
                if (msg.key == "manual") {
                    camera.ptp.focus(msg.val, msg.repeat);
                }
                break;

            case 'capture':
                camera.ptp.capture();
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

            case 'preview':
                if (liveviewOn) {
                    if (previewImage) msg.reply(previewImage);
                } else {
                    camera.ptp.preview();
                }
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
                } else if (msg.key == "nmx") {
                    msg.reply('nmx', {
                        status: nmx.getStatus()
                    });
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

camera.ptp.on('photo', function() {
    if (camera.ptp.photo && camera.ptp.photo.jpeg) {

        if (!intervalometer.status.running) {
            var size = {
                x: 160,
                q: 80
            }
            if (VIEW_HARDWARE) {
                image.downsizeJpeg(new Buffer(camera.ptp.photo.jpeg), size, null, function(err, jpgBuf) {
                    if (!err && jpgBuf) {
                        image.saveTemp("oledthm", jpgBuf, function(err, path) {
                            menu.jpeg(path);
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
    setTimeout(function() {
        app.send('camera', {
            connected: true,
            model: camera.ptp.model
        });
        if (VIEW_HARDWARE) {
            menu.status(camera.ptp.model);
            ui.reload();
        }
    }, 1000);
});

camera.ptp.on('exiting', function() {
    app.send('camera', {
        connected: false,
        model: ''
    });
    if (VIEW_HARDWARE) {
        menu.defaultStatus("Timelapse+ VIEW " + updates.version);
        menu.status("camera disconnected");
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
        menu.status(msg);
        if (camera.ptp.connected) {
            menu.defaultStatus(camera.ptp.model);
        } else {
            menu.defaultStatus("Timelapse+ VIEW " + updates.version);
        }
    }
});

intervalometer.on('status', function(msg) {
    app.send('intervalometerStatus', {
        status: msg
    });
    cache.intervalometerStatus = msg;
});

nmx.on('status', function(msg) {
    app.send('nmx', {
        status: msg
    });
});

// turn off blinking light once app has loaded
exec("echo 0 | sudo tee /sys/class/leds/view-button-power/brightness");
exec("echo 0 | sudo tee /sys/class/leds/view-button-1/brightness");
exec("echo 0 | sudo tee /sys/class/leds/view-button-2/brightness");
exec("echo 0 | sudo tee /sys/class/leds/view-button-3/brightness");
