var EventEmitter = require("events").EventEmitter;
var SerialPort = require('serialport');

var st4 = new EventEmitter();

var _port = null;
var _buf = "";

st4.connected = false;
st4.status = {
	motor1moving: false,
	motor2moving: false,
	motor3moving: false,
	motor4moving: false,
	motor1pos: 0,
	motor2pos: 0,
	motor3pos: 0,
	motor4pos: 0
}
function _parseIncoming(data) {

}

function _transaction(cmd, args, callback) {
	if(!_port) return callback && callback("not connected");
	var params = [];
	for(var key in args) {
		if(args.hasOwnProperty(key)) {
			params.push(key.toUpperCase() + args[key].toString());
		}
	}
	cmd = (cmd.toUpperCase() + ' ' + params.join(' ')).trim() + '\n';
    _port.write(cmd, function(err) {
		_buf = "";
        _port.drain(function() {
			var handle = setTimeout(function() {
				if(_buf.length > 0) {
					callback && callback(err, _buf);
				} else {
					callback && callback(err || "timeout");
				}
			}, 100);
        });
    })
}


function _read(callback) {
}

function _motorName(motorId) {
	var axes = ['X', 'X', 'Y', 'Z', 'W'];
	return(axes[motorId])
}

st4.getStatus = function() {
	st4.status.connected = st4.connected;
	return st4.status;
}


st4.connect = function(path, callback) {
    if (path && typeof path == "string") {
        _connect(path, callback);
    } else if (!path || typeof path == "function") {
        SerialPort.list(function(err, ports) {
            console.log("ST4: scanned serial ports");
            for (var i = 0; i < ports.length; i++) {
                if (ports[i].manufacturer == 'FTDI') {
                    _connect(ports[i].comName, callback)
                    return;
                }
            }
            if (callback) callback("no device found");
        });
    } else {
        if (callback) callback("invalid device");
    }
}

function _connect(path, callback) {
    console.log("ST4: connecting via " + path);
    _port = new SerialPort(path, {
        baudrate: 57600
    }, function() {
        console.log('ST4: serial opened');
        if (!_port) return;
        st4.connected = true;

        _port.once('disconnect', function(err) {
            if (err && _port && st4.connected) {
                _port = null;
                st4.connected = false;
                st4.emit("status", st4.getStatus());
                console.log("ST4: ERROR: ST4 Disconnected: ", err);
            }
        });
        _port.once('error', function(err) {
            console.log("ST4: ERROR: ", err);
        });
        _port.once('close', function() {
            console.log("ST4: CLOSED");
        });

        _port.on('data', function(data) {
        	data = data.toString('UTF8');
            console.log("ST4: received data: ", data);
			_buf += data;
        });

        console.log("ST4: checking positions...");
        st4.getPosition(function(){
		    st4.emit("status", st4.getStatus());
			console.log("ST4: status:", st4.status);
        });
        if (callback) callback(true);
    });
}

function _waitRunning(motorId, callback, errCount) {
	setTimeout(function(){
		st4.getPosition(function(err) {
			if(err) {
				if(errCount == undefined) {
					errCount = 0;
				} else if(errCount > 5) {
					return callback && callback(err);
				}
				errCount++;
				return _waitRunning(motorId, callback);
			}
			if(motorId == 0 && !(st4.status.motor1moving || st4.status.motor2moving || st4.status.motor3moving || st4.status.motor4moving) ) {
				return callback && callback();
			} else if(motorId == 1 && !(st4.status.motor1moving) ) {
				return callback && callback(null, st4.status.motor1pos);
			} else if(motorId == 2 && !(st4.status.motor2moving) ) {
				return callback && callback(null, st4.status.motor2pos);
			} else if(motorId == 3 && !(st4.status.motor3moving) ) {
				return callback && callback(null, st4.status.motor3pos);
			} else if(motorId == 4 && !(st4.status.motor4moving) ) {
				return callback && callback(null, st4.status.motor4pos);
			}
			_waitRunning(motorId, callback);
		});
	}, 100);
}


st4.getPosition = function(callback) {
	_transaction('G500', [], function(err, data) {
		if(!err) {
			var parts = data.split(' ');
			if(parts && parts.length > 1) {
				var movingSet = parts[0];
				var locationSet = parts[1].split(',');
				if(movingSet && movingSet.length == 4 && locationSet && locationSet.length == 4) {
					st4.status.motor1moving = parseInt(movingSet.substring(0, 1)) > 0;
					st4.status.motor2moving = parseInt(movingSet.substring(1, 2)) > 0;
					st4.status.motor3moving = parseInt(movingSet.substring(2, 3)) > 0;
					st4.status.motor4moving = parseInt(movingSet.substring(3, 4)) > 0;
					st4.status.motor1pos = parseInt(locationSet[0]);
					st4.status.motor2pos = parseInt(locationSet[1]);
					st4.status.motor3pos = parseInt(locationSet[2]);
					st4.status.motor4pos = parseInt(locationSet[3]);
				}
				console.log("ST4: status:", st4.status);
			}
		}
		callback && callback(err, st4.status.motor1pos, st4.status.motor2pos, st4.status.motor3pos, st4.status.motor4pos);
	});
}

st4.setPosition = function(motorId, position, callback) {
	_waitRunning(motorId, function() {
		var args = {};
		args['M'] = parseInt(motorId);
		args['P'] = parseInt(position);
		_transaction('G200', args, function() {
			_waitRunning(motorId, callback);
		});
	});
}

st4.move = function(motorId, steps, callback) {
	var args = {};
	args[_motorName(motorId)] = parseInt(steps);
	_transaction('G2', args, function(err) {
		if(err) return callback && callback(err);
		_waitRunning(motorId, callback);
	});
}

st4.constantMove = function(motorId, speed, callback) {
	speed /= 100;
	if(speed > 1) speed = 1;
	if(speed < -1) speed = -1;
	var rate = Math.pow(speed, 2.5) * 500000; // add curve for finer control
	var args = {};
	args['M'] = parseInt(motorId);
	args['V'] = parseInt(rate);
	_transaction('G300', args, function(err) {
		if(err) return callback && callback(err);
		if(speed == 0) _waitRunning(motorId, callback);
	});
}

st4.disconnect = function(cb) {
    st4.connected = false;
    _port.close(function() {
        _port = null;
        cb && cb();
    });
}

module.exports = st4;

