
/****************************************************************************
 LICENSE: CC BY-NC-SA 4.0 https://creativecommons.org/licenses/by-nc-sa/4.0/
 This is an original driver by Elijah Parker <mail@timelapseplus.com>
 It is free to use in other projects for non-commercial purposes.  For a
 commercial license and consulting, please contact mail@timelapseplus.com
*****************************************************************************/

var util = require('util');
var EventEmitter = require('events').EventEmitter;
var usb = require('usb');

var api = new EventEmitter();

api.enabled = true;
api.available = false;

var DRIVERS = [];
DRIVERS.push(require('./drivers/fuji.js'));

function CameraAPI(driver) {
	this._driver = driver;

	this.exposure = {
		shutter: null,
		aperture: null,
		iso: null,
	}
	this.status = { // read only
		busy: false, 		// bool
		recording: false, 	// bool
		remaining: null, 	// int
		battery: null, 		// float
		focusPos: null, 	// int
		liveviewMode: false	// bool
	}
	this.config = { // can be set via CameraAPI.set()
		format: null,
		lvZoom: null,
		lvCenter: null,
		mode: null,
		af: null,
	}
	this.supports = { // read only
		shutter: null,
		aperture: null,
		iso: null,
		liveview: null,
		target: null,
		focus: null,
		video: null,
		trigger: null
	}
}

util.inherits(CameraAPI, EventEmitter);


usb.on('attach', function(device) { 
	//console.log("device attached", device);
	if(api.enabled) tryConnectDevice(device);
});

usb.on('detach', function(device) { 
	//console.log("DETACHED:", device);
	var port = device.busNumber + ':' + device.deviceAddress;
	var camIndex = null;
	for(var i = 0; i < api.cameras.length; i++) {
		if(api.cameras[i].camera._port == port) {
			camIndex = i;
			var cam = api.cameras[i]._dev;
			if(cam && cam.ep && cam.ep.evt) {
				cam.ep.evt.stopPoll();
			}
			if(cam) cam.iface.release();
			if(cam) cam.device.close();
			api.emit('disconnect', api.cameras[i].name); // had been connected
		}
	}	
	api.cameras.splice(camIndex, 1);
	ensurePrimary();
	console.log("cameras connected: ", api.cameras.length);
});


CameraAPI.prototype.set = function(parameter, value, callback) {
	return this._driver.set(this, parameter, value, callback);
}

CameraAPI.prototype.init = function(callback) {
	return this._driver.init(this, callback);
}

CameraAPI.prototype.capture = function(target, options, callback) {
	if(typeof options == 'function' && callback == undefined) {
		callback = options;
		options = {};
	}
	return this._driver.capture(this, target, options, callback);
}

CameraAPI.prototype.captureHDR = function(target, options, frames, stops, darkerOnly, callback) {
	if(typeof options == 'function' && callback == undefined) {
		callback = options;
		options = {};
	}
	return this._driver.captureHDR(this, target, options, frames, stops, darkerOnly, callback);
}

CameraAPI.prototype.liveviewMode = function(enable, callback) {
	if(!this.supports.liveview) return callback && callback("not supported");
	if(this.config.liveview === enable) return callback && callback();
	return this._driver.liveviewMode(this, enable, callback);
}

CameraAPI.prototype.liveviewImage = function(enable, callback) {
	if(!this.supports.liveview) return callback && callback("not supported");
	if(!this.config.liveview) return callback && callback("not enabled");
	return this._driver.liveviewImage(this, callback);
}

CameraAPI.prototype.moveFocus = function(steps, resolution, callback) {
	if(!this.supports.focus) return callback && callback("not supported");
	return this._driver.moveFocus(this, enable, callback);
}

function connectCamera(driver, device) {
	var camera = new CameraAPI(driver);
	device.open();
	var iface = device.interfaces[0];
	iface.claim();
	var cam = {
		device: device,
		iface: iface,
		ep: {
			in: null,
			out: null,
			evt: null
		},
		transactionId: 0
	};
	for(var i = 0; i < iface.endpoints.length; i++) {
		var ep = iface.endpoints[i];
		if(ep.transferType == 2 && ep.direction == 'in') cam.ep.in = ep;
		if(ep.transferType == 2 && ep.direction == 'out') cam.ep.out = ep;
		if(ep.transferType == 3 && ep.direction == 'in') cam.ep.evt = ep;
	}
	camera._dev = cam;
	if(cam.ep.evt) {
		cam.ep.evt.startPoll();
		cam.ep.evt.on('data', function(data) {
			camera._driver._event(camera, data);
		});
		cam.ep.evt.on('error', function(error) {
			camera._driver._error(camera, error);
		});
	}
	camera._port = device.busNumber + ':' + device.deviceAddress;
	return camera;
}

