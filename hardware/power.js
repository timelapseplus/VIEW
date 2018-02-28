var EventEmitter = require("events").EventEmitter;
var exec = require('child_process').exec;
var async = require('async');
var interpolate = require('../intervalometer/interpolate.js');

var power = new EventEmitter();

power.chargeLight = 'enabled';
power.gpsEnabled = 'enabled';
power.wifiEnabled = true;
power.autoOffMinutes = 10;
power.autoOffDisabled = false;

var powerControlBase = 0x17; // gps off, wifi off
var powerWifi = 0x40;
var powerGps = 0x8;

var BAT_AH = 3.3; // approximate actual battery capacity

var powerDownTimerHandle = null;

function axpSet(reg, val, callback) {
    reg = parseInt(reg);
    val = parseInt(val);
    if(reg != null && val != null) {
        exec("i2cset -y -f 0 0x34 0x" + reg.toString(16) + " 0x" + val.toString(16), callback);
    } else {
        callback('invalid parameters');
    }
}

function axpGet(reg, callback) {
    reg = parseInt(reg);
    if(reg != null) {
        exec("i2cget -y -f 0 0x34 0x" + reg.toString(16), function(err, stdout) {
            if(!err && stdout) {
                callback && callback(null, parseInt(stdout.trim()));
            } else {
                callback(err);
            }
        });
    } else {
        callback('invalid parameters');
    }
}

power.init = function(disableLight) {
    axpSet(0x81, 0xf9); // fix issue with wifi power on
    axpSet(0x34, 0x57); // set chgled to blink
    axpSet(0x33, 0xdc); // set charge rate to 1.5A
    axpSet(0x30, 0x60); // set system current limit to 900mA
    axpSet(0x82, 0xff); // enable ADC for battery monitoring

    if(disableLight) {
        power.chargeLight = 'disabled';
        axpSet(0x32, 0x8); // disable chgled
    } else {
        power.chargeLight = 'enabled';
        axpSet(0x32, 0x0); // enable chgled
    }
}

function setPower(callback) {
    var setting = powerControlBase;
    if(power.gpsEnabled != 'disabled') setting |= powerGps;
    if(power.wifiEnabled) setting |= powerWifi;
    console.log("setting power control to 0x" + setting.toString(16));
    axpSet(0x12, setting, callback); // set power switches
}

power.performance = function(mode, callback) {
    var voltFreq = {
        low: {
            voltage: 1.2,
            frequency: 384
        },
        medium: {
            voltage: 1.25,
            frequency: 432
        },
        high: {
            voltage: 1.3,
            frequency: 576 //624
        }
    }
    if(!voltFreq[mode]) mode = "medium";
    var config = voltFreq[mode];
    var voltReg = (config.voltage - 0.7) / 0.025;
    axpGet(0x27, function(err, val) {
        if(!err) {
            if(val > voltReg) {
                exec('cpufreq-set -u ' + config.frequency + 'MHz; cpufreq-set -f ' + config.frequency + 'MHz', function(err){
                    axpSet(0x27, voltReg, function() {
                        axpSet(0x23, voltReg, function() {
                            console.log("lowered system performance to", mode, err || "");
                            callback && callback(err);
                        });
                    });
                });
            } else if(val < voltReg) {
                axpSet(0x27, voltReg, function() {
                    axpSet(0x23, voltReg, function() {
                        exec('cpufreq-set -u ' + config.frequency + 'MHz; cpufreq-set -f ' + config.frequency + 'MHz', function(err){
                            console.log("increased system performance to", mode, err || "");
                            callback && callback(err);
                        });
                    });
                });
            }
        } else {
            console.log("error reading system voltage, not changing performance", err);
        }
    });
}

var blinkIntervalHandle = null;
power.setButtons = function(mode) {
    if(!mode) mode = "disabled";
    power.buttonMode = mode;
    if(blinkIntervalHandle) {
        clearInterval(blinkIntervalHandle);
        blinkIntervalHandle = null;
    }
    if(mode == 'disabled') {
        power.buttonPowerLight(false);
        power.button1Light(false);
        power.button2Light(false);
        power.button3Light(false);
    } else if(mode == 'power') {
        power.buttonPowerLight(true);
        power.button1Light(false);
        power.button2Light(false);
        power.button3Light(false);

    } else if(mode == 'all') {
        power.buttonPowerLight(true);
        power.button1Light(true);
        power.button2Light(true);
        power.button3Light(true);
    } else if(mode == 'blink') {
        power.buttonPowerBlink();
        power.button1Light(false);
        power.button2Light(false);
        power.button3Light(false);
        blinkIntervalHandle = setInterval(power.buttonPowerBlink, 5000);
    }
}

