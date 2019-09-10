
/****************************************************************************
 LICENSE: CC BY-NC-SA 4.0 https://creativecommons.org/licenses/by-nc-sa/4.0/
 This is an original driver by Elijah Parker <mail@timelapseplus.com>
 It is free to use in other projects for non-commercial purposes.  For a
 commercial license and consulting, please contact mail@timelapseplus.com
*****************************************************************************/

var util = require('util');
var EventEmitter = require('events').EventEmitter;
var usb = require('usb');
var fs = require('fs');
var path = require('path');
var async = require('async');
var test = require('./test');

var api = new EventEmitter();

api.enabled = true;
api.available = false;

var DRIVERS = [];
console.log("drivers path", path.resolve(__dirname, './drivers/'));
fs.readdir(path.resolve(__dirname, './drivers/'), function(err, files) {
	//console.log("Camera API: drivers found:", files);
	for(var i = 0; i < files.length; i++) {
		if(files[i].substring(files[i].length - 3) == '.js') {
			console.log("Camera API: adding driver:", files[i]);
			DRIVERS.push(require('./drivers/' + files[i]));
		}
	}
	for(var i = 0; i < DRIVERS.length; i++) {
		test.driver(DRIVERS[i]);
		DRIVERS[i].on('settings', function(camera) {
			//console.log("SETTINGS event: checking index...");
			for(var j = 0; j < api.cameras.length; j++) {
				if(api.cameras[j].camera._port == camera._port) {
					//console.log("SETTINGS event: camera index is", j);
					if(api.cameras[j].primary) {
						api.emit('settings', camera.exposure);
					}
					break;
				}
			}
		});
	}

	if(api.enabled) {
		var devices = usb.getDeviceList();
		for(var i = 0; i < devices.length; i++) {
			tryConnectDevice(devices[i]);
		}
	}
});

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

bulbList = [];

var start = 1000000 / 64; // 1/60
var ev = 0;
var us = start;

while (us < 1000000 * 60 * 10) {
    var tus = us;
    for (var thirds = 0; thirds < 3; thirds++) {
        if (thirds) tus *= 1.25992104989;
        var name = null;
//        for (var i = 0; i < lists.shutter.length; i++) {
//            if (lists.shutter[i].ev != null && Math.ceil(lists.shutter[i].ev * 10) === Math.ceil(-(ev + thirds / 3) * 10)) {
//                name = lists.shutter[i].name;
//                break;
//            }
//        }
        if (!name) {
            name = Math.ceil(tus / 1000000).toString() + 's';
        }
        var item = {
                name: name,
                ev: -(ev + thirds / 3),
                us: tus,
            }
            //console.log(item);
        bulbList.unshift(item);
    }
    ev++;
    us *= 2;
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
	if(!this._driver.captureHDR) return callback && callback("not supported");
	if(typeof options == 'function' && callback == undefined) {
		callback = options;
		options = {};
	}
	return this._driver.captureHDR(this, target, options, frames, stops, darkerOnly, callback);
}

CameraAPI.prototype.liveviewMode = function(enable, callback) {
	if(!this.supports.liveview || !this._driver.liveviewMode) return callback && callback("not supported");
	if(this.status.liveview === enable) return callback && callback();
	return this._driver.liveviewMode(this, enable, callback);
}

CameraAPI.prototype.liveviewImage = function(callback) {
	if(!this.supports.liveview || !this._driver.liveviewImage) return callback && callback("not supported");
	if(!this.status.liveview) return callback && callback("not enabled");
	return this._driver.liveviewImage(this, callback);
}

CameraAPI.prototype.moveFocus = function(steps, resolution, callback) {
	if(!this.supports.focus || !this._driver.moveFocus) return callback && callback("not supported");
	return this._driver.moveFocus(this, steps, resolution, callback);
}