function fourHex(n) {
	n = n || 0;
	n = parseInt(n);
	n = n.toString(16);
	while(n.length < 4) n = '0' + n;
	return n;
}

function matchDriver(device) {
	if(device && device.deviceDescriptor) {
		var id  = fourHex(device.deviceDescriptor.idVendor) + ':' + fourHex(device.deviceDescriptor.idProduct);
		for(var i = 0; i < DRIVERS.length; i++) {
			if(DRIVERS[i].supportedCameras[id]) {
				return {
					driver: DRIVERS[i],
					name: DRIVERS[i].supportedCameras[id].name,
					supports: DRIVERS[i].supportedCameras[id].supports
				}
			}
		}
	}
	return null;
}

api.cameras = [];

function tryConnectDevice(device) {
	var port = device.busNumber + ':' + device.deviceAddress;
	for(var i = 0; i < api.cameras.length; i++) {
		if(api.cameras[i].camera._port == port) return; // already connected
	}
	var found = matchDriver(device);
	if(found) {
		console.log("camera connected:", found.name);
		var camera = connectCamera(found.driver, device);
		camera.supports = found.supports;
		camera.init(function(err) {
			api.cameras.push({
				model: found.name,
				camera: camera
			});
			ensurePrimary();
			api.emit('connected', found.name, camera.exposure);
		});
	} else {
		api.emit('unsupported', device);
	}
}

function ensurePrimary() {
	var primaryIndex= -1;
	for(var i = 0; i < api.cameras.length; i++) {
		if(api.cameras[i].primary && primaryIndex == -1) {
			primaryIndex = i;
			continue;
		}
		api.cameras[i].primary = false; // ensure there's only one
	}
	if(api.cameras.length > 0) {
		if(primaryIndex == -1) {
			primaryIndex = 0;
			api.cameras[primaryIndex].primary = true;	
		}
		api.available = true;
		api.model = api.cameras[primaryIndex].model;
		api.supports = api.cameras[primaryIndex].camera.supports;
	} else {
		api.available = false;
	}
}

function getPrimary() {
	for(var i = 0; i < api.cameras.length; i++) {
		if(api.cameras[i].primary) return api.cameras[i];
	}
}

api.setPrimaryCamera = function(cameraIndex) {
	for(var i = 0; i < api.cameras.length; i++) {
		api.cameras[i].primary = false;
	}
	api.cameras[cameraIndex].primary = true;
	ensurePrimary();
}

api.set = function(parameter, value, callback) {
	console.log("API: setting", parameter, "to", value);
	for(var i = 0; i < api.cameras.length; i++) {
		if(api.cameras[i].primary) {
			api.cameras[i].camera.set(parameter, value, callback);
		} else {
			api.cameras[i].camera.set(parameter, value);
		}
	}
}

api.capture = function(target, options, callback) {
	if(typeof options == 'function' && callback == undefined) {
		callback = options;
		options = {};
	}
	for(var i = 0; i < api.cameras.length; i++) {
		if(api.cameras[i].primary) {
			api.cameras[i].camera.capture(target, options, callback);
		} else {
			api.cameras[i].camera.capture(target, options);
		}
	}
}

api.captureHDR = function(target, options, frames, stops, darkerOnly, callback) {
	if(typeof options == 'function' && callback == undefined) {
		callback = options;
		options = {};
	}
	for(var i = 0; i < api.cameras.length; i++) {
		if(api.cameras[i].primary) {
			api.cameras[i].camera.capture(target, options, frames, stops, darkerOnly, callback);
		} else {
			api.cameras[i].camera.capture(target, options, frames, stops, darkerOnly);
		}
	}
}

