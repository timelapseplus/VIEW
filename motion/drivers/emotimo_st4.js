var EventEmitter = require("events").EventEmitter;
var SerialPort = require('serialport');

var st4 = new EventEmitter();

var _port = null;
var _readFunc = null;

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

function _write(cmd, args, callback) {
	var params = [];
	for(var key in args) {
		if(args.hasOwnProperty(key)) {
			params.push(key.toUpperCase() + args[key].toString());
		}
	}
	cmd = (cmd.toUpperCase() + ' ' + params.join(' ')).trim() + '\n';
    _port.write(cmd, function(err) {
        _port.drain(function() {
            callback && callback(err);
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
        	if(indexOf)
            console.log("ST4 received: ", data);
            if(_readFunc) {
            	_readFunc(data.toString('UTF8'));
            	_readFunc = null;
            }
        });

        console.log("ST4: checking positions...");
        st4.getPosition(function(){
		    st4.emit("status", st4.getStatus());
			console.log("ST4: status:", st4.status);
        });
        if (callback) callback(true);
    });
}

function _waitRunning(motorId, callback) {
	setTimeout(function(){
		st4.getPosition(function(err) {
			if(err) return callback && callback(err);
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

function _read(callback) {
	var handle = setTimeout(function() {
		_readFunc = null;
		callback && callback("timeout");
	}, 500);
	_readFunc = function(data) {
		clearTimeout(handle);
		callback && callback(null, data);
	}
}


st4.getPosition = function(callback) {
	_write('G500', [], function(err) {
		_read(function(err, data) {
			if(!err) {
				var parts = data.split(' ');
				if(parts && parts.length > 1) {
					var movingSet = parts[0];
					var locationSet = parts[1].split(',');
					st4.status.motor1moving = parseInt(movingSet.substring(0, 0)) > 0;
					st4.status.motor2moving = parseInt(movingSet.substring(1, 1)) > 0;
					st4.status.motor3moving = parseInt(movingSet.substring(2, 2)) > 0;
					st4.status.motor4moving = parseInt(movingSet.substring(3, 3)) > 0;
					st4.status.motor1pos = parseInt(locationSet[0]);
					st4.status.motor2pos = parseInt(locationSet[1]);
					st4.status.motor3pos = parseInt(locationSet[2]);
					st4.status.motor4pos = parseInt(locationSet[3]);
					console.log("ST4: status:", st4.status);
				}
			}
			callback && callback(err, st4.status.motor1pos, st4.status.motor2pos, st4.status.motor3pos, st4.status.motor4pos);
		});
	});
}

st4.setPosition = function(motorId, position, callback) {
	var args = {};
	args['M'] = parseInt(motorId);
	args['P'] = parseInt(position);
	_write('G200', args, callback);
}

st4.move = function(motorId, steps, callback) {
	var args = {};
	args[_motorName(motorId)] = parseInt(steps);
	_write('G2', args, function(err) {
		if(err) return callback && callback(err);
		_waitRunning(motorId, callback);
	});
}

st4.constantMove = function(motorId, speed, callback) {
	speed /= 100;
	if(speed > 1) speed = 1;
	if(speed < -1) speed = -1;
	var rate = speed * 100000;
	var args = {};
	args['M'] = parseInt(motorId);
	args['V'] = parseInt(rate);
	_write('G300', args, function(err) {
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

