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
motion.gm = new GenieMini();

motion.move = function(driver, motorId, steps, callback) {
	if(driver == "NMX") {
		nmx.move(motorId, steps, callback);
	} else if(driver == "GM") {
		gm.move(motorId, steps, callback);
	}
}

motion.joystick = function(driver, motorId, speed, callback) {
	if(driver == "NMX") {
		nmx.constantMove(motorId, steps, callback);
	} else if(driver == "GM") {
		gm.constantMove(motorId, steps, callback);
	}
}

motion.zero = function(driver, motor, callback) {
	if(driver == "NMX") {
		nmx.resetMotorPosition(motorId, callback);
	} else if(driver == "GM") {
		gm.resetMotorPosition(motorId, callback);
	}
}

function updateStatus() {
	var nmxStatus = motion.nmx.getStatus();
	var gmStatus = motion.gm.getStatus();

    var available = (nmxStatus.connected || gmStatus.connected) && (nmxStatus.motor1 || nmxStatus.motor2 || nmxStatus.motor2 || gmStatus.motor1);
    var motors = [];

	console.log("motion.status: " , available, ", NMX: ", nmxStatus.connected, ", GM:", gmStatus.connected);

    motors.push({driver:'NMX', motor:1, connected:nmxStatus.motor1, position:nmxStatus.motor1pos, unit: 'steps'});
    motors.push({driver:'NMX', motor:2, connected:nmxStatus.motor2, position:nmxStatus.motor2pos, unit: 'steps'});
    motors.push({driver:'NMX', motor:3, connected:nmxStatus.motor3, position:nmxStatus.motor3pos, unit: 'steps'});
    motors.push({driver:'GM', motor:1, connected:gmStatus.motor1, position:gmStatus.motor1pos, unit: '°'});
    motion.status = {
    	reload: lastStatus.bluetooth,
        available: available,
        motors: motors
    };
    if(available || lastStatus.available) {
	    motion.emit('status', motion.status);
    }
    lastStatus = motion.status;
    lastStatus.bluetooth = nmxStatus.connectionType == 'bt' || gmStatus.connectionType == 'bt';
}

motion.nmx.on('status', function(status) {
    updateStatus()
});
motion.gm.on('status', function(status) {
	updateStatus()
});

module.exports = motion;