power.setAutoOff = function(minutes) {
    if(powerDownTimerHandle) clearTimeout(powerDownTimerHandle);
    powerDownTimerHandle = null;
    power.autoOffMinutes = minutes;
    power.activity();
}

power.activity = function() {
    if(powerDownTimerHandle) clearTimeout(powerDownTimerHandle);
    powerDownTimerHandle = null;
    if(power.autoOffMinutes && !power.autoOffDisabled) {
        powerDownTimerHandle = setTimeout(function(){
            if(power.charging || power.percentage == 100) {
                return; // don't power down if plugged in
            } else {
                power.shutdown();
            }
        }, power.autoOffMinutes * 60000);
    }
}
power.activity();

power.shutdown = function() {
    exec('nohup sh -c "killall node; sleep 2; kill -s 9 ' + process.pid +  '; init 0"');
}

power.reboot = function() {
    exec('nohup sh -c "killall node; sleep 2; kill -s 9 ' + process.pid +  '; init 6"');
}

power.disableAutoOff = function() {
    power.autoOffDisabled = true;
    power.activity();
}

power.enableAutoOff = function() {
    power.autoOffDisabled = false;
    power.activity();
}

power.gps = function(enable, callback) {
    if(enable) console.log("powering on GPS");
    else console.log("powering off GPS");
    power.gpsEnabled = enable ? 'enabled' : 'disabled';
    setPower(callback);
}

power.wifi = function(enable, callback) {
    power.wifiEnabled = enable;
    setPower(function(){
        setTimeout(callback, 3000); // give time for modules to load/unload
    });
}

var statsRegs = {
//    POWER_STATUS: 0x00,
    POWER_OP_MODE: 0x01,
//    CHARGE_CTL: 0x33,
//    CHARGE_CTL2: 0x34,
    BAT_VOLT_MSB: 0x78,
    BAT_VOLT_LSB: 0x79,
    USB_VOLT_MSB: 0x5a,
    USB_VOLT_LSB: 0x5b,
    USB_CURR_MSB: 0x5c,
    USB_CURR_LSB: 0x5d,
    BAT_IDISCHG_MSB: 0x7c,
    BAT_IDISCHG_LSB: 0x7d,
    BAT_ICHG_MSB: 0x7a,
    BAT_ICHG_LSB: 0x7b,
    TEMP_MSB: 0x5e,
    TEMP_LSB: 0x5f,
    BAT_GAUGE: 0xb9,
    BAT_WARN: 0x49
}

var BAT_LUT = [
    {x: 99, y: 100},
    {x: 80, y: 85},
    {x: 60, y: 70},
    {x: 45, y: 62},
    {x: 16, y: 53},
    {x: 7, y: 40},
    {x: 1, y: 0},
];

function getPowerStats(callback) {
    var stats = {};
    axpSet(0x82, 0xff, function() {
        async.mapValuesSeries(statsRegs, function(reg, key, cb) {
            axpGet(reg, cb);
        }, function(err, res) {
            if(!err && res) {
                stats.batteryCharging = ((res.POWER_OP_MODE & 0x40) / 64) ? true : false;        
                stats.axpTemperature = ((res.TEMP_MSB << 4) | (res.TEMP_LSB & 0x0F)) * 0.1 - 144.7; 
                stats.batteryPercent = interpolate.linear(BAT_LUT, res.BAT_GAUGE);
                stats.batteryVoltage = ((res.BAT_VOLT_MSB << 4) | (res.BAT_VOLT_LSB & 0x0F)) * 1.1 / 1000;
                stats.usbVoltage = ((res.USB_VOLT_MSB << 4) | (res.USB_VOLT_LSB & 0x0F)) * 1.7 / 1000;
                stats.usbCurrent = ((res.USB_CURR_MSB << 4) | (res.USB_CURR_LSB & 0x0F)) * 0.375 / 1000;
                stats.usbWatts = stats.usbVoltage * stats.usbCurrent;
                stats.batteryDischargeCurrent = ((res.BAT_IDISCHG_MSB << 5) | (res.BAT_IDISCHG_LSB & 0x0F)) * 0.5 / 1000;
                stats.batteryChargeCurrent = ((res.BAT_ICHG_MSB << 4) | (res.BAT_ICHG_LSB & 0x0F)) * 0.5 / 1000;
                stats.batteryWarning = stats.batteryDischargeCurrent > 0 && stats.batteryVoltage < 3.25; //((res.BAT_WARN & 0x20) / 32) ? true : false;       
                stats.batteryWatts = stats.batteryVoltage * stats.batteryDischargeCurrent;
                stats.shutdownNow = stats.batteryDischargeCurrent > 0 && stats.batteryVoltage < 3.1; //((res.BAT_WARN & 0x10) / 16) ? true : false;       
                stats.pluggedIn = stats.usbWatts > 0 ? true : false;
                if(stats.batteryPercent >= 100) {
                    if(stats.batteryCharging) {
                        stats.batteryPercent = 99;
                    } else {
                        stats.batteryPercent = 100;
                    }
                }
                if(stats.batteryPercent < 1) stats.batteryPercent = 1;
                if(stats.batteryWarning) stats.batteryPercent = 0;
                //console.log(stats);
                //var logString = stats.batteryPercent + "," + stats.batteryVoltage + "," + stats.batteryDischargeCurrent + ',' + stats.batteryWarning + ',' + stats.shutdownNow;
                //exec('echo "' + logString + '" >> /root/powerlog.txt', function(err, stderr){
                //    if(err) console.log(stderr);
                //});

                callback && callback(null, stats);
            } else {
                callback && callback(err);
            }
        });
    });
}

