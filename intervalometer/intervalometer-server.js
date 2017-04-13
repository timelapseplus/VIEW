

/*  Intervalometer API

message                  args                     response
-------------------------------------------------------------------------
'load'                 program (obj)              validationResult (obj)
'start'                ---                        status (obj)
'pause'                ---                        status (obj)
'cancel'               ---                        status (obj)

'motion-step'          axis (int), steps (int)    motionStatus (obj)
'motion-move'          axis (int), speed (float)  motionStatus (obj)
'motion-stop'          axis (int)                 motionStatus (obj)
'motion-info'          ---                        motionStatus (obj)

'camera-update'        ---                        cameraStatus (obj)
'camera-set'           param (str), val (str)     cameraStatus (obj)
'camera-set-ev'        ev (float)                 cameraStatus (obj)
'camera-get'           ---                        cameraStatus (obj)
'camera-set-primary'   cameraIndex (int)          cameraStatus (obj)
'camera-capture'       options (obj)              captureResult (obj)
'camera-liveview'      enable (bool)              camera_status (obj)


event                  payload                    
--------------------------------------------------
'error'                message (str)              
'status'               intervalometerStatus (obj)
'motion-status'        motionStatus (obj)
'camera-status'        cameraStatus (obj)
'jpeg-capture'         jpegImage (buf)
'jpeg-liveview'        jpegImage (buf)



*/

var EventEmitter = require("events").EventEmitter;
var exec = require('child_process').exec;
require('rootpath')();
var camera = require('camera/camera.js');
var db = require('system/db.js');
var nmx = require('drivers/nmx.js');
var noble = require('noble');
var image = require('camera/image/image.js');
var exp = require('intervalometer/exposure.js');
var intervalometer = require('intervalometer/intervalometer.js');
var interpolate = require('intervalometer/interpolate.js');
var fs = require('fs');
var async = require('async');
var TLROOT = "/root/time-lapse";
var Button = require('gpio-button');
var gpio = require('linux-gpio');
var _ = require('underscore');
var net = require('net');

var clientCounter = 0;
var clients = [];

var server = net.createServer(function(c) {
  // 'connection' listener
  console.log('client connected');
  clientCounter++;
  c.index = clientCounter;
  c.ready = true;
  clients.push(c);
  c.on('data', function(data) {
  	//console.log("received:", data);
    try {
      data = data.toString('utf8');
      var pieces = data.split('\0');
      var piece;
      for(var i = 0; i < pieces.length; i++) {
        piece = pieces[i].trim();
        if(!piece) continue;
        piece = JSON.parse(piece);
        parseData(piece, c);
      }
    } catch(e) {
      console.log("failed parsing", data, "piece:", piece, e);
    }
  });
  c.on('end', function() {
    c.ready = false;
    console.log('client disconnected');
    for(var i = 0; i < clients.length; i++) {
      if(clients[i].index == client.index) {
        clients.splice(i, 1);
      }
    }
  });
});

server.on('error', function(err) {
  console.log("server error", err);
});
fs.unlink('/tmp/intervalometer.sock', function(){
  server.listen('/tmp/intervalometer.sock',  function() {
    console.log('server bound');
  });
});

function broadcast(data) {
    for(var i = 0; i < clients.length; i++) {
        //console.log("client:", client);
        try {
            if (clients[i]) clients[i].write(data);
        } catch (err) {
            console.log("broadcast error:", err);
        }
    }
};

function send(event, data, client) {
  var payload = JSON.stringify({
    type: event,
    data: data
  });
  try {
    if(client && client.ready) client.write(payload+'\0');
  } catch (err) {
      console.log("send error:", err);
  }
}

function sendEvent(event, data) {
  var payload = JSON.stringify({
    type: event,
    data: data
  });
  broadcast(payload+'\0');
}

function parseData(data, client) {
  if(data && data.type) {
    var type = data.type;
    var args = data.args || {};
    var callback = (function(id, c) { return function(err, data) {
      if(id) {
        console.log("sending callback for ", id, c.ready);
        send('callback', {id:id, err:err, data:data}, c);
      }
    }})(data.id, client);

    runCommand(type, args, callback);
  }
}


