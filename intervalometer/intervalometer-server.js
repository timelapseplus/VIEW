

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

require('rootpath')();
var camera = require('camera/camera.js');
var motion = require('motion/motion.js');
var noble = require('noble');
var intervalometer = require('intervalometer/intervalometer.js');
var fs = require('fs');
var TLROOT = "/root/time-lapse";
var watchdog = require('system/watchdog.js');
var net = require('net');

var clientCounter = 0;
var clients = [];
var eventQueue = [];

var server = net.createServer(function(c) {
  // 'connection' listener
  console.log('client connected');
  clientCounter++;
  c.index = clientCounter;
  c.ready = true;
  clients.push(c);
  var ev;
  c.on('error', function(err) {
    console.log("client error:", err);
  });
  try {
    sendCameraUpdate();
    if(camera.ptp.sdPresent) {
      sendEvent('media.present', camera.ptp.sdMounted);
    }
    sendEvent('motion.status', motion.status);
    while(ev = eventQueue.shift()) c.write(ev);
  } catch (e) {
    console.log("error during event queue write:", e);
  }
  c.dataBuf = new Buffer(0);
  c.on('data', function(rawData) {
  	//console.log("received:", rawData);
    try {
      if(!rawData.length) return;
      c.dataBuf = Buffer.concat([c.dataBuf, rawData]);
      if(rawData[rawData.length - 1] != 0) {
        return;
      }
      var data = c.dataBuf.toString('utf8');
      c.dataBuf = new Buffer(0);
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
      if(clients[i].index == c.index) {
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
            if (clients[i] && clients[i].ready) {
              clients[i].write(data);
            }
        } catch (err) {
            console.log("broadcast error:", err);
        }
    }
};

watchdog.onKill(function(pid){
    for(var i = 0; i < clients.length; i++) {
        try {
            if (clients[i] && clients[i].ready && clients[i].pid == pid) {
              clients[i].ready = false;
            }
        } catch (err) {
            console.log("error:", err);
        }
    }
});

function send(event, data, client) {
  if(data && data.data && data.data.cameraResults) {
    data.data.cameraResults = null; // remove circular references
  }
  var payload = JSON.stringify({
    type: event,
    data: data
  });
  try {
    if(client && client.ready) {
      client.write(payload+'\0');
    } else {
      sendEvent(event, data);
    }
  } catch (err) {
      console.log("send error:", err);
  }
}

function sendEvent(event, data) {
  var payload = JSON.stringify({
    type: event,
    data: data
  });
  if(clients.length > 0) {
    broadcast(payload+'\0');
  } else {
    eventQueue.push(payload+'\0');
  }
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

    runCommand(type, args, callback, client);
  }
}


function runCommand(type, args, callback, client) {
  var cameraCallback = function(err, res) {
    if(!intervalometer.status.running && !camera.ptp.lvOn && camera.ptp.model && camera.ptp.model.match(/nikon/i)) {
      console.log("exiting pc mode...");
      camera.ptp.set("controlmode", 0, function(){
        callback && callback(err, res);
      });
    } else {
      callback && callback(err, res);
    }
  }
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
      camera.ptp.lvOff(cameraCallback);
      break;
    case 'camera.ptp.zoom':
      camera.ptp.zoom(args.x, args.y, callback);
      break;
    case 'camera.ptp.focus':
      camera.ptp.focus(args.step, args.repeat, callback);
      break;
    case 'camera.setEv':
      camera.setEv(args.ev, args.options, cameraCallback);
      break;
    case 'camera.ptp.preview':
      camera.ptp.preview(cameraCallback);
      break;
    case 'camera.ptp.getSettings':
      camera.ptp.getSettings(function(err, data){
        sendEvent('camera.settings', camera.ptp.settings);
        cameraCallback(err, camera.ptp.settings);
      });
      break;
    case 'camera.ptp.cameraList':
      camera.ptp.cameraList(callback);
      break;
    case 'camera.ptp.switchPrimary':
      camera.ptp.switchPrimary(args.cameraObject, callback);
      break;
    case 'camera.ptp.capture':
      camera.ptp.capture(args.options, cameraCallback);
      break;
    case 'camera.ptp.capture-test':
      camera.ptp.capture({mode:'test'}, cameraCallback);
      break;
    case 'camera.ptp.runSupportTest':
      camera.ptp.runSupportTest(callback);
      break;
    case 'camera.ptp.set':
      camera.ptp.set(args.key, args.val, cameraCallback);
      break;
    case 'camera.ptp.mountSd':
      camera.ptp.mountSd(callback);
      break;
    case 'camera.ptp.unmountSd':
      camera.ptp.unmountSd(callback);
      break;

    case 'db.currentTimelapseFrames':
      callback(null, intervalometer.db.currentTimelapseFrames(args.cameraIndex));
      break;

    case 'motion.move':
      motion.move(args.driver, args.motor, args.steps, callback);
      break;
    case 'motion.zero':
      motion.zero(args.driver, args.motor, callback);
      break;
    case 'motion.status':
      motion.refresh(callback);
      break;
    case 'motion.joystick':
      motion.joystick(args.driver, args.motor, args.speed, callback);
      break;
    case 'intervalometer.moveTracking':
      intervalometer.moveTracking(args.axis, args.degrees);
      break;
    case 'watchdog.set':
      if(args.pid) {
        client.pid = args.pid;
        watchdog.watch(args.pid);
      }
      callback();
      break;

    case 'watchdog.disable':
      if(args.pid) {
        client.pid = null;
        watchdog.disable(args.pid);
      }
      callback();
      break;

    case 'bt.reset':
      console.log("CORE: reloading BT module");
      cleanUpBt();
      setUpBt();
      callback();
      break;
  }
}

intervalometer.on('status', function(data) {
  data.autoSettings = intervalometer.autoSettings;
  if(!data.running && camera.ptp.model.match(/nikon/i)) camera.ptp.set("controlmode", 0, function(){});
  sendEvent('intervalometer.status', data);
  if(!data.running) {
    motion.refresh(function(){
      sendEvent('motion.status', motion.status);
    });
  }
});
intervalometer.on('error', function(data) {
  sendEvent('intervalometer.error', data);
});


function sendCameraUpdate() {
  var data = {
    connected: camera.ptp.connected,
    model: camera.ptp.model,
    count: camera.ptp.count,
    supports: camera.ptp.supports
  };
  sendEvent(camera.ptp.connected ? 'camera.connected' : 'camera.exiting', data);
}

camera.ptp.on('media', function(data) {
  sendEvent('media.present', data);
});
camera.ptp.on('media-insert', function(data) {
  sendEvent('media.insert', data);
});
camera.ptp.on('media-remove', function(data) {
  sendEvent('media.remove', data);
});
camera.ptp.on('photo', function() {
  var obj = {};
  for(var i in camera.ptp.photo) {
    if(camera.ptp.photo.hasOwnProperty(i)) {
      if(i == 'jpeg') {
        obj.base64 = new Buffer(camera.ptp.photo.jpeg).toString('base64');
      } else {
        obj[i] = camera.ptp.photo[i];
      }
    }
  }
  sendEvent('camera.photo', obj);
});
camera.ptp.on('histogram', function(data) {
  sendEvent('camera.histogram', data);
});
camera.ptp.on('settings', function(data) {
  sendEvent('camera.settings', camera.ptp.settings);
});
camera.ptp.on('connected', function(model) {
  console.log("CORE: camera connected", model);
  sendCameraUpdate();
  if(camera.ptp.count == 1) intervalometer.resume();
});
camera.ptp.on('exiting', function(model) {
  console.log("CORE: camera disconnected");
  sendCameraUpdate();
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
        motion.nmx.connect(camera.ptp.nmxDevice);
    } else {
        console.log("NMX detached");
        var status = motion.nmx.getStatus();
        if(status.connected && status.type == "serial") motion.nmx.disconnect();
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
                noble.startScanning(motion.nmx.btServiceIds.concat(motion.gm1.btServiceIds), false, function(err){
                    console.log("BLE scan started: ", err);
                });
            }
            btleScanStarting = false;
        }, 8000);
    } else {
        btleScanStarting = false;
        var status = motion.nmx.getStatus();
        if(status.connected && status.connectionType == "bt") {
          console.log("CORE: disconnected NMX, bluetooth powered off");
          motion.nmx.disconnect();
          //status = motion.nmx.getStatus();
          sendEvent('motion.status', motion.status);
        }
        //if(wifi.btEnabled) {
        //    wifi.resetBt();
        //}
    }
}

