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

    var available = (nmxStatus.connected || gmStatus.connected) && (status.motor1 || status.motor2 || status.motor2 || gmStatus.motor1);
    var motors = [];
    motors.push({driver:'NMX', motor:1, connected:status.motor1, position:status.motor1pos, unit: 'steps'});
    motors.push({driver:'NMX', motor:2, connected:status.motor2, position:status.motor2pos, unit: 'steps'});
    motors.push({driver:'NMX', motor:3, connected:status.motor3, position:status.motor3pos, unit: 'steps'});
    motors.push({driver:'GM', motor:1, connected:status.motor1, position:status.motor1pos, unit: '°'});
    motion.status = {
        available: available,
        motors: motors
    };
    if(available || lastStatus.available) {
	    motion.emit('status', motion.status);
    }
    lastStatus = motion.status;
}

motion.nmx.on('status', function(status) {
    updateStatus()
});
motion.gm.on('status', function(status) {
	updateStatus()
});

module.exports = motion;