function runCommand(type, args, callback) {
  switch(type) {
    /*case 'load':
      intervalometer.load(args, callback);
      break;
    case 'start':
      intervalometer.start(callback);
      break;
    case 'pause':
      intervalometer.pause(callback);
      break;
    case 'cancel':
      intervalometer.cancel(callback);
      break;
    case 'motion-step':
      motion.step(args.axis, args.steps, callback);
      break;
    case 'motion-move':
      motion.move(args.axis, args.speed, callback);
      break;
    case 'motion-stop':
      motion.stop(args.axis, callback);
      break;
    case 'motion-info':
      motion.info(callback);
      break;
*/
    case 'intervalometer.load':
      intervalometer.load(args.program, callback);
      break;
    case 'intervalometer.cancel':
      intervalometer.cancel(callback);
      break;
    case 'intervalometer.run':
      intervalometer.run(args.program, callback);
      break;
    case 'gps':
      intervalometer.addGpsData(args.gpsData, callback);
      break;

    case 'camera.ptp.connectSonyWifi':
      camera.ptp.connectSonyWifi(callback);
      break;
    case 'camera.ptp.lvOff':
      camera.ptp.lvOff(callback);
      break;
    case 'camera.ptp.zoom':
      camera.ptp.zoom(args.x, args.y, callback);
      break;
    case 'camera.ptp.focus':
      camera.ptp.focus(args.step, args.repeat, callback);
      break;
    case 'camera.setEv':
      camera.setEv(args.ev, args.options, callback);
      break;
    case 'camera.ptp.preview':
      camera.ptp.preview(callback);
      break;
    case 'camera.ptp.getSettings':
      camera.ptp.getSettings(function(err, data){
        sendEvent('camera.settings', camera.ptp.settings.mapped);
        callback(err, camera.ptp.settings.mapped);
      });
      break;
    case 'camera.ptp.cameraList':
      camera.ptp.cameraList(callback);
      break;
    case 'camera.ptp.switchPrimary':
      camera.ptp.switchPrimary(args.cameraObject, callback);
      break;
    case 'camera.ptp.capture':
      camera.ptp.capture(args.options, callback);
      break;
    case 'camera.ptp.runSupportTest':
      camera.ptp.runSupportTest(callback);
      break;
    case 'camera.ptp.set':
      camera.ptp.set(args.key, args.val, callback);
      break;
    case 'camera.ptp.mountSd':
      camera.ptp.mountSd(callback);
      break;
    case 'camera.ptp.unmountSd':
      camera.ptp.unmountSd(callback);
      break;

    case 'nmx.move':
      nmx.move(args.motor, args.steps, callback);
      break;
  }
}

intervalometer.on('status', function(data) {
  data.autoSettings = intervalometer.autoSettings;
  sendEvent('intervalometer.status', data);
});
intervalometer.on('error', function(data) {
  sendEvent('intervalometer.error', data);
});


camera.ptp.on('media', function(data) {
  sendEvent('media.present', data);
});
camera.ptp.on('media-insert', function(data) {
  sendEvent('media.insert', data);
});
camera.ptp.on('media-remove', function(data) {
  sendEvent('media.insert', data);
});
camera.ptp.on('photo', function() {
  sendEvent('camera.photo', camera.ptp.photo);
});
camera.ptp.on('settings', function(data) {
  sendEvent('camera.settings', data);
});
camera.ptp.on('connected', function(model) {
  var data = {
    connected: camera.ptp.connected,
    model: camera.ptp.model,
    count: camera.ptp.count,
    supports: camera.ptp.supports
  };
  sendEvent('camera.connected', data);
});
camera.ptp.on('exiting', function(model) {
  var data = {
    connected: camera.ptp.connected,
    model: camera.ptp.model,
    count: camera.ptp.count,
    supports: camera.ptp.supports
  };
  sendEvent('camera.exiting', data);
});
camera.ptp.on('error', function(data) {
  sendEvent('camera.error', data);
});
camera.ptp.on('status', function(data) {
  sendEvent('camera.status', data);
});
camera.ptp.on('connectionError', function(data) {
  sendEvent('camera.connectionError', data);
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
    //if(btleScanStarting || updates.installing) return;
    if(btleScanStarting) return;
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
                    console.log("BLE scan started: ", err);
                });
            }
            btleScanStarting = false;
        }, 8000);
    } else {
        btleScanStarting = false;
        //if(wifi.btEnabled) {
        //    wifi.resetBt();
        //}
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
    sendEvent('nmx.status', status);
    if (status.connected) {
        stopScan();
    } else {
        //wifi.resetBt(function(){
            startScan();
        //});
    }
});