function stopScan() {
    clearScanTimeouts();
    noble.stopScanning();
}

function btStateChange(state) {
    console.log("CORE: BLE state changed to", state);
    if (state == "poweredOn") {
        setTimeout(function() {
            startScan()
        });
    } else if(state == "poweredOff") {
        var status = motion.nmx.getStatus();
        console.log("CORE: NMX status:", status);
        if(status.connected && status.connectionType == "bt") {
          console.log("CORE: disconnected NMX, bluetooth powered off");
          motion.nmx.disconnect();
          sendEvent('motion.status', motion.status);
        }
        var status = motion.gm1.getStatus();
        console.log("CORE: GenieMini status:", status);
        if(status.connected && status.connectionType == "bt") {
          console.log("CORE: disconnected GenieMini, bluetooth powered off");
          motion.gm1.disconnect();
          sendEvent('motion.status', motion.status);
        }
        var status = motion.gm2.getStatus();
        console.log("CORE: GenieMini status:", status);
        if(status.connected && status.connectionType == "bt") {
          console.log("CORE: disconnected GenieMini, bluetooth powered off");
          motion.gm2.disconnect();
          sendEvent('motion.status', motion.status);
        }
    }
}
var btConnecting = false;
var btConnectingTries = 0;
function btDiscover(peripheral) {
    if(btConnecting && btConnectingTries < 10) return setTimeout(function(){
      btConnectingTries++;
      btDiscover(peripheral);
    }, 1000);
    btConnecting = false;
    btConnectingTries = 0;
    //console.log('ble', peripheral);
    var connectGM = function(cb) {
      var status = motion.gm1.getStatus();
      if(status.connected && status.connectionType == "bt") {
        var status = motion.gm2.getStatus();
        if(status.connected && status.connectionType == "bt") {
          stopScan();
        } else {
          btConnecting = true;
          motion.gm2.connect(peripheral, function(connected) {
            btConnecting = false;
          });
        }
      } else {
        btConnecting = true;
        motion.gm1.connect(peripheral, function(connected) {
          btConnecting = false;
        });
      }
    }
    var status = motion.nmx.getStatus();
    if(status.connected && status.connectionType == "bt") {
      connectGM();
    } else {
      btConnecting = true;
      motion.nmx.connect(peripheral, function(connected) {
        btConnecting = false;
        if(connected) {
          stopScan();
        } else {
          connectGM();
        }
      });
    }
}

