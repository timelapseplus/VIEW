
/****************************************************************************
 LICENSE: CC BY-NC-SA 4.0 https://creativecommons.org/licenses/by-nc-sa/4.0/
 This is an original driver by Elijah Parker <mail@timelapseplus.com>
 It is free to use in other projects for non-commercial purposes.  For a
 commercial license and consulting, please contact mail@timelapseplus.com
*****************************************************************************/

var util = require('util');
var EventEmitter = require('events').EventEmitter;
var usb = require('usb');

var DRIVERS = [];
DRIVERS.push(require('./drivers/fuji.js'));

function CameraAPI(driver) {
	this._driver = driver;

	this.exposure = {
		shutter: null,
		aperture: null,
		iso: null,
		shutterList: [],
		apertureList: [],
		isoList: []
	}
	this.status = { // read only
		busy: null,
		recording: null,
		remaining: null,
		battery: null,
		focusPos: null
	}
	this.config = { // can be set via CameraAPI.set()
		format: null,
		liveview: null,
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
	console.log("ATTACHED:", device);
	//let camera = utils.open(device);
	//utils.init(camera);
});

usb.on('detach', function(device) { 
	console.log("DETACHED:", device);
});



CameraAPI.prototype.set = function(parameter, value, callback) {
	return this._driver.set(this._dev, parameter, value, callback);
}

CameraAPI.prototype.capture = function(target, options, callback) {
	if(typeof options == 'function' && callback == undefined) {
		callback = options;
		options = {};
	}
	return this._driver.capture(this._dev, target, options, callback);
}

CameraAPI.prototype.liveviewMode = function(enable, callback) {
	if(!this.supports.liveview) return callback && callback("not supported");
	if(this.config.liveview === enable) return callback && callback();
	return this._driver.liveviewMode(this._dev, enable, callback);
}

CameraAPI.prototype.liveviewImage = function(enable, callback) {
	if(!this.supports.liveview) return callback && callback("not supported");
	if(!this.config.liveview) return callback && callback("not enabled");
	return this._driver.liveviewImage(this._dev, callback);
}

CameraAPI.prototype.moveFocus = function(steps, resolution, callback) {
	if(!this.supports.focus) return callback && callback("not supported");
	return this._driver.moveFocus(this._dev, enable, callback);
}

function buildConnectFunction(driver, device) {
	var camera = new CameraAPI(driver);
	return function(device) {
		device.open();
		var iface = device.interfaces[0];
		iface.claim();
		var cam = {
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
				camera._driver._event(camera._dev, data);
			});
		}
		return camera;
	}
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
					name: DRIVERS[i].supportedCameras[id].name
				}
			}
		}
	}
	return null;
}

exports.listCameras = function() {
	var cameras = [];
	var devices = usb.getDeviceList();
	for(var i = 0; i < devices.length; i++) {
		var camera = matchDriver(devices[i]);
		if(camera) {
			cameras.push({
				name: camera.name,
				connect: buildConnectFunction(camera.driver, devices[i])
			});
		}
	}
	return cameras;
}

console.log(exports.listCameras);
