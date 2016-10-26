var EventEmitter = require("events").EventEmitter;
var exec = require('child_process').exec;

var power = new EventEmitter();

power.lightDisabled = false;
power.gpsEnabled = null;
power.wifiEnabled = true;

var powerControlBase = 0x17; // gps off, wifi off
var powerWifi = 0x40;
var powerGps = 0x8;

power.init = function(disableLight) {
    exec("sudo i2cset -y -f 0 0x34 0x34 0x57"); // set chgled to blink
    exec("sudo i2cset -y -f 0 0x34 0x33 0xdc"); // set charge rate to 1.5A
    exec("sudo i2cset -y -f 0 0x34 0x30 0x60"); // set system current limit to 900mA

    if(disableLight) {
        power.lightDisabled = true;
        exec("sudo i2cset -y -f 0 0x34 0x32 0x8"); // disable chgled
    } else {
        power.lightDisabled = false;
        exec("sudo i2cset -y -f 0 0x34 0x32 0x0"); // enable chgled
    }
}

function setPower() {
    var setting = powerControlBase;
    if(power.gpsEnabled) setting |= powerGps;
    if(power.wifiEnabled) setting |= powerWifi;
    exec("sudo i2cset -y -f 0 0x34 0x12 0x" + setting.toString(16)); // set power switches
}

power.gps = function(enable) {
    power.gpsEnabled = enable;
    setPower();
}

power.wifi = function(enable) {
    power.wifiEnabled = enable;
    setPower();
}

power.update = function(noEvents) {
    exec('/bin/sh /home/view/current/bin/battery.sh', function(error, stdout, stderr) {
        var charging = null;
        var percentage = null;

        lines = stdout.split('\n');
        for(var i = 0; i < lines.length; i++) {
            if(lines[i].indexOf('CHARG_IND') === 0) {
                var matches = lines[i].match(/=([0,1])/i);
                if(matches.length > 1) {
                    charging = parseInt(matches[1]) > 0;
                    //console.log("battery charging:", charging);
                }
            }
            if(lines[i].indexOf('Battery gauge') === 0) {
                var matches = lines[i].match(/= ([0-9]+)/i);
                if(matches.length > 1) {
                    percentage = parseInt(matches[1]);
                    if(percentage > 100) percentage = 100;
                    //console.log("battery percentage:", percentage);
                }
            }
        }

        if(charging !== null && charging != power.charging) {
            power.charging = charging;
            power.emit("charging", charging);
        }

        if(percentage !== null && percentage != power.percentage) {
            power.percentage = percentage;
            power.emit("percentage", percentage);
        }

    });

};

setInterval(power.update, 5000);

module.exports = power;