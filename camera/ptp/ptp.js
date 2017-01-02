var udev = require('udev');
var monitor = udev.monitor();
var exec = require('child_process').exec;
var fs = require('fs');
var worker = false;
var cameraConnected = false;

var cluster = require('cluster');

cluster.setupMaster({
    exec: "/home/view/current/camera/ptp/worker.js"
});

var EventEmitter = require("events").EventEmitter;

var camera = new EventEmitter();

camera.sdPresent = false;
camera.connected = false;
camera.ev = 0;
camera.model = false;
camera.photo = null;
camera.settings = false;
camera.iso = false;
camera.aperture = false;
camera.shutter = false;
camera.supports = {}

var cbStore = {};
var cbIndex = 0;

function getCallbackId(cb) {
    if (!cb) return 0;
    cbIndex++;
    if (cbIndex > 300) cbIndex = 1;
    cbStore[cbIndex.toString()] = cb;
    return cbIndex;
}

function runCallback(cbData) {
    if (cbData && cbData.id && cbStore[cbData.id.toString()]) {
        var cb = cbStore[cbData.id.toString()];
        cb(cbData.err, cbData.data);
        delete cbStore[cbData.id.toString()]
    }
}

function errorCallbacks(err) {
    for (var i in cbStore) {
        runCallback({
            err: err,
            data: null
        });
    }
}

var startWorker = function() {
    if (!worker) {
        camera.connected = false;
        camera.connecting = true;
        worker = cluster.fork();
        worker.on('listening', function() {
            console.log("worker started");
        });

        worker.on('exit', function(code, signal) {
            console.log("worker exited");
            worker = false;
            errorCallbacks("camera not available");
            if (camera.connected) {
                process.nextTick(startWorker);
                camera.connecting = true;
            } else {
                camera.connecting = false;
            }
            camera.connected = false;
        });

        worker.on('message', function(msg) {
            if (msg.type == 'event') {
                console.log('event:', msg.event); //, msg.value ? msg.value.length : '');
                if (msg.event == "photo") {
                    camera.photo = msg.value;
                    msg.value = null;
                }
                if (msg.event == "ev") {
                    camera.ev = msg.value;
                }
                if (!msg.value) msg.value = false;
                if (msg.event == "settings") {
                    var newSettings = (msg.value && msg.value.mapped) ? msg.value.mapped : {};
                    if (!camera.settings || JSON.stringify(camera.settings) != JSON.stringify(newSettings)) {
                        camera.emit(msg.event, msg.value);
                    }
                    console.log("capture target: ", newSettings.target);
                    if (!camera.target) camera.target = "CARD";
                    if (newSettings.target && newSettings.target != camera.target) camera.set('target', camera.target);
                    console.log("PTP: settings updated");
                    camera.settings = newSettings;

                } else if (msg.event == "callback") {
                    runCallback(msg.value);
                } else {
                    camera.emit(msg.event, msg.value);
                }

                if (msg.event == 'connected') {
                    camera.connected = true;
                    camera.model = msg.value;
                    console.log("Camera connected: ", camera.model);
                    if(camera.model.match(/sony/i)) {
                        console.log("matched sony, setting supports.destination = false");
                        camera.supports.destination = false;
                        if(camera.model.match(/(a6300|A7r II|A7s II|A7 II|ILCE-7M2|ILCE-7M2|A7s|a6500|a99 II|a77 II|a68)/i)) {
                            camera.supports.liveview = true;
                        }
                    } else if(camera.model.match(/panasonic/i)) {
                        camera.supports.liveview = false;
                        camera.supports.destination = true;
                    } else {
                        camera.supports.liveview = true;
                        camera.supports.destination = true;
                    }
                }
                if (msg.event == 'exiting') {
                    camera.connected = false;
                    errorCallbacks("camera disconnected");
                }
            }
        });
    }
}
startWorker();

var blockDevices = fs.readdirSync("/sys/class/block/");
if(blockDevices.indexOf('mmcblk1p1') !== -1) {
    camera.sdDevice = '/dev/mmcblk1p1';
    console.log("SD card added:", camera.sdDevice);
    camera.sdPresent = true;
    camera.emit("media", "sd");

    exec("mount", function(err, stdout, stderr) {
        if(stdout.indexOf('/dev/mmcblk1p1') !== -1) {
            camera.sdMounted = true;
        }
    });
}

