var EventEmitter = require("events").EventEmitter;
require('rootpath')();
var mcu = require('hardware/mcu.js');
var power = require('hardware/power.js');
var _ = require('underscore');
var net = require('net');

var core = new EventEmitter();


var cbStore = {};
var cbIndex = 0;

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


var client = net.connect('/tmp/intervalometer.sock', function() {
  console.log('connected to server!');
  client.write('world!\r\n');
});
client.on('data', function(data) {
  try {
    data = JSON.parse(data.toString());
    if(data.id) {
        runCallback(data);
    } else {
        if(data.type == 'camera.photo') {
            core.photo = data.data;
            data.data = null;
        } else if(data.type == 'camera.settings') {
            core.cameraSettings = data.data;
        } else if(data.type == 'camera.connected') {
            core.cameraConnected = data.data.connected;
            core.cameraModel = data.data.model;
            core.cameraCount = data.data.count;
            core.cameraSupports = data.data.supports;
        } else if(data.type == 'camera.exiting') {
            core.cameraConnected = data.data.connected;
            core.cameraModel = data.data.model;
            core.cameraCount = data.data.count;
            core.cameraSupports = data.data.supports;
        } else if(data.type == 'media.present') {
            core.sdPresent = true;
        } else if(data.type == 'media.insert') {
            core.sdPresent = true;
        } else if(data.type == 'media.remove') {
            core.sdPresent = false;
        } else if(data.type == 'intervalometer.status') {
            core.intervalometerStatus = data.data;
            if(core.intervalometerStatus.running == false) {
                power.performance('low');
            }
        }
        core.emit(data.type, data.data);
    }
  } catch(e) {
    console.log("Error parsing data:", data, e);
  }
  client.end();
});
client.on('end', function() {
  console.log('disconnected from server');
});
client.on('error', function(err) {
    if(err && err.code && (err.code == 'ECONNREFUSED' || err.code == 'ENOENT')) {
        console.log("Error: server not ready");
    } else {
        console.log("error: ", err);
    }
});

function call(method, args, callback) {
    var cbId = getCallbackId(method, callback);
    var payload = JSON.stringify({
        type: method,
        args: args,
        id: cbId
    });
    client.send(payload);
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
core.runSupportTest = function(callback) {
    call('camera.ptp.runSupportTest', {}, callback);
};
core.set = function(key, val, callback) {
    call('camera.ptp.set', {key:key, val:val}, callback);
};


defaultProgram = {
    rampMode: "fixed",
    intervalMode: "fixed",
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

core.loadProgram = function(program, callback) {
    if(!program.frames) program.frames = Infinity; // Infinity comes back as null from the DB
    core.currentProgram = _.extendOwn(defaultProgram, core.currentProgram, program);
    callback && callback();
}
core.loadProgram(defaultProgram);

core.stopIntervalometer = function(callback) {
    call('intervalometer.cancel', {}, callback);
}
core.startIntervalometer = function(program, callback) {
    power.performance('high');
    core.addGpsData(mcu.lastGpsFix);
    call('intervalometer.run', {program:program}, callback);
}
core.addGpsData = function(gpsData, callback) {
    call('gps', {gpsData:gpsData}, callback);
}

mcu.on('gps', function(status){
    if(status == 2) {
        core.addGpsData(mcu.lastGpsFix);
    }
});

module.exports = core;