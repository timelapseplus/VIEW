var udev = require('udev');
var monitor = udev.monitor();
var exec = require('child_process').exec;
var fs = require('fs');
var cluster = require('cluster');
var async = require('async');
var _ = require('underscore');
var workers = [];

var cameraConnected = false;

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
camera.lvOn = false;
camera.supports = {};
camera.focusPos = 0;

var FUJI_FOCUS_RESOLUTION = 5;

// multi-cam properties
camera.primaryPort = null;
camera.count = 0;
camera.synchronized = true;

var cbStore = {};
var cbIndex = 0;

camera.cameraList = function(callback) {
    var list = [];
    for(var i = 0; i < workers.length; i++) {
        if(workers[i].connected) {
            list.push({
                model: workers[i].model,
                primary: workers[i].port != camera.primaryPort,
                _port: workers[i].port
            });
        }
    }
    callback && callback(list);
    return list;
}

camera.switchPrimary = function(cameraObject, callback) {
    if(cameraObject._port) {
        console.log("switching primary camera to ", cameraObject.model);            
        var index = getWorkerIndex(cameraObject._port);
        if(index === false || !workers[index].connected) return true;
        camera.primaryPort = workers[index].port;
        camera.settings = workers[index].settings;
        camera.supports = workers[index].supports;
        camera.model = workers[index].model;
        camera.emit('connected', camera.model);
    }
    callback && callback();
}

function getCallbackId(port, callerName, cb) {
    if (!cb) return 0;
    cbIndex++;
    if (cbIndex > 300) cbIndex = 1;
    cbStore[cbIndex.toString()] = {callback: cb, port: port, name: callerName};
    return cbIndex;
}

function runCallback(cbData) {
    if (cbData && cbData.id && cbStore[cbData.id.toString()]) {
        var cb = cbStore[cbData.id.toString()];
        cb && cb.callback && cb.callback(cbData.err, cbData.data);
        delete cbStore[cbData.id.toString()];
    }
}

function cancelCallbacks() {
    for(var i in cbStore) {
        delete cbStore[i];
    }
}

function errorCallbacks(err, port) {
    console.log("running remaining callbacks:", JSON.stringify(cbStore));
    for (var i in cbStore) {
        if(!port || cbStore[i].port == port) runCallback({
            id: i,
            err: err,
            data: null
        });
    }
}

camera.cancelCallbacks = function(cb) {
    cancelCallbacks();
    cb && cb();
}

camera.disabled = false;
var disabledCallback = null;
camera.disableWorker = function(cb) {
    camera.disabled = true;
    if(workers.length > 0) {
        disabledCallback = cb;
        for(var i = 0; i < workers.length; i++) {
            workers[i].send({
                type: 'command',
                do: 'exit'
            });
        }
    } else {
        cb && cb(true);
    }
}

camera.enableWorker = function(cb) {
    camera.disabled = false;
    disabledCallback = null;
    if(workers.length == 0) {
        process.nextTick(startWorker);
        camera.connecting = true;
        cb && cb();
    } else {
        cb && cb(true);
    }
}

