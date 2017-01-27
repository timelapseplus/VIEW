var exec = require('child_process').exec;
var SerialPort = require('serialport');
var gps = require('gps');

var MCU_VERSION = 1;

var mcu = {
	ready: null,
	gps: gps.state,
	knob: 0
};

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

mcu.init();

function _getVersion(callback) {
	_send('V', function(err) {
		setTimeout(function() {
			callback && callback(err, mcu.version);
		}, 500);
	});
}

function _programMcu(callback) {
	console.log("progamming MCU...");
	//exec("/usr/local/bin/avrdude -C /etc/avrdude.conf -P gpio -c gpio0 -p t841 -U lfuse:w:0xc2:m && /usr/local/bin/avrdude -C /etc/avrdude.conf -P gpio -c gpio0 -p t841 -e && /usr/local/bin/avrdude -C /etc/avrdude.conf -P gpio -c gpio0 -p t841 -U flash:w:main.hex:i", function(err) {
	//	callback && callback(err);
	//});
}

function _parseData(data) {
	data = data.toString();
	if(data.substr(0, 1) == 'V') {
		var version = parseInt(data.substr(1, 2));
		mcu.version = version;
	} else if(data.substr(0, 1) == '$') {
		gps.update(data);
		console.log(gps.state);
	} else if(data.substr(0, 1) == 'K') {
		var knob = parseInt(data.substr(2, 1));
		if(data.substr(1, 1) == '-') knob = 0 - knob;
		mcu.knob += knob;
		console.log(knob);
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