function cleanUpBt() {
  stopScan();
  noble.removeListener('stateChange', btStateChange);
  noble.removeListener('discover', btDiscover);
  noble = null;
  purgeCache('noble');
  noble = require('noble');
}

function setUpBt() {
  console.log("CORE: setting up bluetooth");
  noble.on('stateChange', btStateChange);
  noble.on('discover', btDiscover);

  startScan();
}
setUpBt();

motion.nmx.connect();

motion.on('status', function(status) {
    sendEvent('motion.status', status);
    if (status.connected) {
        stopScan();
    } else {
        //wifi.resetBt(function(){
            startScan();
        //});
    }
});


/**
 * Removes a module from the cache
 */
function purgeCache(moduleName) {
    // Traverse the cache looking for the files
    // loaded by the specified module name
    searchCache(moduleName, function (mod) {
        delete require.cache[mod.id];
    });

    // Remove cached paths to the module.
    // Thanks to @bentael for pointing this out.
    Object.keys(module.constructor._pathCache).forEach(function(cacheKey) {
        if (cacheKey.indexOf(moduleName)>0) {
            delete module.constructor._pathCache[cacheKey];
        }
    });
};

/**
 * Traverses the cache to search for all the cached
 * files of the specified module name
 */
function searchCache(moduleName, callback) {
    // Resolve the module identified by the specified name
    var mod = require.resolve(moduleName);

    // Check if the module has been resolved and found within
    // the cache
    if (mod && ((mod = require.cache[mod]) !== undefined)) {
        // Recursively go over the results
        (function traverse(mod) {
            // Go over each of the module's children and
            // traverse them
            mod.children.forEach(function (child) {
                traverse(child);
            });

            // Call the specified callback providing the
            // found cached module
            callback(mod);
        }(mod));
    }
};