var startWorker = function(port) {
    if(!port) {
        exec('/usr/bin/lsusb', function(err, res){
            if(!err && res) {
                var lines = res.split('\n');
                for(var i = 0; i < lines.length; i++) {
                    var matches = lines[i].match(/Bus ([0-9]+) Device ([0-9]+)/i);
                    if(matches && matches.length >= 3) {
                        var bus = matches[1];
                        var device = matches[2];
                        var port = "usb:" + bus + "," + device;
                        if(parseInt(bus) < 3 && parseInt(device) > 1) {
                            (function(p){
                                process.nextTick(function() {
                                    startWorker(p);
                                });
                            })(port);
                        }
                    }
                }
            }
        });
    } else if (getWorkerIndex(port) === false) {
        console.log("starting worker for port", port);
        var worker = cluster.fork();
        worker.connected = false;
        worker.connecting = true;
        worker.port = port;
        worker.supports = {};
        worker.settings = false;
        workers.push(worker);
        worker.on('exit', function(code, signal) {
            console.log("worker exited on port", worker.port);
            var index = getWorkerIndex(worker.port);
            workers.splice(index, 1);
            errorCallbacks("camera disconnected on port" + worker.port, worker.port);
            if(camera.disabled) {
                if(worker.port == camera.primaryPort) {
                    disabledCallback && disabledCallback();
                    worker.connecting = false;
                }
            } else if (worker.connected) {
                port = worker.port;
                process.nextTick(function(){startWorker(port)});
                worker.connecting = true;
            } else {
                worker.connecting = false;
            }
            //if(worker.port == camera.primaryPort) camera.connected = false;
            worker.connected = false;
            updateCameraCounts();
        });

        worker.on('message', function(msg) {
            if(msg.event == 'online') {
                console.log("worker started, sending port:", port);
                worker.send({type:'port', port:port});
            }
            if (msg.type == 'event') {
                if(msg.event != "callback") console.log('event:', msg.event); //, msg.value ? msg.value.length : '');
                if (msg.event == 'connected') {
                    console.log("worker connected on port", worker.port);
                    worker.connected = true;
                    worker.model = msg.value;
                    console.log("Camera connected: ", worker.model);
                    worker.supports.thumbnail = true;
                    worker.supports.focus = false;
                    worker.supports.destination = true;
                    if(worker.model != 'SonyWifi' && worker.model.match(/sony/i)) {
                        worker.supports.thumbnail = false;
                        if(worker.model.match(/(a6300|A7r II|A7r III|A7s II|A7 II|ILCE-7M2|ILCE-7M2|A7s|a6500|a99 M2|a99 II|a77 II|a68|A9)/i)) {
                            worker.supports.liveview = true;
                        }
                        if(worker.model.match(/(A7r III|A9)/i)) {
                            console.log("PTP: matched sony, setting supports.destination = true");
                            worker.supports.destination = true;
                            worker.supports.focus = true;
                        } else {
                            console.log("PTP: matched sony, setting supports.destination = false");
                            worker.supports.destination = false;
                        }
                    } else if(worker.model.match(/panasonic/i)) {
                        if(worker.model.match(/gh5/i) || worker.model.match(/g9/i)) {
                            worker.supports.liveview = true;
                        } else {
                            worker.supports.liveview = false;
                        }
                        worker.supports.destination = true;
                    } else if(worker.model.match(/fuji/i)) {
                        worker.supports.focus = true;
                        worker.supports.liveview = true;
                        camera.set('d38c', '1', null, worker); // PC mode
                        camera.set('d207', '2', null, worker); // USB shutter control
                        camera.set('expprogram', 'M', null, worker); // Manual mode
                    } else if(worker.model.match(/eos m5/i)) {
                        camera.set('output', 'Unknown value 0008', null, worker); // PC control mode
                        worker.supports.liveview = false;
                    } else if(worker.model.match(/canon/i)) {
                        worker.supports.focus = true;
                        worker.supports.liveview = true;
                    } else if(worker.model.match(/nikon/i)) {
                        worker.supports.focus = true;
                        worker.supports.liveview = true;
                    } else if(worker.model.match(/olympus/i)) {
                        worker.supports.liveview = true;
                        worker.supports.focus = true;
                    }
                    updateCameraCounts();
                    if(worker.port == camera.primaryPort) {
                        console.log("setting", msg.value, "as primary camera");
                        camera.primaryPort = worker.port;
                        camera.connected = true;
                        camera.model = msg.value;
                        camera.supports = worker.supports;
                        setTimeout(camera.getSettings, 3000);
                    }
                }
                if (msg.event == 'exiting') {
                    if(worker.connected) {
                        worker.connected = false;
                        updateCameraCounts();
                        return camera.emit('exiting', false);
                    }
                }

                if (msg.event == "photo") {
                    camera.photo = msg.value;
                    msg.value = null;
                }
                if (msg.event == "ev") {
                    camera.ev = msg.value;
                }
                //if (msg.event == "histogram") {
                //    camera.histogram = msg.value;
                //}
                if (!msg.value) msg.value = false;
                if (msg.event == "settings") {
                    var newSettings = msg.value ? msg.value : {};
                    console.log("capture target: ", newSettings.target);
                    if (!camera.target) camera.target = "CARD";
                    if (newSettings.target && newSettings.target != camera.target) camera.set('target', camera.target, null, worker);
                    //if (newSettings.autofocus && newSettings.autofocus != "off") camera.set('autofocus', 'off', null, worker);
                    console.log("PTP: settings updated");
                    if(newSettings.fujifocuspos != null && newSettings.fujifocuspos !== false) {
                        newSettings.focusPos = parseInt(newSettings.fujifocuspos) / FUJI_FOCUS_RESOLUTION;
                    } else {
                        newSettings.focusPos = camera.focusPos;
                    }
                    if (worker.port == camera.primaryPort && (!worker.settings || JSON.stringify(worker.settings) != JSON.stringify(newSettings))) {
                        worker.settings = newSettings;
                        camera.emit(msg.event, msg.value);
                    }
                    if(worker.port == camera.primaryPort) {
                        camera.settings = newSettings;
                    }
                    worker.settings = newSettings;
                } else if (msg.event == "callback") {
                    runCallback(msg.value);
                } else if(worker.port == camera.primaryPort || msg.event == 'connected') {
                    camera.emit(msg.event, msg.value);
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

    exec("mount", function(err, stdout, stderr) {
        if(stdout.indexOf('/dev/mmcblk1p1') !== -1) {
            camera.sdMounted = true;
        }
        camera.emit("media", camera.sdMounted);
    });
} else {
    exec("mount", function(err, stdout, stderr) {
        if(stdout.indexOf('/media') === -1) {
            // keep folder clean, umount just to be extra safe
            exec('[ "$(ls -A /media)" ] && ( umount /media; rm -rf /media/*; echo "done" )', function(err, stdout, stderr) {
                if(stdout) {
                    console.log("cleaned /media folder:", stdout, stderr);
                } else {
                    console.log("/media is empty.", stdout, stderr);
                }
            });
        }
    });
}

function getWorkerIndex(port) {
    for(var i = 0; i < workers.length; i++) {
        if(workers[i].port == port) return i;
    }
    return false;
}
function updateCameraCounts() {
    var count = 0;

    for(var i = 0; i < workers.length; i++) {
        if(workers[i].connected) {
            count++;
        }
    }
    camera.count = count;

    var pIndex = camera.primaryPort ? getWorkerIndex(camera.primaryPort) : false;
    if(pIndex === false || !workers[pIndex] || !workers[pIndex].connected) {
        pIndex = 0;
        for(var i = 0; i < workers.length; i++) {
            if(workers[i].connected) {
                pIndex = i;
                break;
            }
        }
        if(workers[pIndex] && workers[pIndex].port != camera.primaryPort) {
            camera.switchPrimary({
                model: workers[pIndex].model,
                isPrimary: true,
                _port: workers[pIndex].port
            });
        }
    }
    if(workers[pIndex] && workers[pIndex].connected) {
        camera.connected = true;
    } else {
        camera.connected = false;
    }
}

monitor.on('add', function(device) {
    //console.log("device added:", device);
    if (device.SUBSYSTEM == 'usb' && device.GPHOTO2_DRIVER && device.BUSNUM && device.DEVNUM) {
        var port = 'usb:' + device.BUSNUM + ',' + device.DEVNUM;
        var index = getWorkerIndex(port);
        if(index === false) {
            startWorker(port);
        }
    } else if (device.SUBSYSTEM == 'block' && device.DEVTYPE == 'partition' && device.ID_PATH == 'platform-1c11000.mmc') {
        console.log("SD card added:", device.DEVNAME);
        captureIndex = 1;
        camera.sdPresent = true;
        camera.sdDevice = device.DEVNAME;
        if(camera.sdMounted) {
            camera.unmountSd(function(){
                camera.emit("media-insert", "sd");
            });
        } else {
            camera.emit("media-insert", "sd");
        }
    } else if (device.SUBSYSTEM == 'tty' && device.ID_VENDOR == 'Dynamic_Perception_LLC') {
        console.log("NMX connected:", device.DEVNAME);
        camera.nmxConnected = true;
        camera.nmxDevice = device.DEVNAME;
        camera.emit("nmxSerial", "connected");
    }
});

monitor.on('remove', function(device) {
    if (device.SUBSYSTEM == 'usb' && device.GPHOTO2_DRIVER && device.BUSNUM && device.DEVNUM) {
        console.log("on remove", device);
        var port = 'usb:' + device.BUSNUM + ',' + device.DEVNUM;
        var index = getWorkerIndex(port);
        if(index !== false) {
            console.log("telling worker to exit on port", port);
            workers[index].send({
                type: 'command',
                do: 'exit'
            });
        }
    } else if (device.SUBSYSTEM == 'tty' && device.ID_VENDOR == 'Dynamic_Perception_LLC') {
        console.log("NMX disconnected:", device.DEVNAME);
        camera.nmxConnected = false;
        camera.nmxDevice = null;
        camera.emit("nmxSerial", "disconnected");
    } else if (device.SUBSYSTEM == 'block' && device.DEVTYPE == 'partition' && device.ID_PATH == 'platform-1c11000.mmc') {
        console.log("SD card removed:", device.DEVNAME);
        camera.sdPresent = false;
        camera.emit("media-remove", "sd");
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

camera.connectSonyWifi = function() {
    startWorker('SonyWifi');
}

camera.mountSd = function(callback) {
    if (camera.sdPresent) {
        if(camera.sdMounted) return callback && callback(null, camera.sdMounted);
        console.log("mounting SD card");
        //exec("mount -o nonempty " + camera.sdDevice + " /media", function(err) { // this caused FAT32 cards to fail to mount
        exec("mount " + camera.sdDevice + " /media", function(err) {
            if (!err) camera.sdMounted = true; else console.log("error mounting sd card: ", err);
            if (callback) callback(err, camera.sdMounted);
        });
    } else {
        if (callback) callback(true, camera.sdMounted);
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
            if (callback) callback(err, camera.sdMounted);
        });
    } else {
        if (callback) callback(null, camera.sdMounted);
    }
}

function getPrimaryWorker() {
    var index = getWorkerIndex(camera.primaryPort);
    if(workers[index]) return workers[index];
    return false;
}

camera.getPrimaryCameraIndex = function() {
    var index = 0;
    for(var i = 0; i < workers.length; i++) {
        if(workers[i].connected) {
            index++;
            if(workers[i].port == camera.primaryPort) return index;
        }
    }
    return 1;
}

camera.captureInitiated = function() {
    if(!camera.connected) {
        return false;
    }
    var primaryWorker = getPrimaryWorker();
    return primaryWorker.captureInitiated ? true : false;
}

function padNumber(n, width) {
    var s = n.toString();
    while(s.length < width) s = '0' + s;
    return s;
}
var captureIndex = 1;
camera.capture = function(options, callback) {
    if(!camera.connected) {
        return callback && callback("not connected");
    }
    var primaryWorker = getPrimaryWorker();
    primaryWorker.captureInitiated = true;
    if(options && options.mode == 'test') {
        options = {mode:'test'};
        var err = doEachCamera(function(port, isPrimary, worker) {
            if(!isPrimary) return;
            if(worker.model.match(/fuji/i)) options.removeFromCamera = true;
            var capture = {
                type: 'camera',
                do: 'capture',
                options: options,
                id: isPrimary ? getCallbackId(worker.port, 'capture', function(err, res){
                    callback && callback(err, res);
                }) : null
            }
            console.log(capture);
            worker.send(capture);
        });
    } else if(primaryWorker.supports.destination || options) { // time-lapse program or basic capture
        var imagePath;
        var cameraIndex = 0;
        if(!options) options = {thumbnail: true};
        if(options.saveRaw) {
            imagePath = options.saveRaw;
        }
        var functionList = [];
        var err = doEachCamera(function(port, isPrimary, worker) {
            cameraIndex++;
            if(options.saveRaw) {
                options.saveRaw = imagePath + '-cam' + cameraIndex;
            }
            options.cameraIndex = cameraIndex;
            if(worker.model.match(/fuji/i)) options.removeFromCamera = true;
            functionList.push(
                (function(obj, isP, i){
                    return function(cb) {
                        obj.id = getCallbackId(worker.port, 'capture', function(err, res) {
                            if(!res) res = {};
                            console.log("capture callback for camera ", i);
                            res.cameraIndex = i;
                            res.isPrimary = isP;
                            cb && cb(err, res);
                        });
                        worker.send(obj);
                    }
                })({
                    type: 'camera',
                    do: 'capture',
                    options: _.clone(options),
                    id: null
                }, isPrimary, cameraIndex)
            );
        });
        if(!err) {
            async.parallel(functionList, function(err, results){
                if(!err && results && results.length > 0) {
                    var res = results[0]
                    res.cameraCount = results.length;
                    res.cameraResults = results;
                    //console.log("camera.capture results:", res);
                    callback && callback(err, res);
                } else {
                    callback && callback(err, results);
                }
            });
        } else {
            return callback && callback("not connected");
        }
    } else { // capture method, not part of time-lapse program
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
                            var index = 0;
                            var err = doEachCamera(function(port, isPrimary, worker) {
                                if(!isPrimary) return;
                                index++;
                                var saveRaw = folder + '/' + name + padNumber(captureIndex, width) + 'c' + index;
                                if(!options) options = {};
                                options.saveRaw = saveRaw;
                                if(worker.model.match(/fuji/i)) options.removeFromCamera = true;
                                console.log("Saving RAW capture to", options.saveRaw);
                                var capture = {
                                    type: 'camera',
                                    do: 'capture',
                                    options: options,
                                    id: isPrimary ? getCallbackId(worker.port, 'capture', function(err){
                                        setTimeout(camera.unmountSd, 1000);
                                        callback && callback(err);
                                    }) : null
                                }
                                console.log(capture);
                                worker.send(capture);
                            });
                            if(err) {
                                return callback && callback("not connected");
                            }
                        });
                    });
                }
            });
        } else {
            callback && callback("SD card required in VIEW");
        }
    }
}
camera.captureTethered = function(callback) {
    var err = doEachCamera(function(port, isPrimary, worker) {
        worker.send({
            type: 'camera',
            do: 'captureTethered',
            id: isPrimary ? getCallbackId(worker.port, 'captureTethered', callback) : null
        });
    });
    if(err) {
        callback && callback("not connected");
    }
}