api.liveviewMode = function(enable, callback) {
	var primaryCamera = getPrimary();
	if(!primaryCamera) return callback && callback("camera not connected");
	if(!primaryCamera.supports.liveview) return callback && callback("not supported");
	if(primaryCamera.status.liveview === enable) return callback && callback();
	primaryCamera.camera.liveviewMode(enable, callback);
}

api.liveviewImage = function(callback) {
	var primaryCamera = getPrimary();
	if(!primaryCamera) return callback && callback("camera not connected");
	if(!primaryCamera.supports.liveview) return callback && callback("not supported");
	if(!primaryCamera.camera.config.liveview) return callback && callback("not enabled");
	primaryCamera.camera.liveviewMode(callback);
}

api.moveFocus = function(steps, resolution, callback) {
	var primaryCamera = getPrimary();
	if(!primaryCamera) return callback && callback("camera not connected");
	if(!primaryCamera.supports.focus) return callback && callback("not supported");
	for(var i = 0; i < api.cameras.length; i++) {
		if(api.cameras[i].primary) {
			api.cameras[i].camera.moveFocus(steps, resolution, callback);
		} else {
			api.cameras[i].camera.moveFocus(steps, resolution);
		}
	}
}

var lastParam = null;
api.setEv = function(ev, options, cb) {
    if (!options) options = {};

    var shutter = settings.details ? settings.details.shutter : settings.shutter;
    var aperture = settings.details ? settings.details.aperture : settings.sperture;
    var iso = settings.details ? settings.details.iso : settings.iso;

    var apertureEnabled = false;
    //var shutterEnabled = true; //to be added
    if(options.parameters && options.parameters.indexOf('A') !== -1) apertureEnabled = true
    // if(options.parameters && options.parameters.indexOf('I') === -1) shutterEnabled = false // defaults to enabled

    if (!aperture) {
        apertureEnabled = false;
        aperture = {
            ev: lists.fixedApertureEv
        };
    }

    console.log("current shutter", shutter);
    console.log("current aperture", aperture);
    console.log("current iso", iso);

    var shutterList = settings.lists ? settings.lists.shutter : settings.shutter.list;
    var apertureList = settings.lists ? settings.lists.aperture : settings.aperture.list;
    var isoList = settings.lists ? settings.lists.iso : settings.iso.list;

    //console.log("options: ", options);
    //console.log("isoList: ", isoList);

    if(shutterList) shutterList = lists.cleanEvCopy(shutterList);
    if(apertureList) apertureList = lists.cleanEvCopy(apertureList);
    if(isoList) isoList = lists.cleanEvCopy(isoList);

    //console.log("isoList2: ", isoList);

    if (shutterList && options && options.maxShutterLengthMs) {
        var maxSeconds = Math.floor(options.maxShutterLengthMs / 1000);
        if(maxSeconds < 1) maxSeconds = 1;
        //console.log("MAX seconds for shutter: ", maxSeconds);
        shutterList = shutterList.filter(function(item) {
            return lists.getSecondsFromEv(item.ev) <= maxSeconds;
        });
        //console.log("Filtered shutter list: ", shutterList);
    }
    if (shutterList && options && options.shutterMax != null) {
        shutterList = shutterList.filter(function(item) {
            return item.ev >= options.shutterMax;
        });
    }
    if (isoList && options && options.isoMax != null) {
        isoList = isoList.filter(function(item) {
            return item.ev >= options.isoMax;
        });
    }
    if (isoList && options && options.isoMin != null) {
        isoList = isoList.filter(function(item) {
            return item.ev <= options.isoMin;
        });
    }
    if (apertureList && options && options.apertureMax != null) {
        apertureList = apertureList.filter(function(item) {
            return item.ev <= options.apertureMax;
        });
    }
    if (apertureList && options && options.apertureMin != null) {
        apertureList = apertureList.filter(function(item) {
            return item.ev >= options.apertureMin;
        });
    }

    //console.log("apertureList: ", apertureList);

    var currentEv = null;
    if(shutter && aperture && iso && shutter.ev != null && aperture.ev != null && iso.ev != null) {
        currentEv = lists.getEv(shutter.ev, aperture.ev, iso.ev);
    }
    console.log("setEv: currentEv: ", currentEv, "targetEv:", ev);

    console.log("setEv: list lengths: s:", shutterList ? shutterList.length : -1, "i:", isoList ? isoList.length : -1, "a:", apertureList ? apertureList.length : -1);

    if (ev === null || currentEv === null) {
        console.log("setEv: unable to set ev, insufficient settings available");
        if (cb) cb("unable to set ev, insufficient settings available", {
            ev: currentEv,
            shutter: shutter,
            aperture: aperture,
            iso: iso
        });
        return;
    }

    if(!options.blendParams) lastParam = null;

    for (var trys = 0; trys < 3; trys++) {
        while (ev < currentEv - 1 / 4) {
            //console.log("ev < currentEv");
            var s = lists.decEv(shutter, shutterList);
            if (apertureEnabled) var a = lists.decEv(aperture, apertureList);
            var i = lists.decEv(iso, isoList);

            if (s && shutter.ev != s.ev && lastParam != 's') {
                shutter = s;
                if(options.blendParams) lastParam = 's';
            } else if (apertureEnabled && a && aperture.ev != a.ev && lastParam != 'a') {
                aperture = a;
                if(options.blendParams) lastParam = 'a';
            } else if (i && iso.ev != i.ev && lastParam != 'i') {
                iso = i;
                if(options.blendParams) lastParam = 'i';
            } else {
                lastParam = null;
                currentEv = lists.getEv(shutter.ev, aperture.ev, iso.ev);
                break;
            }
            currentEv = lists.getEv(shutter.ev, aperture.ev, iso.ev);
            //console.log(" update: ", currentEv);
        }

        while (ev > currentEv + 1 / 4) {
            //console.log("ev > currentEv");
            var s = lists.incEv(shutter, shutterList);
            if (apertureEnabled) var a = lists.incEv(aperture, apertureList);
            var i = lists.incEv(iso, isoList);

            if (i && iso.ev != i.ev && lastParam != 'i') {
                iso = i;
                if(options.blendParams) lastParam = 'i';
            } else if (apertureEnabled && a && aperture.ev != a.ev && lastParam != 'a') {
                aperture = a;
                if(options.blendParams) lastParam = 'a';
            } else if (s && shutter.ev != s.ev && lastParam != 's') {
                shutter = s;
                if(options.blendParams) lastParam = 's';
            } else {
                lastParam = null;
                currentEv = lists.getEv(shutter.ev, aperture.ev, iso.ev);
                break;
            }
            currentEv = lists.getEv(shutter.ev, aperture.ev, iso.ev);
            //console.log(" update: ", currentEv);
        }

        if (Math.abs(ev - currentEv) <= 1 / 4) break;

    }


    console.log("setEv: finalEv: ", currentEv);

    function runQueue(queue, callback) {
        set = queue.pop();
        if (set) {
            console.log("setEv: setting", set.name, "to", set.val);
            remap('camera.ptp.set')(set.name, set.val, function() {
                setTimeout(function() {
                    runQueue(queue, callback)
                });
            });
        } else {
            if (callback) callback();
            return;
        }
    }

    if(options.doNotSet) {
        console.log("setEv: done, not applying changes.");
        if (cb) return cb(null, {
            ev: currentEv,
            shutter: shutter,
            aperture: aperture,
            iso: iso
        }); else return;
    }

    var setQueue = [];

    if (shutter.ev != (settings.details ? settings.details.shutter.ev : settings.shutter.ev)) setQueue.push({
        name: 'shutter',
        val: shutter.cameraName || shutter.name
    });
    if (apertureEnabled && aperture.ev != (settings.details ? settings.details.aperture.ev : settings.aperture.ev)) setQueue.push({
        name: 'aperture',
        val: aperture.cameraName || aperture.name
    });
    if (iso.ev != (settings.details ? settings.details.iso.ev : settings.iso.ev)) setQueue.push({
        name: 'iso',
        val: iso.cameraName || iso.name
    });

    runQueue(setQueue, function() {
        console.log("setEv: done.");
        if (cb) cb(null, {
            ev: currentEv,
            shutter: shutter,
            aperture: aperture,
            iso: iso
        });

    });

}



if(api.enabled) {
	var devices = usb.getDeviceList();
	for(var i = 0; i < devices.length; i++) {
		tryConnectDevice(devices[i]);
	}
}

console.log("ready");

module.exports = api;