CameraAPI.prototype.setFocusPoint = function(x, y, callback) {
	if(!this._driver.setFocusPoint) return callback && callback("not supported");
	return this._driver.setFocusPoint(this, x, y, callback);
}

CameraAPI.prototype.af = function(steps, resolution, callback) {
	if(!this._driver.af) return callback && callback("not supported");
	return this._driver.af(this, callback);
}

CameraAPI.prototype.lvZoom = function(zoom, callback) {
	if(!this._driver.lvZoom) return callback && callback("not supported");
	return this._driver.lvZoom(this, zoom, callback);
}

function connectCamera(driver, device) {
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
	//console.log("iface.endpoints", iface.endpoints);
	for(var i = 0; i < iface.endpoints.length; i++) {
		var ep = iface.endpoints[i];
		if(ep.transferType == 2 && ep.direction == 'in') cam.ep.in = ep;
		if(ep.transferType == 2 && ep.direction == 'out') cam.ep.out = ep;
		if(ep.transferType == 3 && ep.direction == 'in') cam.ep.evt = ep;
	}
	if(!cam.ep.in || !cam.ep.out) return null;
	cam.ep.in.timeout = 1000;
	cam.ep.out.timeout = 1000;
	var camera = new CameraAPI(driver);
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
		var camera = null;
		try {
			camera = connectCamera(found.driver, device);
		} catch(e) {
			camera = null;
			console.log("failed to connect to", found.name, ", err", e);
		}
		if(camera) {
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
			console.log("USB device doesn't seem available, giving up");
		}
	} else {
		console.log("USB device not supported by new driver:", port);
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
	console.log("API setEv: setting", parameter, "to", value);
	for(var i = 0; i < api.cameras.length; i++) {
		if(api.cameras[i].primary) {
			api.cameras[i].camera.set(parameter, value, callback);
		} else {
			api.cameras[i].camera.set(parameter, value);
		}
	}
}

api.setExposure = function(shutterEv, apertureEv, isoEv, callback) {
	var set = function(index) {
	    async.series([
	        function(cb) {
				if(api.cameras[index].camera.exposure.shutter.ev != shutterEv) api.cameras[index].camera.set('shutter', shutterEv, cb); else cb();
	        },
	        function(cb) {
				if(api.cameras[index].camera.exposure.aperture && api.cameras[index].camera.exposure.aperture.ev != null && api.cameras[index].camera.exposure.aperture.ev != apertureEv) api.cameras[index].camera.set('aperture', apertureEv, cb); else cb();
	        },
	        function(cb) {
				if(api.cameras[index].camera.exposure.iso.ev != isoEv) api.cameras[index].camera.set('iso', isoEv, cb); else cb();
	        },
	    ], function(err, res) {
			if(api.cameras[index].primary) {
		        callback && callback(err);
			}
	    });
	}
	for(var i = 0; i < api.cameras.length; i++) {
		set(i);
	}
}

api.capture = function(target, options, callback) {
	if(typeof options == 'function' && callback == undefined) {
		callback = options;
		options = {};
	}
	for(var i = 0; i < api.cameras.length; i++) {
		if(api.cameras[i].primary) {
			if(options.hdrCount && options.hdrCount > 1) {
				api.cameras[i].camera.captureHDR(target, options, options.hdrCount, options.hdrStops, false, callback);
			} else {
				api.cameras[i].camera.capture(target, options, callback);
			}
		} else {
			if(options.hdrCount && options.hdrCount > 1) {
				api.cameras[i].camera.captureHDR(target, options, options.hdrCount, options.hdrStops, false);
			} else {
				api.cameras[i].camera.capture(target, options);
			}
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
			api.cameras[i].camera.captureHDR(target, options, frames, stops, darkerOnly, callback);
		} else {
			api.cameras[i].camera.captureHDR(target, options, frames, stops, darkerOnly);
		}
	}
}

