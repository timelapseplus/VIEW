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

var client;
function connect() {
    client = net.connect('/tmp/intervalometer.sock', function() {
      console.log('connected to server!');
      client.ready = true;
    });
    client.on('data', function(chunk) {
      var data;
      try {
        chunk = chunk.toString('utf8');
        var pieces = chunk.split('\0');
        for(var i = 0; i < pieces.length; i++) {
            pieces[i] = pieces[i].trim();
            if(!pieces[i]) continue;
            data = JSON.parse(pieces[i]);
            console.log("CORE:", data.type, "event");
            if(data.type == 'callback') {
                runCallback(data.data);
            } else if(data.type == 'watchdog') {
                var pid = parseInt(data.data);
                watchdog.watch(pid);
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
                    core.getSettings();
                } else if(data.type == 'camera.exiting') {
                    core.cameraConnected = data.data.connected;
                    core.cameraModel = data.data.model;
                    core.cameraCount = data.data.count;
                    core.cameraSupports = data.data.supports;
                } else if(data.type == 'media.present') {
                    core.sdMounted = data.data;
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
        }
      } catch(e) {
        console.log("Error parsing data:", data, e);
      }
    });
    client.on('end', function() {
      client.ready = false;
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
connect();

function call(method, args, callback) {
    if(!client.ready) return;
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
core.mountSd = function(callback) {
    call('camera.ptp.mountSd', {}, function(err, res){
        core.sdMounted = res;
        callback(err, res)
    });
};
core.unmountSd = function(callback) {
    call('camera.ptp.unmountSd', {}, callback);
};

core.moveNMX = function(motor, steps, callback) {
    call('nmx.move', {motor:motor, steps:steps}, callback);
};

core.watchdog = function(callback) {
    call('watchdog', {pid:process.pid}, callback);
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

setInterval(core.watchdog, 5000); // this will have the server kill this process if it ever gets stuck

module.exports = core;