camera.getFilesList = function(callback) {
    var worker = getPrimaryWorker();
    if (worker && camera.connected) worker.send({
        type: 'camera',
        do: 'getFilesList',
        id: getCallbackId(worker.port, 'getFilesList', callback)
    }); else callback && callback("not connected");
}

camera.downloadFile = function(filePath, callback) {
    var worker = getPrimaryWorker();
    if (worker && camera.connected) worker.send({
        type: 'camera',
        do: 'downloadFile',
        filePath: filePath,
        thumbnail: false,
        id: getCallbackId(worker.port, 'getFilesList', callback)
    }); else callback && callback("not connected");
}

camera.downloadThumbnail = function(filePath, callback) {
    var worker = getPrimaryWorker();
    if (worker && camera.connected) worker.send({
        type: 'camera',
        do: 'downloadFile',
        filePath: filePath,
        thumbnail: true,
        id: getCallbackId(worker.port, 'getFilesList', callback)
    }); else callback && callback("not connected");
}

camera.liveview = function(callback) {
    camera.lvOn = true;
    var worker = getPrimaryWorker();
    if(!camera.supports.liveview) {
        return callback && callback("not supported");
    }
    if (worker && camera.connected) worker.send({
        type: 'camera',
        do: 'liveview',
        id: getCallbackId(worker.port, 'liveview', callback)
    }); else callback && callback("not connected");
}
var restartPreview = null; // used for temporarily disabling liveview when changing settings
camera.preview = function(callback) {
    if(restartPreview) return callback && callback("blocked");
    camera.lvOn = true;
    var worker = getPrimaryWorker();
    if(!camera.supports.liveview) {
        return callback && callback("not supported");
    }
    if (worker && camera.connected) worker.send({
        type: 'camera',
        do: 'preview',
        id: getCallbackId(worker.port, 'preview', callback)
    }); else callback && callback("not connected");
}
camera.previewFull = function(callback) {
    if(restartPreview) return callback && callback("blocked");
    camera.lvOn = true;
    var worker = getPrimaryWorker();
    if(!camera.supports.liveview) {
        return callback && callback("not supported");
    }
    if (worker && camera.connected) worker.send({
        type: 'camera',
        do: 'preview',
        options: {
            fullSize: true
        },
        id: getCallbackId(worker.port, 'preview', callback)
    }); else callback && callback("not connected");
}
camera.lvTimerReset = function(callback) {
    var worker = getPrimaryWorker();
    if (worker && camera.connected) worker.send({
        type: 'camera',
        id: getCallbackId(worker.port, 'lvTimerReset', callback),
        do: 'lvTimerReset'
    }); else callback && callback("not connected");
}
camera.lvOff = function(callback, keepCrop) {
    var worker = getPrimaryWorker();
    camera.lvOn = false;
    if (worker && camera.connected) worker.send({
        type: 'camera',
        id: getCallbackId(worker.port, 'lvOff', callback),
        do: 'lvOff',
        keepCrop: keepCrop
    }); else callback && callback("not connected");
}
camera.zoom = function(xTargetPercent, yTargetPercent, callback) {
    var cb = function(err, data){
        if(!data) data = {};
        data.zoomed = camera.zoomed;
        callback && callback(err, data);
    }
    var worker = getPrimaryWorker();
    var data = {
        reset: true
    };
    if (worker && camera.connected && xTargetPercent != null && yTargetPercent != null) {
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
        id: getCallbackId(worker.port, 'zoom', cb),
        data: data
    }); else callback && callback("not connected");
}



