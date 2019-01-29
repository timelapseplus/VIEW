var EventEmitter = require("events").EventEmitter;
var SerialPort = require('serialport');

var st4 = new EventEmitter();

var port = null;
var buf = null;

st4.connected = false;

function _parseIncoming() {

}

function _write(cmd, args, callback) {
	var params = [];
	for(var key in args) {
		if(args.hasOwnProperty(key)) {
			params.push(key.toUpperCase() + args[key].toString());
		}
	}
	cmd = (cmd.toUpperCase() + ' ' + params.join(' ')).trim() + '\n';
    port.write(cmd, function(err) {
        port.drain(function() {
            callback && callback(err);
        });
    })
}

function _motorName(motorId) {
	var axes = ['X', 'X', 'Y', 'Z', 'W'];
	return(axes[motorId])
}

st4.getStatus = function() {
	return {};
}

st4.connect = function(path, callback) {
    console.log("ST4: connecting via " + path);
    port = new SerialPort(path, {
        baudrate: 57600
    }, function() {
        console.log('ST4: serial opened');
        if (!port) return;
        st4.connected = true;

        port.once('disconnect', function(err) {
            if (err && port && st4.connected) {
                port = null;
                st4.emit("status", st4.getStatus());
                console.log("ST4: ERROR: ST4 Disconnected: ", err);
            }
        });
        port.once('error', function(err) {
            console.log("ST4: ERROR: ", err);
        });
        port.once('close', function() {
            console.log("ST4: CLOSED");
        });

        port.on('data', function(data) {
            //console.log("ST4 received: ", data);
            console.log("ST4 buf: ", buf);
            if (buf && buf.length > 0) {
                buf = Buffer.concat([buf, data]);
            } else {
                buf = data;
            }
            _parseIncoming();
        });

        st4.getPosition();
        if (callback) callback(true);
    });
}

function _waitRunning(callback) {

}

st4.getPosition = function(callback) {
	_write('G500', [], function(err) {
		callback && callback(err);
	});
}

st4.setPosition = function(motorId, position, callback) {
	var args = {};
	args[_motorName(motorId)] = position;
	_write('G200', args, callback);
}

st4.move = function(motorId, steps, callback) {
	var args = {};
	args[_motorName(motorId)] = steps;
	_write('G2', args, function(err) {
		if(err) return callback && callback(err);
	});
}

st4.constantMove = function(axis, speed) {
	speed /= 100;
	if(speed > 1) speed = 1;
	if(speed < -1) speed = -1;
	var rate = speed * 100000;
	var args = {};
	args[_motorName(motorId)] = rate;
	_write('G300', args, function(err) {
		if(err) return callback && callback(err);
	});
}

st4.disconnect = function(cb) {
    st4.connected = false;
    port.close(function() {
        port = null;
        cb && cb();
    });
}

module.exports = st4;