api.liveviewMode = function(enable, callback) {
	var primaryCamera = getPrimary();
	if(!primaryCamera) return callback && callback("camera not connected");
	if(primaryCamera.camera.status.liveview === enable) return callback && callback();
	primaryCamera.camera.liveviewMode(enable, callback);
}

api.liveviewImage = function(callback) {
	var primaryCamera = getPrimary();
	if(!primaryCamera) return callback && callback("camera not connected");
	if(!primaryCamera.camera.status.liveview) return callback && callback("not enabled");
	primaryCamera.camera.liveviewImage(callback);
}

api.moveFocus = function(steps, resolution, callback) {
	var primaryCamera = getPrimary();
	if(!primaryCamera) return callback && callback("camera not connected");
	for(var i = 0; i < api.cameras.length; i++) {
		if(api.cameras[i].primary) {
			api.cameras[i].camera.moveFocus(steps, resolution, callback);
		} else {
			api.cameras[i].camera.moveFocus(steps, resolution);
		}
	}
}

api.setFocusPoint = function(x, y, callback) {
	var primaryCamera = getPrimary();
	if(!primaryCamera) return callback && callback("camera not connected");
	primaryCamera.camera.setFocusPoint(x, y, callback);
}

api.af = function(callback) {
	var primaryCamera = getPrimary();
	if(!primaryCamera) return callback && callback("camera not connected");
	primaryCamera.camera.af(callback);
}

api.lvZoom = function(zoom, callback) {
	var primaryCamera = getPrimary();
	if(!primaryCamera) return callback && callback("camera not connected");
	primaryCamera.camera.lvZoom(zoom, callback);
}

function listEvs(param, minEv, maxEv) { // returns a sorted list of EV's from a camera available list
	var base = api.cameras[0].camera.exposure;
	//console.log("API:", param, "base", base);
	if(!base || !base[param] || !base[param].list) return null;
	var list = base[param].list;
	//console.log("API:", param, "base list", list);
	var distinctEv = function(value, index) {
		return
	}

	return list.map(function(item) {
		return item.ev;
	}).filter(function(ev, index, self) {
		if(ev == null) return false;
		if(minEv != null && ev < minEv) return false;
		if(maxEv != null && ev > maxEv) return false;
		return self.indexOf(ev) === index; // ensure unique
	}).sort(function(a, b){return a-b});
}

function evIndexOf(ev, evList) {
	var i = evList.indexOf(ev);
	if(i != -1) return i;
	for(i = 0; i < evList.length; i++) {
		if(ev <= evList[i]) {
			if(i == 0) return i;
			if(Math.abs(ev - evList[i]) > Math.abs(ev - evList[i - 1])) {
				return i - 1;
			} else {
				return i;
			}
		}
	}
	return -1;
}

function incEv(ev, evList) {
	//console.log("incEv: index", i, "ev", ev, "list", evList);
	if(!evList) return null;
	var i = evIndexOf(ev, evList);
	if(i != -1 && i < evList.length - 1 && evList[i + 1] != null) return evList[i + 1];
	if(ev != null && evList && evList.length > 0) {
		var min = Math.min.apply(null, evList),
	    	max = Math.max.apply(null, evList);
	    if(ev < min) return min;
	    if(ev > max) return max;
	}
	return ev;
}

function decEv(ev, evList) {
	if(!evList) return null;
	var i = evIndexOf(ev, evList);
	if(i > 0 && evList[i - 1] != null) return evList[i - 1];
	if(ev != null && evList && evList.length > 0) {
		var min = Math.min.apply(null, evList),
	    	max = Math.max.apply(null, evList);
	    if(ev < min) return min;
	    if(ev > max) return max;
	}
	return ev;
}

function equalEv(ev1, ev2) {
	if(ev1 == null || ev2 == null) return true; // equal means ignore
	return Math.abs(ev1 - ev2) < 0.25;
}