function focusCanon(step, repeat, callback) {
    var worker = getPrimaryWorker();
    if (!repeat) repeat = 1;
    var param;
    if (!step) return callback && callback(null, camera.focusPos);
    if (step < 0) {
        param = "Near 1";
        if (step < -1) param = "Near 2";
    } else {
        param = "Far 1";
        if (step > 1) param = "Far 2";
    }
    var errCount = 0;
    var errorLimit = 10;

    if(Math.abs(step) == 1) {
        camera.focusPos += (step * repeat);
    }

    var doFocus = function() {
        camera.lvTimerReset();
        if(worker.connected) {
                worker.send({
                type: 'camera',
                setDirect: 'manualfocusdrive',
                value: param,
                id: getCallbackId(worker.port, 'focusCanon', function(err) {
                    if(err) {
                        errCount++;
                        if(errCount > errorLimit) {
                            console.log("focus move error", err);
                            return callback && callback(err);
                        }
                    } else {
                        errCount = 0;
                        repeat--;
                    }
                    if (repeat > 0) {
                        var pause = repeat % 5 == 0 ? 500 : 15;
                        console.log(pause);
                        setTimeout(doFocus, pause);
                    } else {
                        if (callback) callback(null, camera.focusPos);
                    }
                })
            });
        } else {
            if (callback) callback("not connected");
        }
    }
    doFocus();
}
function focusOlympus(step, repeat, callback) {
    var worker = getPrimaryWorker();
    if (!repeat) repeat = 1;
    var param;
    if (!step) return callback && callback(null, camera.focusPos);
    if (step < 0) {
        param = "Near 2";
        if (step < -1) param = "Near 3";
    } else {
        param = "Far 2";
        if (step > 1) param = "Far 3";
    }
    var errCount = 0;
    var errorLimit = 10;

    if(Math.abs(step) == 1) {
        camera.focusPos += (step * repeat);
    }

    var doFocus = function() {
        if(worker.connected) {
                worker.send({
                type: 'camera',
                setDirect: 'manualfocusdrive',
                value: param,
                id: getCallbackId(worker.port, 'focusOlympus', function(err) {
                    if(err) {
                        errCount++;
                        if(errCount > errorLimit) {
                            console.log("focus move error", err);
                            return callback && callback(err);
                        }
                    } else {
                        errCount = 0;
                        repeat--;
                    }
                    if (repeat > 0) {
                        var pause = repeat % 5 == 0 ? 50 : 5;
                        console.log(pause);
                        setTimeout(doFocus, pause);
                    } else {
                        if (callback) callback(null, camera.focusPos);
                    }
                })
            });
        } else {
            if (callback) callback("not connected");
        }
    }
    doFocus();
}
function focusSony(step, repeat, callback) {
    var worker = getPrimaryWorker();
    if (!repeat) repeat = 1;
    var param;
    if (!step) return callback && callback(null, camera.focusPos);
    if (step < 0) {
        param = '-1';
        if (step < -1) param = '-5';
    } else {
        param = '1';
        if (step > 1) param = '5';
    }

    if(Math.abs(step) == 1) {
        camera.focusPos += (step * repeat);
    }

    var errCount = 0;
    var errorLimit = 10;

    var doFocus = function() {
        camera.lvTimerReset();
        if(worker.connected) {
                worker.send({
                type: 'camera',
                setDirect: 'manualfocus',
                value: param,
                id: getCallbackId(worker.port, 'focusSony', function(err) {
                    if(err) {
                        errCount++;
                        if(errCount > errorLimit) {
                            console.log("focus move error", err);
                            return callback && callback(err);
                        }
                    } else {
                        errCount = 0;
                        repeat--;
                    }
                    if (repeat > 0) {
                        var pause = repeat % 5 == 0 ? 200 : 100;
                        console.log(pause);
                        setTimeout(doFocus, pause);
                    } else {
                        if (callback) callback(null, camera.focusPos);
                    }
                })
            });
        } else {
            if (callback) callback("not connected");
        }
    }
    doFocus();
}
function focusNikon(step, repeat, callback) {
    var worker = getPrimaryWorker();
    if (!repeat) repeat = 1;
    var param, delay = 200;
    if (!step) return callback && callback(null, camera.focusPos);
    if (step < 0) {
        param = -20.5;
        if (step < -1) { 
            param = -200.5;
            delay = 500;
        }
    } else {
        param = 20.5;
        if (step > 1) {
            param = 200.5;
            delay = 500;
        }
    }

    if(Math.abs(step) == 1) {
        camera.focusPos += (step * repeat);
    }

    var errCount = 0;
    var errorLimit = 10;

    var doFocus = function() {
        camera.lvTimerReset();        
        if(worker.connected) {
            worker.send({
                type: 'camera',
                setDirect: 'manualfocusdrive',
                value: param,
                id: getCallbackId(worker.port, 'focusNikon', function(err) {
                    if(err) {
                        errCount++;
                        if(errCount > errorLimit) return callback && callback(err);
                    } else {
                        errCount = 0;
                        repeat--;
                    }
                    if (repeat > 0) {
                        setTimeout(doFocus, delay);
                    } else {
                        if (callback) callback(null, camera.focusPos);
                    }
                })
            });
        } else {
            if (callback) callback("not connected");
        }
    }
    doFocus();
}
var fujiFocusPosCache = null;
function focusFuji(step, repeat, callback) {
    var worker = getPrimaryWorker();
    if (!repeat) repeat = 1;
    var attempts = 0;
    var relativeMove = (parseInt(step) * FUJI_FOCUS_RESOLUTION * parseInt(repeat));

    var doFocus = function(target, cb) {
        camera.getSettings(function(err, settings){
            var currentPos = parseInt(camera.settings.fujifocuspos);
            if(settings) {
                currentPos = parseInt(settings.fujifocuspos);
                camera.focusPos = currentPos / FUJI_FOCUS_RESOLUTION;
            }
            if(target && Math.abs(parseInt(currentPos) - parseInt(target)) < 2) {
                fujiFocusPosCache = parseInt(target);
                console.log("PTP: focusFuji: target reached:", currentPos, ", targetPos", target);
                if (callback) callback(null, camera.focusPos);
            } else {
                var targetPos = target || parseInt(currentPos) + relativeMove;
                if(targetPos == 0) targetPos = 2;
                console.log("PTP: focusFuji: currentPos", currentPos, ", targetPos", targetPos);
                if(worker.connected) {
                    try {
                        worker.send({
                            type: 'camera',
                            setDirect: 'd171',
                            value: targetPos.toString(),
                            id: getCallbackId(worker.port, 'fujifocuspos', function(err) {
                                attempts++;
                                if(attempts < 5) {
                                    doFocus(targetPos, cb);
                                } else {
                                    console.log("PTP: focusFuji: error: target failed:", currentPos, ", targetPos", targetPos);
                                    if (cb) cb("failed to reach focus target");
                                }
                            })
                        });
                    } catch(e) {
                        if (cb) cb("unknown error");
                    }
                } else {
                    if (cb) cb("not connected");
                }
            }
        }, false);
    }
    var startFocus = function(cb) {
        if(camera.settings.fujifocus == 'enabled') {
            if(fujiFocusPosCache != null) {
                doFocus(parseInt(fujiFocusPosCache) + relativeMove, cb);
            } else {
                doFocus(null, cb);
            }
        } else {
            fujiFocusPosCache = null;
            worker.send({
                type: 'camera',
                set: 'fujifocus',
                value: 'enabled',
                id: getCallbackId(worker.port, 'setFocusMode', function(err) {
                    camera.getSettings(function(err, settings){
                        if(settings.fujifocus == 'enabled') {
                            attempts = 0;
                            doFocus(null, cb);
                        } else {
                            attempts++;
                            if(attempts < 5) {
                                startFocus(cb);
                            } else {
                                console.log("PTP: focusFuji: error: failed to switch focus control");
                                if (cb) cb("failed to switch focus control");
                            }
                        }
                    });
                })
            });
        }
    }
    if(camera.lvOn) {
        if(restartPreview) {
            clearTimeout(restartPreview);
            restartPreview = null;
        }
        console.log("PTP: turning off LV for focus mode");
        return camera.lvOff(function(){
            setTimeout(function(){
                startFocus(function(err){
                    restartPreview = setTimeout(function(){
                        restartPreview = null;
                        console.log("PTP: resuming LV after focus move");
                        camera.preview();
                    }, 100);
                    callback && callback(err);
                });
            }, 500);
        }, true);
    } else {
        startFocus(callback);
    }
}
camera.focus = function(step, repeat, callback) {
    var worker = getPrimaryWorker();
    if (worker && camera.connected) {
        if(worker.model.match(/olympus/i)) {
            console.log("focus: olympus");
            focusOlympus(step, repeat, callback);
        } else if(camera.settings.focusdrive == 'canon') {
            console.log("focus: canon");
            focusCanon(step, repeat, callback);
        } else if(camera.settings.focusdrive == 'nikon') {
            console.log("focus: nikon");
            focusNikon(step, repeat, callback);
        } else if(worker.model.match(/fuji/i)) {
            console.log("focus: fuji");
            focusFuji(step, repeat, callback);
        } else if(camera.settings.sonyfocus == 'enabled') {
            console.log("focus: sony");
            focusSony(step, repeat, callback);
        } else {
            console.log("focus: not supported");
            callback && callback("not supported");   
        }
    } else callback && callback("not connected");
}

