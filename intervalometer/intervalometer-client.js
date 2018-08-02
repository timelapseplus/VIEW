var EventEmitter = require("events").EventEmitter;
require('rootpath')();
var mcu = require('hardware/mcu.js');
var power = require('hardware/power.js');
var watchdog = require('system/watchdog.js');
var _ = require('underscore');
var net = require('net');

var core = new EventEmitter();


var cbStore = {};
var cbIndex = 0;

console.log(">>>>>>>>>>>>>>>>>>>>> starting intervalometer client >>>>>>>>>>>>>>>>>>>");

function getCallbackId(callerName, cb) {
    if (!cb) return 0;
    cbIndex++;
    if (cbIndex > 300) cbIndex = 1;
    cbStore[cbIndex.toString()] = {callback: cb, name: callerName};
    return cbIndex;
}

function runCallback(cbData) {    
    if (cbData && cbData.id && cbStore[cbData.id.toString()]) {
        var cb = cbStore[cbData.id.toString()];
        console.log("running callback for ", cb.name);
        cb && cb.callback && cb.callback(cbData.err, cbData.data);
        delete cbStore[cbData.id.toString()];
    }
}

function errorCallbacks(err, port) {
    console.log("running remaining callbacks:", JSON.stringify(cbStore));
    for (var i in cbStore) {
        runCallback({
            id: i,
            err: err,
            data: null
        });
    }
}

// buffered data
core.cameraSettings = {};
core.cameraConnected = false;
core.cameraModel = "";
core.cameraCount = 0;
core.cameraSupports = {};
core.intervalometerStatus = {};
core.histogram = [];
core.motionStatus = {};
core.currentProgram = {};
var restartProgram = null;

function checkRestart() {
    console.log("SERVER CRASHED: checking time-lapse if restart needed");
    if(core.intervalometerStatus.running && core.currentProgram.scheduled) {
        restartProgram = _.extendOwn({}, core.currentProgram);
        restartProgram._timeOffsetSeconds = core.intervalometerStatus.timeOffsetSeconds;
        restartProgram._exposureReferenceEv = core.intervalometerStatus.exposureReferenceEv;
    }
}

watchdog.onKill(function(pid){
    if(pid == core.processId) {
        checkRestart();
    }
});

var dataBuf = new Buffer(0);
var client;
function connect() {
    client = net.connect('/tmp/intervalometer.sock', function() {
      console.log('connected to server!');
      client.ready = true;
      if(restartProgram) {
        core.startIntervalometer(restartProgram, null, restartProgram._timeOffsetSeconds, restartProgram._exposureReferenceEv);
        restartProgram = null;
      }
    });
    client.on('data', function(rawChunk) {
      var data;
      try {
        if(!rawChunk.length) return;
        dataBuf = Buffer.concat([dataBuf, rawChunk]);
        if(rawChunk[rawChunk.length - 1] != 0) {
            return;
        }
        var chunk = dataBuf.toString('utf8');
        dataBuf = new Buffer(0);
        var pieces = chunk.split('\0');
        for(var i = 0; i < pieces.length; i++) {
            pieces[i] = pieces[i].trim();
            if(!pieces[i]) continue;
            data = JSON.parse(pieces[i]);
            if(data.type == 'callback') {
                runCallback(data.data);
            } else if(data.type == 'watchdog.set') {
                var pid = parseInt(data.data);
                watchdog.watch(pid, 60000);
            } else if(data.type == 'watchdog.disable') {
                var pid = parseInt(data.data);
                watchdog.disable(pid);
            } else {
                if(data.type == 'camera.photo') {
                    if(data.data.base64) {
                        data.data.jpeg = new Buffer(data.data.base64, 'base64');
                    }
                    core.photo = data.data;
                    data.data = null;
                } else if(data.type == 'camera.settings') {
                    core.cameraSettings = data.data;
                } else if(data.type == 'camera.histogram') {
                    core.histogram = data.data;
                } else if(data.type == 'camera.connected') {
                    core.cameraConnected = data.data.connected;
                    core.cameraModel = data.data.model;
                    core.cameraCount = data.data.count;
                    core.cameraSupports = data.data.supports;
                    console.log("CORE: camera count: ", core.cameraCount);
                    core.cameraSupports = data.data.supports;
                    core.getSettings();
                } else if(data.type == 'camera.exiting') {
                    core.cameraConnected = data.data.connected;
                    core.cameraModel = data.data.model;
                    core.cameraCount = data.data.count;
                    core.cameraSupports = data.data.supports;
                    console.log("CORE: camera count: ", core.cameraCount);
                    core.cameraSupports = data.data.supports;
                } else if(data.type == 'motion.status') {
                    core.motionStatus = data.data;
                } else if(data.type == 'media.present') {
                    core.sdMounted = data.data;
                    core.sdPresent = true;
                } else if(data.type == 'media.insert') {
                    core.sdPresent = true;
                } else if(data.type == 'media.remove') {
                    core.sdPresent = false;
                } else if(data.type == 'intervalometer.status') {
                    core.intervalometerStatus = data.data;
                    if(core.intervalometerStatus && core.intervalometerStatus.running == false) {
                        power.performance('low');
                    }
                } else if(data.type == 'intervalometer.currentProgram') {
                    console.log("CLIENT: updating currentProgram from server")
                    core.currentProgram = _.extendOwn(core.currentProgram, data.data);
                } else if(data.type == 'process.pid') {
                    core.processId = data.data;
                }
                console.log("CORE:", data.type, "event");
                core.emit(data.type, data.data);
            }
        }
      } catch(e) {
        console.log("Error parsing data:", data, e);
      }
    });
    client.on('end', function() {
      client.ready = false;
      checkRestart();
      console.log('disconnected from server');
      setTimeout(connect, 2000);
    });
    client.on('error', function(err) {
        if(err && err.code && (err.code == 'ECONNREFUSED' || err.code == 'ENOENT')) {
            console.log("Error: server not ready");
            setTimeout(connect, 1000);
        } else {
            console.log("error: ", err);
        }
        client.ready = false;
        client.end();
    });
}
setTimeout(connect, 5000);