monitor.on('add', function(device) {
    //console.log("device added:", device);
    if (device.SUBSYSTEM == 'usb') {
        if (!worker) startWorker();
    } else if (device.SUBSYSTEM == 'block' && device.DEVTYPE == 'partition' && device.ID_PATH == 'platform-1c11000.mmc') {
        console.log("SD card added:", device.DEVNAME);
        captureIndex = 1;
        camera.sdPresent = true;
        camera.sdDevice = device.DEVNAME;
        if(camera.sdMounted) camera.unmountSd(function(){
            camera.emit("media-insert", "sd");
        });
    } else if (device.SUBSYSTEM == 'tty' && device.ID_VENDOR == 'Dynamic_Perception_LLC') {
        console.log("NMX connected:", device.DEVNAME);
        camera.nmxConnected = true;
        camera.nmxDevice = device.DEVNAME;
        camera.emit("nmxSerial", "connected");
    }
});

monitor.on('remove', function(device) {
    if (device.SUBSYSTEM == 'usb' && device.GPHOTO2_DRIVER) {
        console.log("on remove", device);
        if (worker) worker.send({
            type: 'command',
            do: 'exit'
        });
    } else if (device.SUBSYSTEM == 'tty' && device.ID_VENDOR == 'Dynamic_Perception_LLC') {
        console.log("NMX disconnected:", device.DEVNAME);
        camera.nmxConnected = false;
        camera.nmxDevice = null;
        camera.emit("nmxSerial", "disconnected");
    } else if (device.SUBSYSTEM == 'block' && device.DEVTYPE == 'partition' && device.ID_PATH == 'platform-1c11000.mmc') {
        console.log("SD card removed:", device.DEVNAME);
        camera.emit("media-remove", "sd");
        camera.sdPresent = false;
        if (camera.sdMounted) {
            //unmount card
            camera.unmountSd();
        }
    }
});

/*
// scan for wifi cameras
var evilscan = require('evilscan');

var options = {
    target: '192.168.1.1/6',
    port: '50001',
    status: 'O',
    concurrency: 32
};

var scanner = new evilscan(options);

scanner.on('result', function(data) {
    // fired when item is matching options
    console.log("wifi scan result:", data);
});

scanner.on('error', function(err) {
    console.log("wifi scan error:", err.toString());
});

scanner.on('done', function() {
    // finished !
    console.log("wifi scan complete!");
});

scanner.run();
*/


camera.mountSd = function(callback) {
    if (camera.sdPresent) {
        if(camera.sdMounted) return callback && callback(null);
        console.log("mounting SD card");
        //exec("mount -o nonempty " + camera.sdDevice + " /media", function(err) { // this caused FAT32 cards to fail to mount
        exec("mount " + camera.sdDevice + " /media", function(err) {
            if (!err) camera.sdMounted = true; else console.log("error mounting sd card: ", err);
            if (callback) callback(err);
        });
    } else {
        if (callback) callback(true);
    }
}

var sdUnmountErrors = 0;
camera.unmountSd = function(callback) {
    if (camera.sdMounted) {
        console.log("unmounting SD card");
        exec("umount /media", function(err) {
            if (err) {
                console.log("error unmounting: ", err);
                sdUnmountErrors++;
                if(sdUnmountErrors < 3) {
                    return setTimeout(function(){
                        camera.unmountSd(callback);
                    }, 500);
                }
            } else {
                camera.sdMounted = false;
            }
            sdUnmountErrors = 0;
            if (callback) callback(err);
        });
    } else {
        if (callback) callback(null);
    }
}