function doEachCamera(callback) {
    if(camera.connected) {
        var worker = getPrimaryWorker();
        if(!worker) return true; // error
        callback(camera.primaryPort, true, worker);
        if(camera.synchronized) {
            for(var i = 0; i < workers.length; i++) {
                if(workers[i].connected && workers[i].port != camera.primaryPort) {
                    callback(workers[i].port, false, workers[i]);
                }
            }
        }
        return false;
    } else {
        return true; // error
    }
}

function getSendMulti() {
    if(camera.connected) {
        if(camera.synchronized) {
            var worker = getPrimaryWorker();
            if(!worker) return false;
            return function(obj) {
                worker.send(obj);
                for(var i = 0; i < workers.length; i++) {
                    obj.id = null; // only run callback for primary camera
                    if(workers[i].connected && workers[i].port != camera.primaryPort) {
                        workers[i].send(obj);
                    }
                }
            };
        } else {
            var worker = getPrimaryWorker();
            return worker ? worker.send : false;
        }
    } else {
        return false;
    }
}

camera.set = function(item, value, callback, _worker) {
    if(camera.lvOn === true && camera.model && camera.model.match(/fuji/i)) {
        if(restartPreview) {
            clearTimeout(restartPreview);
            restartPreview = null;
        }
        console.log("PTP: turning off LV for setting " + item);
        return camera.lvOff(function(){
            camera.set(item, value, function(err){
                restartPreview = setTimeout(function(){
                    restartPreview = null;
                    console.log("PTP: resuming LV");
                    camera.preview();
                }, 1000);
                callback && callback(err);
            }, _worker);
        }, true);
    }
    var cmd = {
        type: 'camera',
        set: item,
        value: value,
    };
    if(_worker && _worker.send) {
        cmd.id = getCallbackId(_worker.port, 'set', callback);
        _worker.send(cmd);
    } else if(doEachCamera(function(port, isPrimary, worker) {
        cmd.id = isPrimary ? getCallbackId(worker.port, 'set', callback) : null;
        worker.send(cmd);
    })){
        callback && callback("not connected");
    }
}
camera.getSettings = function(callback, useCache) {
    console.log("retreiving settings from camera");
    //console.trace();
    var worker = getPrimaryWorker();
    if (worker && camera.connected) worker.send({
        type: 'camera',
        get: 'settings',
        time: new Date() / 1000,
        useCache: useCache,
        id: getCallbackId(worker.port, 'getSettings', callback)
    }); else callback && callback("not connected");
}
camera.saveThumbnails = function(path, callback) {
    if (camera.connected) {
        doEachCamera(function(port, isPrimary, worker) { 
            worker.send({
                'type': 'setup',
                'set': 'thumbnailPath',
                'value': path
            });
        });
        callback && callback(null);
    } else {
        callback && callback("not connected");
    }
}

