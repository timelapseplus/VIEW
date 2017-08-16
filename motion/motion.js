var EventEmitter = require("events").EventEmitter;
require('rootpath')();
var nmx = require('motion/drivers/nmx.js');
var GenieMini = require('motion/drivers/genie_mini.js');

var motion = new EventEmitter();

motion.status = {
	motors: [],
	available: false
}
var lastStatus = motion.status;

motion.nmx = nmx;
motion.gm1 = new GenieMini();
motion.gm2 = new GenieMini();

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

motion.status = function(callback) {
	var nmxStatus = motion.nmx.getStatus();
	if(nmxStatus.connected) {
		motion.nmx.checkMotorAttachment();
	}
    updateStatus()
    callback && callback(motion.status);
}

function updateStatus() {
	var nmxStatus = motion.nmx.getStatus();
	var gm1Status = motion.gm1.getStatus();
	var gm2Status = motion.gm2.getStatus();

    var available = (nmxStatus.connected || gm1Status.connected || gm2Status.connected) && (nmxStatus.motor1 || nmxStatus.motor2 || nmxStatus.motor2 || gm1Status.motor1 || gm2Status.motor1);
    var motors = [];

	console.log("motion.status: " , available, ", NMX: ", nmxStatus.connected, ", GM1:", gm1Status.connected, ", GM2:", gm2Status.connected);

    motors.push({driver:'NMX', motor:1, connected:nmxStatus.motor1 && nmxStatus.connected, position:nmxStatus.motor1pos, unit: 'steps'});
    motors.push({driver:'NMX', motor:2, connected:nmxStatus.motor2 && nmxStatus.connected, position:nmxStatus.motor2pos, unit: 'steps'});
    motors.push({driver:'NMX', motor:3, connected:nmxStatus.motor3 && nmxStatus.connected, position:nmxStatus.motor3pos, unit: 'steps'});
    motors.push({driver:'GM', motor:1, connected:gm1Status.motor1 && gm1Status.connected, position:gm1Status.motor1pos, unit: '°'});
    motors.push({driver:'GM', motor:2, connected:gm2Status.motor1 && gm2Status.connected, position:gm2Status.motor1pos, unit: '°'});
    motion.status = {
    	nmxConnectedBt: nmxStatus.connected ? 1 : 0,
    	gmConnectedBt: (gm1Status.connected ? 1 : 0) + (gm2Status.connected ? 1 : 0),
    	reload: lastStatus.bluetooth,
        available: available,
        motors: motors
    };
    if(available || lastStatus.available) {
	    motion.emit('status', motion.status);
    }
    lastStatus = motion.status;
    lastStatus.bluetooth = nmxStatus.connectionType == 'bt' || gm1Status.connectionType == 'bt' || gm2Status.connectionType == 'bt';
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