function twoDigits(val) {
    return Math.round(val * 100) / 100;
}

power.infoText = function() {
    var info = "";
    info += "External Power: " + (power.stats.pluggedIn ? 'YES' : 'NO');
    if(power.stats.pluggedIn) info += "\tBattery charging: " + (power.stats.batteryCharging ? 'YES' : 'NO');
    if(power.stats.pluggedIn) info += "\tConsumption: " + twoDigits(power.stats.usbWatts) + "W";
    if(!power.stats.pluggedIn) info += "\tConsumption: " + twoDigits(power.stats.batteryWatts) + "W";
    if(power.stats.pluggedIn) info += "\tUSB Volts: " + twoDigits(power.stats.usbVoltage) + "V";
    if(power.stats.pluggedIn) info += "\tUSB Current: " + twoDigits(power.stats.usbCurrent) + "A";
    info += "\tBattery Level: " + Math.round(power.stats.batteryPercent) + "%";
    if(!power.stats.pluggedIn) {
        var minLeft = Math.round((BAT_AH/power.stats.batteryDischargeCurrent)*(power.stats.batteryPercent/100)*60);
        var hLeft = Math.floor(minLeft / 60);
        var mLeft = (minLeft - hLeft * 60).toString();
        if(mLeft.length < 2) mLeft = '0' + mLeft;
        info += "\tBattery Time Left: " + hLeft + ":" + mLeft + "";
    }
    info += "\tBattery Volts: " + twoDigits(power.stats.batteryVoltage) + "V";
    if(!power.stats.pluggedIn) info += "\tBattery Current: " + twoDigits(power.stats.batteryDischargeCurrent) + "A";
    if(power.stats.pluggedIn) info += "\tCharge Current: " + twoDigits(power.stats.batteryChargeCurrent) + "A";
    info += "\tPMIC Temp: " + twoDigits(power.stats.axpTemperature) + "°C";
    return info;
}

power.update = function(noEvents) {
    getPowerStats(function(err, stats) {
        if(!err && stats) {
            power.stats = stats;
            if(stats.pluggedIn != null && stats.pluggedIn != power.charging) {
                power.charging = stats.pluggedIn;
                power.emit("charging", power.charging);
            }

            if(stats.batteryPercent != null && stats.batteryPercent != power.percentage) {
                power.percentage = stats.batteryPercent;
                power.emit("percentage", power.percentage);
            }

            if(stats.batteryWarning) {
                power.emit("warning", power.warning);
                power.percentage = 0;
                power.emit("percentage", power.percentage);
            }

            if(stats.shutdownNow) {
                console.log("WARNING: low battery - sending shutdown event");
                power.emit("shutdown");
            }
        }
    });
};

power.buttonPowerLight = function(on) {
    if(on) {
        exec("echo 255 | sudo tee /sys/class/leds/view-button-power/brightness");
    } else {
        exec("echo 0 | sudo tee /sys/class/leds/view-button-power/brightness");
    }
}

power.buttonPowerBlink = function() {
    exec("echo 255 | sudo tee /sys/class/leds/view-button-power/brightness; echo 0 | sudo tee /sys/class/leds/view-button-power/brightness");
}

power.button1Light = function(on) {
    if(on) {
        exec("echo 255 | sudo tee /sys/class/leds/view-button-1/brightness");
    } else {
        exec("echo 0 | sudo tee /sys/class/leds/view-button-1/brightness");
    }
}

power.button2Light = function(on) {
    if(on) {
        exec("echo 255 | sudo tee /sys/class/leds/view-button-2/brightness");
    } else {
        exec("echo 0 | sudo tee /sys/class/leds/view-button-2/brightness");
    }
}

power.button3Light = function(on) {
    if(on) {
        exec("echo 255 | sudo tee /sys/class/leds/view-button-3/brightness");
    } else {
        exec("echo 0 | sudo tee /sys/class/leds/view-button-3/brightness");
    }
}

setInterval(power.update, 10000);

module.exports = power;