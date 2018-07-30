var EventEmitter = require("events").EventEmitter;
require('rootpath')();
var nmx = require('motion/drivers/nmx.js');
var GenieMini = require('motion/drivers/genie_mini.js');
var async = require('async');
var nodeimu = require('nodeimu');
var IMU = false;
try {
	IMU = new nodeimu.IMU();
} catch(e) {
	console.log("ERROR: cannot connect to IMU!");
}

var motion = new EventEmitter();

motion.status = {
	motors: [],
	available: false
}
var lastStatus = motion.status;

motion.nmx = nmx;
motion.gm1 = new GenieMini(1);
motion.gm2 = new GenieMini(2);

motion.calibrateBacklash = function(driver, motorId, callback) {
	var steps = (driver == 'NMX') ? 1000 : 2.0;
	var dec = (driver == 'NMX') ? 4 : 0.01;

	var gyroThreshold = 0.2;
	var accelThreshold = 1.5;

	if(!IMU) return callback && callback("unable to access IMU");

	var stop = false;
	var detectMove = function(cb) {
		stop = false;
		var processData = function(err, data) {
			if(!err && data) {
				var gyro = Math.abs(data.gyro.x) + Math.abs(data.gyro.y) + Math.abs(data.gyro.z);
				var accel = Math.abs(data.accel.x) + Math.abs(data.accel.y) + Math.abs(data.accel.z);
				//console.log("detecting move:", gyro, accel);
				if(gyro > gyroThreshold || accel > accelThreshold) {
					stop = true;
					console.log("---> move detected:", gyro, accel);
					return cb && cb(null, true);
				}
			} else {
				stop = true;
				return cb && cb(err || "no data available");
			}
			if(!stop) {
				IMU.getValue(processData);
			} else {
				return cb && cb(null, false);
			}
		}
		setTimeout(function() {
			IMU.getValue(processData);
		});
	}

	var tries = 0;
	var checkMove = function(direction, cb) {
		var moved = false;
		detectMove(function(err, move) {
			moved = move;
		});
		motion.move(driver, motorId, steps * direction, function(err, pos) {
			console.log("motion pos:", (pos));
			stop = true;
			setTimeout(function(){
				cb && cb(err, moved);
			}, 500);
		});
	}

	var doCycle = function(cb) {
		tries++;
		var moveRight = function(cb2) { checkMove(1, cb2); }
		var moveLeft = function(cb2) { checkMove(-1, cb2); }
		async.series([moveRight, moveLeft], function(err, results) {
			if(err) cb(err);
			var moved = results[0] || results[1];
			if(!moved) {
				if(tries == 1) cb("failed to detect motion");
				else(cb(null, steps));
			} else {
				steps -= dec;
				setTimeout(doCycle);
			}
		});
	}

	motion.move(driver, motorId, -(steps / 2), function(){
		doCycle(function(err, backlash){
			motion.move(driver, motorId, (steps / 2), function(){
				if(err) {
					console.log("calibration failed for", driver, "motor", motorId, ". Error:", err);
				} else {
					console.log("calibration complete for", driver, "motor", motorId, ". Backlash steps:", backlash);
					//motion.setMotorBacklash(motorId, driver, backlash);
				}
				callback && callback(err, backlash);
			})
		})
	});

}

motion.move = function(driver, motorId, steps, callback) {
	if(driver == "NMX") {
		motion.nmx.move(motorId, steps, callback);
	} else if(driver == "GM") {
		if(motorId == 2) {
			motion.gm2.move(motorId, steps, callback);
		} else {
			motion.gm1.move(motorId, steps, callback);
		}
	}
}

motion.joystick = function(driver, motorId, speed, callback) {
	if(driver == "NMX") {
		motion.nmx.constantMove(motorId, speed, callback);
	} else if(driver == "GM") {
		if(motorId == 2) {
			motion.gm2.constantMove(motorId, speed, callback);
		} else {
			motion.gm1.constantMove(motorId, speed, callback);
		}
	}
}

motion.zero = function(driver, motorId, callback) {
	if(driver == "NMX") {
		motion.nmx.resetMotorPosition(motorId, callback);
	} else if(driver == "GM") {
		if(motorId == 2) {
			motion.gm2.resetMotorPosition(motorId, callback);
		} else {
			motion.gm1.resetMotorPosition(motorId, callback);
		}
	}
}

