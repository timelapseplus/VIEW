var EventEmitter = require("events").EventEmitter;
var SerialPort = require('serialport');

var st4 = new EventEmitter();

var _port = null;
var _buf = "";


st4.connected = false;
st4.busy = false;
st4.joystickMode = false;
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
function _conversionFactor(motorId) {
	if(motorId == 1) return 3275.420875;
	if(motorId == 2) return 8680.968858;
	return 1;
}

function _motorDirection(motorId) {
	if(motorId == 2) return -1;
	return 1;
}

function _transaction(cmd, args, callback) {
	if(!_port) return callback && callback("not connected");
	st4.busy = true;
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
				st4.busy = false;
			}, 100);
        });
    })
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
        startPoll();

        _port.once('disconnect', function(err) {
            if (err && _port && st4.connected) {
            	stopPoll();
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

var pollHandle = null;
function startPoll() {
	pollHandle = setInterval(function() {
		if(!st4.busy && !st4.joystickMode) {
			var p1 = st4.status.motor1pos;
			var p2 = st4.status.motor2pos;
			var p3 = st4.status.motor3pos;
			var p4 = st4.status.motor4pos;
			st4.getPosition(function() {
				if(p1 != st4.status.motor1pos || p2 != st4.status.motor2pos || p3 != st4.status.motor3pos || p4 != st4.status.motor4pos) {
				    st4.emit("status", st4.getStatus());
				}
			});
		} else {
			if(st4.busy) console.log("ST4: busy = true");
			if(st4.joystickMode) console.log("ST4: joystickMode = true");
		}
	}, 1000);
}
function stopPoll() {
	if(pollHandle) clearInterval(pollHandle);
	pollHandle = null;
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
					if(parseInt(locationSet[0]) !== NaN) st4.status.motor1pos = parseInt(locationSet[0]) / _conversionFactor(1);
					if(parseInt(locationSet[1]) !== NaN) st4.status.motor2pos = parseInt(locationSet[1]) / _conversionFactor(2);
					if(parseInt(locationSet[2]) !== NaN) st4.status.motor3pos = parseInt(locationSet[2]) / _conversionFactor(3);
					if(parseInt(locationSet[3]) !== NaN) st4.status.motor4pos = parseInt(locationSet[3]) / _conversionFactor(4);
					st4.status.moving = st4.status.motor1moving || st4.status.motor2moving || st4.status.motor3moving || st4.status.motor4moving;
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
		args['P'] = parseInt(position * _conversionFactor(motorId));
		_transaction('G200', args, function() {
			_waitRunning(motorId, callback);
		});
	});
}

st4.move = function(motorId, steps, callback) {
	var args = {};
	args[_motorName(motorId)] = parseInt(steps * _conversionFactor(motorId) * _motorDirection(motorId));
	_transaction('G2', args, function(err) {
		if(err) return callback && callback(err);
		_waitRunning(motorId, callback);
	});
}

var watchdogHandle = null;
st4.constantMove = function(motorId, speed, callback) {
	if(speed) {
		if(st4.busy) return;
		if(st4.joystickMode && watchdogHandle) return; // wait until stop request is complete
		st4.joystickMode = true;
	}
	speed *= _motorDirection(motorId);
	if(watchdogHandle) {
		clearTimeout(watchdogHandle);
		watchdogHandle = null;
	}
	if(speed) watchdogHandle = setTimeout(function(){
		st4.constantMove(motorId, 0);
	}, 1200);
	speed /= 100;
	if(speed > 1) speed = 1;
	if(speed < -1) speed = -1;
	var sign = speed < 0 ? -1 : 1;
	var rate = Math.pow(speed, 2.0) * 200000 * sign; // add curve for finer control
	//console.log("ST4: moving at speed ", speed, ", steps: ", rate);
	var args = {};
	args['M'] = parseInt(motorId);
	args['V'] = parseInt(rate);
	_transaction('G300', args, function(err) {
		if(err) return callback && callback(err);
		if(speed == 0) {
			_waitRunning(motorId, function(err, pos) {
				callback && callback(err, pos);
				st4.joystickMode = false;
			});
		}
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