function call(method, args, callback) {
    if(!client || !client.ready) {
        (function(m, a, c){
            setTimeout(function(){
                call(m, a, c);
            }, 1000);
        })(method, args, callback);
        return;
    }
    var cbId = getCallbackId(method, callback);
    var payload = JSON.stringify({
        type: method,
        args: args,
        id: cbId
    });
    if(client.ready) client.write(payload+'\0');
}

core.connectSonyWifi = function(callback) {
    call('camera.ptp.connectSonyWifi', {}, callback);
};
core.lvOff = function(callback) {
    call('camera.ptp.lvOff', {}, callback);
};
core.zoom = function(xPercent, yPercent, callback) {
    call('camera.ptp.zoom', {x:xPercent,y:yPercent}, function(err, data) {
        core.cameraZoomed = data.zoomed;
        callback(err, data);      
    });
};
core.focus = function(step, repeat, callback) {
    call('camera.ptp.focus', {step:step, repeat:repeat}, callback);
};
core.setEv = function(ev, options, callback) {
    call('camera.setEv', {ev:ev, options:options}, callback);
};
core.preview = function(callback) {
    call('camera.ptp.preview', {}, callback);
};
core.previewFull = function(callback) {
    call('camera.ptp.previewFull', {}, callback);
};
core.getSettings = function(callback) {
    call('camera.ptp.getSettings', {}, callback);
};
core.cameraList = function(callback) {
    call('camera.ptp.cameraList', {}, callback);
};
core.switchPrimary = function(cameraObject, callback) {
    call('camera.ptp.switchPrimary', {cameraObject:cameraObject}, callback);
};
core.capture = function(options, callback) {
    call('camera.ptp.capture', {options:options}, callback);
};
core.captureTest = function(callback) {
    call('camera.ptp.capture-test', {}, callback);
};
core.runSupportTest = function(callback) {
    call('camera.ptp.runSupportTest', {}, callback);
};
core.set = function(key, val, callback) {
    call('camera.ptp.set', {key:key, val:val}, callback);
};
core.mountSd = function(callback) {
    call('camera.ptp.mountSd', {}, function(err, res){
        core.sdMounted = res;
        callback(err, res)
    });
};
core.unmountSd = function(callback) {
    call('camera.ptp.unmountSd', {}, callback);
};

core.moveMotion = function(driver, motor, steps, callback) {
    call('motion.move', {driver:driver, motor:motor, steps:steps}, callback);
};

core.zeroMotion = function(driver, motor, callback) {
    call('motion.zero', {driver:driver, motor:motor}, callback);
};

core.motionSetBacklash = function(driver, motor, backlash, callback) {
    call('motion.setBacklash', {driver:driver, motor:motor, backlash:backlash}, callback);
};

core.motionCalibrateBacklash = function(driver, motor, callback) {
    call('motion.calibrateBacklash', {driver:driver, motor:motor}, callback);
};

core.motionCancelCalibration = function(driver, motor, callback) {
    call('motion.cancelCalibration', {driver:driver, motor:motor}, callback);
};

core.setMotionPosition = function(driver, motor, position, callback) {
    call('motion.setPosition', {driver:driver, motor:motor, position:position}, callback);
};

core.motionStatusUpdate = function(callback) {
    call('motion.status', {}, callback);
};

core.moveMotionJoystick = function(driver, motor, speed, callback) {
    call('motion.joystick', {driver:driver, motor:motor, speed:speed}, callback);
};

core.setNMXMotor = function(motorNumber, status, callback) {
    call('motion.setNMXMotor', {motor:motorNumber, status:status}, callback);
};