camera.completeWrites = function(callback) {
    var functionList = [];
    var err = doEachCamera(function(port, isPrimary, worker) {
        functionList.push(
            (function(obj){
                return function(cb) {
                    obj.id = getCallbackId(worker.port, 'completeWrites', function(err, res) {
                        cb && cb(err, res);
                    });
                    worker.send(obj);
                }
            })({
                type: 'camera',
                do: 'waitComplete',
                id: null
            })
        );
    });
    if(!err) {
        async.parallel(functionList, function(err, results){
            console.log("camera file writes complete:", results);
            callback && callback(err, results);
        });
    } else {
        return callback && callback("not connected");
    }
}

camera.saveToCameraCard = function(bool, callback) {
    if (bool === null) {
        return camera.target == "CARD";
    } else {
        var target = bool ? "CARD" : "RAM";
        if (target != camera.target) {
            camera.target = target;
            console.log("camera.ptp: setting camera target to ", target);
            if(camera.settings.recordingmedia) camera.set('recordingmedia', camera.target);
            camera.set('target', camera.target, callback);
            return camera.target;
        }
    }
}

var supportTestRunning = false;
camera.runSupportTest = function(cb) {
    if(supportTestRunning) return cb && cb("support test is already running");
    supportTestRunning = true;
    camera.disableWorker(function(err) {
        if(err) {
            camera.enableWorker();
            cb && cb(err);
        } else {
            exec("/usr/local/bin/gphoto2 --list-all-config > /tmp/cameraLog.txt 2>&1; /bin/echo \"======================\" >> /tmp/cameraLog.txt;  /usr/local/bin/gphoto2 --capture-image --keep --debug >> /tmp/cameraLog.txt 2>&1; /bin/echo \"======================\" >> /tmp/cameraLog.txt; cd /tmp; /usr/local/bin/gphoto2 --get-thumbnail=1 --force-overwrite --debug >> /tmp/cameraLog.txt 2>&1; /bin/bzip2 /tmp/cameraLog.txt;  mv /tmp/cameraLog.txt.bz2 /home/view/logsForUpload/log-CAMERA-`date +\"%Y%m%d-%H%M%S\"`.txt.bz2;", function(err) {
                console.log("Camera report test complete. Err:", err);
                camera.enableWorker();
                supportTestRunning = false;
                cb && cb(err);
            });
        }
    });
}

module.exports = camera;
