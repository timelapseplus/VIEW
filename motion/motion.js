var EventEmitter = require("events").EventEmitter;
require('rootpath')();
var nmx = require('motion/drivers/nmx.js');
var GenieMini = require('motion/drivers/genie_mini.js');
var db = require('system/db.js');

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
	available: false,
	calibrating: false
}
var lastStatus = motion.status;

motion.nmx = nmx;
motion.gm1 = new GenieMini(1);
motion.gm2 = new GenieMini(2);

motion.cancelCalibration = function(driver, motorId, callback) {
	motion.status.calibrating = false;
	callback && callback();
}

motion.calibrateBacklash = function(driver, motorId, callback) {
	var steps = (driver == 'NMX') ? 600 : 1.1;
	var dec = (driver == 'NMX') ? 12 : 0.025;

	var fusionReference = null;
	var fusionDiffReference = null;
	var accelThreshold = null;

	var origBacklash = 0;
	var preSamples = [];

	if(!IMU) return callback && callback("unable to access IMU");

	var stop = false;
	var detectMove = function(startMotorCb, moveCb) {
		stop = false;
		fusionReference = null;
		fusionDiffReference = null;
		accelThreshold = null;
		preSamples = [];
		var processData = function(err, data) {
			if(!err && data) {
				var fusion = data.fusionPose;
				var accel = Math.abs(data.accel.x) + Math.abs(data.accel.y) + Math.abs(data.accel.z);
				if((fusion.x == 0 && fusion.y == 0 && fusion.z == 0) || accel == 0) {
					return IMU.getValue(processData);
				}
				if(fusionReference === null || accelThreshold === null) {
					//console.log("baseline data for detecting move:", fusion);
					fusionReference = fusion;
					accelThreshold = accel * 1.05;
					return IMU.getValue(processData);
				}
				var fusionDiff = Math.abs(fusionReference.x - fusion.x) + Math.abs(fusionReference.y - fusion.y) + Math.abs(fusionReference.z - fusion.z);
				console.log("detecting move:", fusionDiff, fusion.x, fusion.y, fusion.z, accel);
				
				if(fusionDiffReference === null) {
					preSamples.push(fusionDiff);
					if(preSamples.length >= 10) {
						fusionDiffReference = Math.max((Math.max(preSamples) * 4), 0.002);
						startMotorCb && startMotorCb(null);
					}
					return IMU.getValue(processData);
				}

				if(fusionDiff > fusionDiffReference || accel > accelThreshold) {
					stop = true;
					console.log("---> move detected:", fusionDiff, accel);
					return moveCb && moveCb(null, true);
				}
			} else {
				stop = true;
				startMotorCb && startMotorCb(err || "no data available");
				return moveCb && moveCb(err || "no data available");
			}
			if(!stop) {
				return IMU.getValue(processData);
			} else {
				return moveCb && moveCb(null, false);
			}
		}
		setTimeout(function() {
			IMU.getValue(processData);
		});
	}

	var tries = 0;
	var checkMove = function(direction, cb) {
		var moved = false;
		if(!motion.status.calibrating) return cb && cb("calibration cancelled");
		detectMove(function(err) {
			if(err) {
				cb && cb(err);
			} else {
				motion.move(driver, motorId, steps * direction, function(err, pos) {
					if(err) {
						console.log("motion error:", (err));
					} else {
						console.log("motion pos:", (pos));
					}
					stop = true;
					setTimeout(function(){
						cb && cb(err, moved);
						cb = null;
					}, 500);
				});
			}
		}, function(err, move) {
			moved = move;
		});
	}

	var doCycle = function(cb) {
		tries++;
		var moveRight = function(cb2) { checkMove(1, cb2); }
		var moveLeft = function(cb2) { checkMove(-1, cb2); }
		async.series([moveRight, moveLeft], function(err, results) {
			if(err) return cb(err);
			var moved = results[0] || results[1];
			if(!moved) {
				if(tries == 1) return cb("failed to detect motion");
				return cb(null, steps);
			} else {
				steps -= dec;
				if(steps <= 0) {
					return cb("too much motion interference, failed to find backlash value");
				}
				if(motion.status.calibrating) {
					setTimeout(function(){doCycle(cb)});
				} else {
					return cb("calibration cancelled");
				}
			}
		});
	}

	var startCalibration = function() {
		motion.status.calibrating = true;
		motion.move(driver, motorId, -(steps / 2), function(){
			doCycle(function(err, backlashSteps){
				motion.move(driver, motorId, (steps / 2), function(){
					if(err) {
						console.log("calibration failed for", driver, "motor", motorId, ". Error:", err);
						motion.setBacklash(driver, motorId, origBacklash);
					} else {
						console.log("calibration complete for", driver, "motor", motorId, ". Backlash steps:", backlashSteps);
						motion.saveBacklash(driver, motorId, backlashSteps)
						motion.setBacklash(driver, motorId, backlashSteps);
					}
					motion.status.calibrating = false;
					callback && callback(err, backlashSteps);
				})
			})
		});
	}

	motion.getBacklash(driver, motorId, function(backlash){
		origBacklash = backlash || 0;
		motion.setBacklash(driver, motorId, 0, function(){
			startCalibration();
		});
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
	} else {
		callback && callback("invalid motion driver: " + driver);
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
	} else {
		callback && callback("invalid motion driver: " + driver);
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
	} else {
		callback && callback("invalid motion driver: " + driver);
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
	} else {
		callback && callback("invalid motion driver: " + driver);
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
	} else if(driver == "GM") {
		if(motorId == 2) {
			motion.gm2.getMotorBacklash(motorId, callback);
		} else {
			motion.gm1.getMotorBacklash(motorId, callback);
		}
	} else {
		callback && callback("invalid motion driver: " + driver);
	}
}

motion.setBacklash = function(driver, motorId, backlashSteps, callback) {
	if(driver == "NMX") {
		motion.nmx.setMotorBacklash(motorId, backlashSteps, callback);
	} else if(driver == "GM") {
		if(motorId == 2) {
			motion.gm2.setMotorBacklash(motorId, backlashSteps, callback);
		} else {
			motion.gm1.setMotorBacklash(motorId, backlashSteps, callback);
		}
	} else {
		callback && callback("invalid motion driver: " + driver);
	}
}

motion.saveBacklash = function(driver, motorId, backlashSteps, callback) {
	db.set(driver + motorId + '-backlash', backlashSteps, callback);
}

motion.loadBacklash = function(driver, motorId, callback) {
	db.get(driver + motorId + '-backlash', function(err, backlashSteps) {
		if(!err && backlashSteps != null) {
			motion.setBacklash(driver, motorId, backlashSteps, callback);
		} else {
			callback && callback(err);
		}
	});
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

    motors.push({driver:'NMX', motor:1, connected:nmxStatus.motor1 && nmxStatus.connected, position:nmxStatus.motor1pos, unit: 'steps', orientation: null, backlash: nmxStatus.motor1backlash});
    motors.push({driver:'NMX', motor:2, connected:nmxStatus.motor2 && nmxStatus.connected, position:nmxStatus.motor2pos, unit: 'steps', orientation: null, backlash: nmxStatus.motor2backlash});
    motors.push({driver:'NMX', motor:3, connected:nmxStatus.motor3 && nmxStatus.connected, position:nmxStatus.motor3pos, unit: 'steps', orientation: null, backlash: nmxStatus.motor3backlash});
    motors.push({driver:'GM', motor:1, connected:gm1Status.motor1 && gm1Status.connected, position:gm1Status.motor1pos, unit: '°', orientation: gm1Status.orientation, backlash: gm1Status.motor1backlash});
    motors.push({driver:'GM', motor:2, connected:gm2Status.motor1 && gm2Status.connected, position:gm2Status.motor1pos, unit: '°', orientation: gm2Status.orientation, backlash: gm2Status.motor1backlash});
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

motion.loadBacklash("NMX", 1);
motion.loadBacklash("NMX", 2);
motion.loadBacklash("NMX", 3);
motion.loadBacklash("GM", 1);
motion.loadBacklash("GM", 2);

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