motion.setPosition = function(driver, motorId, position, callback) {
	if(driver == "NMX") {
		motion.nmx.setMotorPosition(motorId, position, callback);
	} else if(driver == "GM") {
		if(motorId == 2) {
			motion.gm2.setMotorPosition(motorId, position, callback);
		} else {
			motion.gm1.setMotorPosition(motorId, position, callback);
		}
	}
}

motion.getPosition = function(driver, motorId) {
	updateStatus();
	for(var i = 0; i < motion.status.motors.length; i++) {
		var m = motion.status.motors[i];
		if(m.driver == driver && m.motor == motorId) {
			return m.position;
		}
	}
	return 0;
}

motion.getBacklash = function(driver, motorId, callback) {
	if(driver == "NMX") {
		motion.nmx.getMotorBacklash(motorId, callback);
	} else {
		if(motorId == 2) {
			motion.gm2.getMotorBacklash(motorId, callback);
		} else {
			motion.gm1.getMotorBacklash(motorId, callback);
		}
	}
}

motion.setBacklash = function(driver, motorId, backlashSteps, callback) {
	if(driver == "NMX") {
		motion.nmx.setMotorBacklash(motorId, backlashSteps, callback);
	} else {
		if(motorId == 2) {
			motion.gm2.setMotorBacklash(motorId, backlashSteps, callback);
		} else {
			motion.gm1.setMotorBacklash(motorId, backlashSteps, callback);
		}
	}
}

motion.refresh = function(callback) {
	var nmxStatus = motion.nmx.getStatus();
	if(nmxStatus.connected) {
		motion.nmx.checkMotorAttachment(function(){
		    updateStatus()
		    callback && callback(motion.status);
		});
	} else {
	    updateStatus()
	    callback && callback(motion.status);
	}
}

function updateStatus() {
	var nmxStatus = motion.nmx.getStatus();
	var gm1Status = motion.gm1.getStatus();
	var gm2Status = motion.gm2.getStatus();

    var available = (nmxStatus.connected || gm1Status.connected || gm2Status.connected) && (nmxStatus.motor1 || nmxStatus.motor2 || nmxStatus.motor2 || gm1Status.motor1 || gm2Status.motor1);
    var motors = [];

	console.log("motion.status: " , available, ", NMX: ", nmxStatus.connected, ", GM1:", gm1Status.connected, ", GM2:", gm2Status.connected);

    motors.push({driver:'NMX', motor:1, connected:nmxStatus.motor1 && nmxStatus.connected, position:nmxStatus.motor1pos, unit: 'steps', orientation: null});
    motors.push({driver:'NMX', motor:2, connected:nmxStatus.motor2 && nmxStatus.connected, position:nmxStatus.motor2pos, unit: 'steps', orientation: null});
    motors.push({driver:'NMX', motor:3, connected:nmxStatus.motor3 && nmxStatus.connected, position:nmxStatus.motor3pos, unit: 'steps', orientation: null});
    motors.push({driver:'GM', motor:1, connected:gm1Status.motor1 && gm1Status.connected, position:gm1Status.motor1pos, unit: '°', orientation: gm1Status.orientation});
    motors.push({driver:'GM', motor:2, connected:gm2Status.motor1 && gm2Status.connected, position:gm2Status.motor1pos, unit: '°', orientation: gm2Status.orientation});
    motion.status = {
    	nmxConnectedBt: nmxStatus.connected ? 1 : 0,
    	gmConnectedBt: (gm1Status.connected ? 1 : 0) + (gm2Status.connected ? 1 : 0),
    	reload: lastStatus.reloadBt ? true : false,
        available: available,
        motors: motors
    };
    if(available || lastStatus.available) {
	    motion.emit('status', motion.status);
    }
    lastStatus = motion.status;
    lastStatus.reloadBt = (nmxStatus.connectionType == 'bt' && nmxStatus.connected) || (gm1Status.connectionType == 'bt' && gm1Status.connected) || (gm2Status.connectionType == 'bt' && gm2Status.connected);
}

motion.nmx.on('status', function(status) {
    updateStatus()
});
motion.gm1.on('status', function(status) {
	updateStatus()
});
motion.gm2.on('status', function(status) {
	updateStatus()
});

module.exports = motion;