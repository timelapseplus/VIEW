var TSL2561 = require('sensor_tsl2561');

var integrationCount = 60;
var light = {};
light.lux = null;
light.active = false;

var opts = {
    address: 0x29,
    device: '/dev/i2c-2'
}

var readings = new Array(integrationCount);
var sense = new TSL2561(opts);
var timer = null;

var log2 = Math.log2 || function(x) {
    return Math.log(x) / Math.LN2;
};

light.start = function(cb) {
    if (timer) clearInterval(timer);
    if (light.active) light.active = false;
    sense.init(function(err, val) {
        if (!err) {
            timer = setInterval(function() {
                sense.getLux(function(error, val) {
                    if (error) {
                        //console.log("Error reading: ", error);
                        val = 0;
                    }
                    if (!light.active) {
                        light.active = true;
                        if (cb) cb(error);
                        for (var i = 0; i < readings.length; i++) readings[i] = val;
                    } else {
                        for (var i = 0; i < readings.length - 1; i++) readings[i] = readings[i + 1];
                    }
                    light.lux = val;
                    readings[readings.length - 1] = val;
                });
            }, 2000)
        } else {
            console.log("Error initializing: ", err);
            if (cb) cb(err);
        }
    });
}

light.stop = function(cb) {
    light.active = false;
    if (timer) clearInterval(timer);
    if (cb) cb();
}

light.integratedLux = function() {
    if (!light.active) return null;
    var sum = 0;
    for (var i = 0; i < readings.length; i++) sum += readings[i];
    return sum / readings.length;
}

function lux2ev(lux) {
    return log2(lux / 2.5);
}

light.ev = function() {
    if (!light.active) return null;
    return lux2ev(light.lux);
}

light.integratedEv = function() {
    if (!light.active) return null;
    return lux2ev(light.integratedLux);
}

module.exports = light;