core.getCurrentTimelapseFrames = function(cameraIndex, callback) {
    call('db.currentTimelapseFrames', {cameraIndex:cameraIndex}, callback);
};

var wdtInterval = null;
var wdtStartTimer = null;
core.watchdogEnable = function(callback) {
    wdtStartTimer = setTimeout(function(){
        wdtStartTimer = null;
        if(!wdtInterval) {
            wdtInterval = setInterval(core.watchdogEnable, 5000); // this will have the server kill this process if it ever gets stuck
        }
        call('watchdog.set', {pid:process.pid}, callback);
    }, 10000); // wait 10 seconds before starting initially
};

core.watchdogDisable = function(callback) {
    if(wdtInterval) {
        clearInterval(wdtInterval);
        wdtInterval = null;
    }
    if(wdtStartTimer) {
        clearTimeout(wdtStartTimer);
        wdtStartTimer = null;
    }
    call('watchdog.disable', {pid:process.pid}, function(err){
        callback && callback(err);
    });
};

core.resetBt = function(callback) {
    call('bt.reset', {}, callback);
};

defaultProgram = {
    rampMode: "fixed",
    lrtDirection: "auto",
    intervalMode: "fixed",
    rampAlgorithm: "lum",
    highlightProtection: true,
    interval: 5,
    dayInterval: 5,
    nightInterval: 35,
    frames: 300,
    destination: 'camera',
    nightCompensation: -1,
    isoMax: -6,
    isoMin:  0,
    rampParameters:  'S+I',
    apertureMax: -2,
    apertureMin:  -4,
    manualAperture: -5,
    hdrCount: 0,
    hdrStops: 1,
    exposurePlans: [],
    trackingTarget: 'moon',    
    keyframes: [{
        focus: 0,
        ev: "not set",
        motor: {}
    }]
};

core.intervalometerStatus = {
    running: false,
    frames: 0,
    framesRemaining: 0,
    rampRate: 0,
    intervalMs: 0,
    message: "",
    rampEv: null,
    autoSettings: {
        paddingTimeMs: 5000
    }
}

core.moveTracking = function(axis, degrees, callback) {
    call('intervalometer.moveTracking', {axis:axis, degrees:degrees}, callback);
}

core.moveFocus = function(steps, callback) {
    call('intervalometer.moveFocus', {steps:steps}, callback);
}

core.updateProgram = function(updates, callback) {
    call('intervalometer.updateProgram', {updates:updates}, callback);
    for(key in updates) {
        if(updates.hasOwnProperty(key)) {
            core.currentProgram[key] = updates[key];
        }
    }
}

core.dynamicChange = function(parameter, newValue, frames, callback) {
    call('intervalometer.dynamicChange', {parameter:parameter, newValue:newValue, frames:frames}, callback);
}

core.loadProgram = function(program, callback) {
    if(!program.frames) program.frames = Infinity; // Infinity comes back as null from the DB
    if(program.keyframes) { // arrays come back as object in the VIEW db
        var kfs = [];
        for(var key in program.keyframes) {
            if(program.keyframes.hasOwnProperty(key)) {
                kfs.push(program.keyframes[key]);
            }
        }
        if(kfs.length > 0) program.keyframes = kfs;
    }
    if(program.exposurePlans) { // arrays come back as object in the VIEW db
        var plans = [];
        for(var key in program.exposurePlans) {
            if(program.exposurePlans.hasOwnProperty(key)) {
                plans.push(program.exposurePlans[key]);
            }
        }
        if(plans.length > 0) program.exposurePlans = plans;
    }

    core.currentProgram = _.extendOwn(defaultProgram, core.currentProgram, program);
    callback && callback();
}
core.loadProgram(defaultProgram);


core.stopIntervalometer = function(callback) {
    call('intervalometer.cancel', {}, callback);
}
core.startIntervalometer = function(program, date, timeOffsetSeconds, exposureReferenceEv, callback) {
    if(typeof date == 'function') {
        callback = date;
        date = null;
        timeOffsetSeconds = null;
        exposureReferenceEv = null;
    }
    power.performance('high');
    core.addGpsData(mcu.validCoordinates());
    call('intervalometer.run', {program:program, date:date, timeOffsetSeconds:timeOffsetSeconds, exposureReferenceEv:exposureReferenceEv}, callback);
}
core.addGpsData = function(gpsData, callback) {
    call('gps', {gpsData:gpsData}, callback);
}

core.getFilesList = function(callback) {
    call('camera.ptp.getFilesList', {}, callback);
}

core.downloadThumbnail = function(filePath, callback) {
    call('camera.ptp.downloadThumbnail', {filePath: filePath}, callback);
}

core.downloadFile = function(filePath, callback) {
    call('camera.ptp.downloadFile', {filePath: filePath}, callback);
}


mcu.on('gps', function(status){
    if(status == 2) {
        core.addGpsData(mcu.gps);
    }
});

module.exports = core;