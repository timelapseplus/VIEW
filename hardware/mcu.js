var EventEmitter = require("events").EventEmitter;
var exec = require('child_process').exec;
var SerialPort = require('serialport');
var _ = require('underscore');
var geoTz = require('geo-tz');
var GPS = require('gps');
var gps = new GPS;
var MCU_VERSION = 1;


var mcu = new EventEmitter();

mcu.ready = null;
mcu.gpsAvailable = false;
mcu.gps = gps.state;
mcu.lastGpsFix = null;
mcu.knob = 0;

mcu.init = function(callback) {
	_connectSerial('/dev/ttyS1', function(err, version) {
		if(!err && version) {
			mcu.ready = false;
			callback && callback(err);
		} else {
			mcu.ready = true;
			callback && callback(null, version);
		}
	});
}

function _getVersion(callback) {
	_send('V', function(err) {
		setTimeout(function() {
			callback && callback(err, mcu.version);
		}, 1000);
	});
}

function _programMcu(callback) {
	console.log("progamming MCU...");
	exec("/usr/bin/test -e /home/view/current/firmware/mcu.hex && /usr/local/bin/avrdude -C /etc/avrdude.conf -P gpio -c gpio0 -p t841 -U lfuse:w:0xc2:m && /usr/local/bin/avrdude -C /etc/avrdude.conf -P gpio -c gpio0 -p t841 -e && /usr/local/bin/avrdude -C /etc/avrdude.conf -P gpio -c gpio0 -p t841 -U flash:w:/home/view/current/firmware/mcu.hex:i", function(err) {
		callback && callback(err);
	});
}

var gpsFix = null;
function _parseData(data) {
	try {
		data = data.toString();
		if(data.substr(0, 1) == 'V') {
			var version = parseInt(data.substr(1, 2));
			mcu.version = version;
		} else if(data.substr(0, 1) == '$') {
			gps.update(data);
			if(gps.state.fix && gps.state.lat !== null && gps.state.lon !== null) {
				mcu.lastGpsFix = _.clone(gps.state);
				if(!gpsFix) {
					var tz = geoTz.tz(mcu.lastGpsFix.lat, mcu.lastGpsFix.lon);
					if(tz && process.env.TZ != tz) {
						process.env.TZ = tz;
						mcu.emit('timezone', tz);
					}
				}
			}
			if(!mcu.gpsAvailable) {
				mcu.gpsAvailable = true;
				mcu.emit('gps', 1);
			}
			if(gps.state.fix != gpsFix) {
				mcu.emit('gps', gps.state.fix ? 2 : 1);
				gpsFix = gps.state.fix;
			}
		} else if(data.substr(0, 1) == 'K') {
			var knob = parseInt(data.substr(2, 1));
			if(data.substr(1, 1) == '-') knob = 0 - knob;
			mcu.knob += knob;
			mcu.emit('knob', knob);
			//console.log(mcu.knob);
		}
	} catch(e) {
		console.log("Error while parsing MCU data", e);
	}
}

var _send = function(data, callback) {
	callback && callback("not connected");
}

function _connectSerial(path, callback) {
    var port = new SerialPort(path, {
        baudrate: 38400,
        parser: SerialPort.parsers.readline('\r\n')
    }, function() {
        console.log('MCU Serial Opened');
        
        port.on('data', function(data) {
        	//console.log("MCU Data: ", data);
        	_parseData(data);
        });

        _send = function(data, cb) { 
        	port.write(data, function(err) {
	            port.drain(function() {
	                cb && cb(err);
	            });
	        });
        }

        _getVersion(function(err, version) {
        	if(version != 1) {
        		_programMcu(function(err) {
			        _getVersion(function(err, version) {
			        	if(err || version != MCU_VERSION) {
			        		callback && callback("unable to connect to MCU");
			        	} else {
			        		callback && callback(err, version);
			        	}
			        });
        		});
        	} else {
        		callback && callback(err, version);
        	}
        });
    });
}

module.exports = mcu;