api.getEv = function(shutterEv, apertureEv, isoEv) {
    if(shutterEv == null) shutterEv = api.cameras.length > 0 && api.cameras[0].camera.exposure.shutter ? api.cameras[0].camera.exposure.shutter.ev : null;
    if(apertureEv == null) apertureEv = api.cameras.length > 0 && api.cameras[0].camera.exposure.aperture ? api.cameras[0].camera.exposure.aperture.ev : null;
    if(isoEv == null) isoEv = api.cameras.length > 0 && api.cameras[0].camera.exposure.iso ? api.cameras[0].camera.exposure.iso.ev : null;
    if(shutterEv == null || apertureEv == null || isoEv == null) return null;
    return shutterEv + 6 + apertureEv + 8 + isoEv;
}

api.getSecondsFromEv = function(ev) { // only accurate to 1/3 stop
    for (var i = 0; i < bulbList.length; i++) {
        if (bulbList[i].ev >= ev) {
            return bulbList[i].us / 1000000;
        }
    }
    return 0.1;
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
    if(currentEv == null) {
	    console.log("API setEv: insufficient settings available");
    	return callback && callback("insufficient settings available", returnData);
    }
    var origEv = currentEv;

    if(equalEv(ev, currentEv)) {
        return callback && callback(null, {
            ev: currentEv,
            shutter: {ev: shutterEv},
            aperture: {ev: apertureEv},
            iso: {ev: isoEv}
        });
    }

    var shutterList = 	listEvs('shutter', 		options.shutterMax,		null);
    var apertureList = 	listEvs('aperture', 	options.apertureMin, 	options.apertureMax);
    var isoList = 		listEvs('iso', 			options.isoMax, 		options.isoMin);

    console.log("API setEv: shutterList.length", shutterList && shutterList.length);
    console.log("API setEv: apertureList.length", apertureList && apertureList.length);
    console.log("API setEv: isoList.length", isoList && isoList.length);

    if (shutterList && options && options.maxShutterLengthMs) {
        var maxSeconds = Math.floor(options.maxShutterLengthMs / 1000);
        if(maxSeconds < 1) maxSeconds = 1;
        shutterList = shutterList.filter(function(ev) {
            return api.getSecondsFromEv(ev) <= maxSeconds;
        });
    }

    if(!options.blendParams) lastParam = null;

    for (var trys = 0; trys < 3; trys++) {
        while (ev < currentEv - 1 / 4) {
            //console.log("ev < currentEv");
            var s = decEv(shutterEv, shutterList);
            if (apertureEnabled) var a = decEv(apertureEv, apertureList);
            var i = decEv(isoEv, isoList);

            if (!equalEv(shutterEv, s) && lastParam != 's') {
                shutterEv = s;
                if(options.blendParams) lastParam = 's';
            } else if (apertureEnabled && !equalEv(apertureEv, a) && lastParam != 'a') {
                apertureEv = a;
                if(options.blendParams) lastParam = 'a';
            } else if (!equalEv(isoEv, i) && lastParam != 'i') {
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

            if (!equalEv(isoEv, i) && lastParam != 'i') {
                isoEv = i;
                if(options.blendParams) lastParam = 'i';
            } else if (apertureEnabled && !equalEv(apertureEv, a) && lastParam != 'a') {
                apertureEv = a;
                if(options.blendParams) lastParam = 'a';
            } else if (!equalEv(shutterEv, s) && lastParam != 's') {
                shutterEv = s;
                if(options.blendParams) lastParam = 's';
            } else {
                lastParam = null;
                currentEv = api.getEv(shutterEv, apertureEv, isoEv);
                break;
            }
            currentEv = api.getEv(shutterEv, apertureEv, isoEv);
            //console.log(" update: ", currentEv);
        }

        if (Math.abs(ev - currentEv) <= 1 / 4) break;

    }


    console.log("API setEv: current:", origEv, "target:", ev, "new:", currentEv);

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



console.log("ready");

module.exports = api;
