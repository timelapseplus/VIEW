var EventEmitter = require("events").EventEmitter;
require('rootpath')();
var nmx = require('motion/drivers/nmx.js');
var GenieMini = require('motion/drivers/genie_mini.js');

var motion = new EventEmitter();

motion.status = {
	motors: [],
	available: false
}

motion.nmx = nmx;
motion.gm = new GenieMini();

motion.move = function() {

}

motion.joystick = function() {

}

motion.zero = function(driver, motor, callback) {
	if(driver == "NMX") {
		nmx.resetMotorPosition(motorId, callback);
	} else if(driver == "GM") {
		gm.resetMotorPosition(motorId, callback);
	}
}

function updateStatus() {
	var nmxStatus = nmx.getStatus();
	var gmStatus = gm.getStatus();

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
    motion.emit('status', motion.status);
}

motion.nmx.on('status', function(status) {
    updateStatus()
});
motion.gm.on('status', function(status) {
	updateStatus()
});

module.exports = motion;