function padNumber(n, width) {
    var s = n.toString();
    while(s.length < width) s = '0' + s;
    return s;
}
var captureIndex = 1;
camera.capture = function(options, callback) {
    if (worker && camera.connected) {
        if(camera.supports.destination) {
            worker.send({
                type: 'camera',
                do: 'capture',
                options: options,
                id: getCallbackId(callback)
            });
        } else {
            if(camera.sdPresent) {
                camera.mountSd(function(err) {
                    if(err) {
                        callback && callback("Error mounting SD card\nSystem message:", err);
                    } else {
                        var folder = "/media/view-raw-images";
                        exec('mkdir -p ' + folder, function() {
                            fs.readdir(folder, function(err, list) {
                                var width = 6;
                                var name = "img";
                                if(!err && list) {
                                    list = list.map(function(item) {
                                        return item.replace(/\.[^.]+$/, "");
                                    });
                                    console.log("list", list);
                                    while(list.indexOf(name + padNumber(captureIndex, width)) !== -1) captureIndex++;
                                }
                                var saveRaw = folder + '/' + name + padNumber(captureIndex, width);
                                if(!options) options = {};
                                options.saveRaw = saveRaw;
                                console.log("Saving RAW capture to", options.saveRaw);
                                var capture = {
                                    type: 'camera',
                                    do: 'capture',
                                    options: options,
                                    id: getCallbackId(function(err){
                                        setTimeout(camera.unmountSd, 1000);
                                        callback && callback(err);
                                    })
                                }
                                console.log(capture);
                                worker.send(capture);
                            });
                        });
                    }
                });
            } else {
                callback && callback("SD card required in VIEW");
            }
        }
    } else {
        callback && callback("not connected");
    }
}
camera.captureTethered = function(callback) {
    if (worker && camera.connected) worker.send({
        type: 'camera',
        do: 'captureTethered',
        id: getCallbackId(callback)
    }); else callback && callback("not connected");
}
camera.preview = function(callback) {
    if(!camera.supports.liveview) {
        return callback && callback("not supported");
    }
    if (worker && camera.connected) worker.send({
        type: 'camera',
        do: 'preview',
        id: getCallbackId(callback)
    }); else callback && callback("not connected");
}
camera.lvTimerReset = function() {
    if (worker && camera.connected) worker.send({
        type: 'camera',
        do: 'lvTimerReset'
    }); else callback && callback("not connected");
}
camera.zoom = function(xTargetPercent, yTargetPercent) {
    var data = {
        reset: true
    };
    if (worker && camera.connected && xTargetPercent !== null && yTargetPercent !== null) {
        camera.zoomed = true;
        data = {
            xPercent: xTargetPercent,
            yPercent: yTargetPercent
        };
    } else {
        camera.zoomed = false;
    }
    if (worker && camera.connected) worker.send({
        type: 'camera',
        do: 'zoom',
        data: data
    }); else callback && callback("not connected");
}
camera.focus = function(step, repeat, callback) {
    if (!repeat) repeat = 1;
    var param;
    if (!step) return;
    if (step < 0) {
        param = "Near 1";
        if (step < -1) param = "Near 2";
    } else {
        param = "Far 1";
        if (step > 1) param = "Far 2";
    }
    if (worker && camera.connected) {
        var doFocus = function() {
            camera.lvTimerReset();
            worker.send({
                type: 'camera',
                set: 'manualfocusdrive',
                value: param,
                id: getCallbackId(function() {
                    repeat--;
                    if (repeat > 0) {
                        setTimeout(doFocus, 10);
                    } else {
                        if (callback) callback();
                    }
                })
            });
        }
        doFocus();
    } else callback && callback("not connected");
}
camera.set = function(item, value, callback) {
    if (worker && camera.connected) worker.send({
        type: 'camera',
        set: item,
        value: value,
        id: getCallbackId(callback)
    }); else callback && callback("not connected");
}
camera.get = function(item) {
    if (worker && camera.connected) {
        console.log("PTP: retrieving settings...");
        camera.getSettings(function() {
            camera.emit("config", camera.settings);
        });
    } else callback && callback("not connected");
}
camera.getSettings = function(callback) {
    if (worker && camera.connected) worker.send({
        type: 'camera',
        get: 'settings',
        id: getCallbackId(callback)
    }); else callback && callback("not connected");
}
camera.saveThumbnails = function(path, callback) {
    if (worker && camera.connected) worker.send({
        'type': 'setup',
        'set': 'thumbnailPath',
        'value': path
    });  else callback && callback("not connected");
}

camera.saveToCameraCard = function(bool) {
    if (bool === null) {
        return camera.target == "CARD";
    } else {
        var target = bool ? "CARD" : "RAM";
        if (target != camera.target) {
            camera.target = target;
            camera.set('target', camera.target);
            return camera.target;
        }
    }
}

module.exports = camera;