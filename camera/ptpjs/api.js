
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
			var name = api.cameras[i].name;
			api.cameras.splice(camIndex, 1);
			ensurePrimary();
			console.log("cameras connected: ", api.cameras.length);
			api.emit('disconnect', name); // had been connected
			break;
		}
	}	
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
	if(primaryCamera.camera.status.liveview === enable) return callback && callback();
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

function listEvs(param, minEv, maxEv) { // returns a sorted list of EV's from a camera available list
	var base = api.cameras[0].exposure;
	if(!base || !base[param] || !base[param].list) return null;
	var list = base[param].list;
	return list.map(function(item) {
		return item.ev;
	}).filter(function(ev) {
		if(ev == null) return false;
		if(minEv != null && ev < minEv) return false;
		if(maxEv != null && ev > maxEv) return false;
		return true;
	}).sort();
}

function incEv(ev, evList) {
	if(!evList) return null;
	var i = evList.indexOf(ev);
	if(i != -1 && i < evList.length - 1) return evList[i + 1];
	return ev;
}

function decEv(ev, evList) {
	if(!evList) return null;
	var i = evList.indexOf(ev);
	if(i > 0) return evList[i - 1];
	return ev;
}

api.getEv = function(shutterEv, apertureEv, isoEv) {
    if(shutterEv == null) shutterEv = api.cameras.length > 0 && api.cameras[0].exposure.shutter ? api.cameras[0].exposure.shutter.ev : null;
    if(apertureEv == null) apertureEv = api.cameras.length > 0 && api.cameras[0].exposure.aperture ? api.cameras[0].exposure.aperture.ev : null;
    if(isoEv == null) isoEv = api.cameras.length > 0 && api.cameras[0].iso.shutter ? api.cameras[0].exposure.iso.ev : null;
    if(shutterEv == null || apertureEv == null || isoEv == null) return null;
    return shutterEv + 6 + apertureEv + 8 + isoEv;
}

var lastParam = null;
api.setEv = function(ev, options, callback) {
    if (!options) options = {};

    var returnData = {
        ev: null,
        shutter: {},
        aperture: {},
        iso: {}
    }

    if(ev == null) return callback && callback("invalid ev", returnData);
    if(api.cameras.length == 0) return callback && callback("camera not connected", returnData);

    var exposure = api.cameras[0].camera.exposure;

    var shutterEv = exposure.shutter ? exposure.shutter.ev : null;
    var apertureEv = exposure.aperture ? exposure.aperture.ev : null;
    var isoEv = exposure.iso ? exposure.iso.ev : null;

    var apertureEnabled = false;
    if(options.parameters && options.parameters.indexOf('A') !== -1) apertureEnabled = true

    if (!apertureEv) {
        apertureEnabled = false;
        apertureEv = options.fixedApertureEv != null ? options.fixedApertureEv : -5; // default to f/2.8
    }

    var shutterOrig = shutterEv;
    var apertureOrig = apertureEv;
    var isoOrig = isoEv;

    var currentEv = null;
    if(shutterEv != null && isoEv != null && apertureEv != null) {
        currentEv = api.getEv(shutterEv, apertureEv, isoEv);
    }
    if(currentEv == null) return callback && callback("insufficient settings available", returnData);

    var origEv = currentEv;

    var shutterList = 	listEvs('shutter', 		null, 					options.shutterMax);
    var apertureList = 	listEvs('aperture', 	options.apertureMin, 	options.apertureMax);
    var isoList = 		listEvs('iso', 			options.isoMin, 		options.isoMax);

    if (shutterList && options && options.maxShutterLengthMs) {
        var maxSeconds = Math.floor(options.maxShutterLengthMs / 1000);
        if(maxSeconds < 1) maxSeconds = 1;
        shutterList = shutterList.filter(function(ev) {
            return lists.getSecondsFromEv(ev) <= maxSeconds;
        });
    }

    if(!options.blendParams) lastParam = null;

    for (var trys = 0; trys < 3; trys++) {
        while (ev < currentEv - 1 / 4) {
            //console.log("ev < currentEv");
            var s = decEv(shutterEv, shutterList);
            if (apertureEnabled) var a = decEv(apertureEv, apertureList);
            var i = decEv(isoEv, isoList);

            if (shutterEv != s && lastParam != 's') {
                shutterEv = s;
                if(options.blendParams) lastParam = 's';
            } else if (apertureEnabled && apertureEv != a && lastParam != 'a') {
                apertureEv = a;
                if(options.blendParams) lastParam = 'a';
            } else if (isoEv != i && lastParam != 'i') {
                isoEv = i;
                if(options.blendParams) lastParam = 'i';
            } else {
                lastParam = null;
                currentEv = api.getEv(shutterEv, apertureEv, isoEv);
                break;
            }
            currentEv = api.getEv(shutterEv, apertureEv, isoEv);
            //console.log(" update: ", currentEv);
        }

        while (ev > currentEv + 1 / 4) {
            //console.log("ev > currentEv");
            var s = incEv(shutterEv, shutterList);
            if (apertureEnabled) var a = incEv(apertureEv, apertureList);
            var i = incEv(isoEv, isoList);

            if (isoEv != i && lastParam != 'i') {
                isoEv = i;
                if(options.blendParams) lastParam = 'i';
            } else if (apertureEnabled && apertureEv != a && lastParam != 'a') {
                apertureEv = a;
                if(options.blendParams) lastParam = 'a';
            } else if (shutterEv != s && lastParam != 's') {
                shutterEv = s;
                if(options.blendParams) lastParam = 's';
            } else {
                lastParam = null;
                currentEv = getEv(shutterEv, apertureEv, isoEv);
                break;
            }
            currentEv = getEv(shutterEv, apertureEv, isoEv);
            //console.log(" update: ", currentEv);
        }

        if (Math.abs(ev - currentEv) <= 1 / 4) break;

    }


    console.log("API setEv: current:", origEv, "new:", currentEv);

    function runQueue(queue, callback) {
        set = queue.pop();
        if (set) {
            console.log("API setEv: setting", set.name, "to", set.val);
            api.set(set.name, set.val, function() {
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
        console.log("API setEv: done, not applying changes.");
        if (callback) return callback(null, {
            ev: currentEv,
            shutter: {ev: shutterEv},
            aperture: {ev: apertureEv},
            iso: {ev: isoEv}
        }); else return;
    }

    var setQueue = [];

    if (shutterEv != shutterOrig) setQueue.push({
        name: 'shutter',
        val: shutterEv
    });
    if (apertureEnabled && apertureEv != apertureOrig) setQueue.push({
        name: 'aperture',
        val: apertureEv
    });
    if (isoEv != isoOrig) setQueue.push({
        name: 'iso',
        val: isoEv
    });

    runQueue(setQueue, function() {
        console.log("API setEv: done.");
        if (callback) callback(null, {
            ev: currentEv,
            shutter: {ev: shutterEv},
            aperture: {ev: apertureEv},
            iso: {ev: isoEv}
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
