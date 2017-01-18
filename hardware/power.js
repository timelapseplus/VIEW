var EventEmitter = require("events").EventEmitter;
var exec = require('child_process').exec;
var async = require('async');

var power = new EventEmitter();

power.chargeLight = 'enabled';
power.gpsEnabled = null;
power.wifiEnabled = true;
power.autoOffMinutes = 10;
power.autoOffDisabled = false;

var powerControlBase = 0x17; // gps off, wifi off
var powerWifi = 0x40;
var powerGps = 0x8;

var powerDownTimerHandle = null;

function axpSet(reg, val, callback) {
    reg = parseInt(reg);
    val = parseInt(val);
    if(reg != null && val != null) {
        exec("sudo i2cset -y -f 0 0x34 0x" + reg.toString(16) + " 0x" + val.toString(16), callback);
    } else {
        callback('invalid parameters');
    }
}

function axpGet(reg, callback) {
    reg = parseInt(reg);
    if(reg != null) {
        exec("sudo i2cget -y -f 0 0x34 0x" + reg.toString(16), function(err, stdout) {
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
    if(power.gpsEnabled) setting |= powerGps;
    if(power.wifiEnabled) setting |= powerWifi;
    axpSet(0x12, setting, callback); // set power switches
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
    exec("nohup init 0");
}

power.reboot = function() {
    exec("nohup init 6");
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
    power.gpsEnabled = enable;
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

function getPowerStats(callback) {
    var stats = {};
    axpSet(0x82, 0xff, function() {
        async.mapValuesSeries(statsRegs, function(reg, key, cb) {
            axpGet(reg, cb);
        }, function(err, res) {
            if(!err && res) {
                stats.batteryCharging = ((res.POWER_OP_MODE & 0x40) / 64) ? true : false;        
                stats.axpTemperature = ((res.TEMP_MSB << 4) | (res.TEMP_LSB & 0x0F)) * 0.1 - 144.7; 
                stats.batteryPercent = res.BAT_GAUGE;
                stats.batteryVoltage = ((res.BAT_VOLT_MSB << 4) | (res.BAT_VOLT_LSB & 0x0F)) * 1.1 / 1000;
                stats.usbVoltage = ((res.USB_VOLT_MSB << 4) | (res.USB_VOLT_LSB & 0x0F)) * 1.7 / 1000;
                stats.usbCurrent = ((res.USB_CURR_MSB << 4) | (res.USB_CURR_LSB & 0x0F)) * 0.375 / 1000;
                stats.usbWatts = stats.usbVoltage * stats.usbCurrent;
                stats.batteryDischargeCurrent = ((res.BAT_IDISCHG_MSB << 5) | (res.BAT_IDISCHG_LSB & 0x0F)) * 0.5 / 1000;
                stats.batteryChargeCurrent = ((res.BAT_ICHG_MSB << 4) | (res.BAT_ICHG_LSB & 0x0F)) * 0.5 / 1000;
                stats.batteryWarning = ((res.BAT_WARN & 0x20) / 32) ? true : false;       
                stats.batteryWatts = stats.batteryVoltage * stats.batteryDischargeCurrent;
                stats.shutdownNow = ((res.BAT_WARN & 0x10) / 16) ? true : false;       
                stats.pluggedIn = stats.usbWatts > 0 ? true : false;
                if(stats.batteryPercent >= 100) {
                    if(stats.batteryCharging) {
                        stats.batteryPercent = 99;
                    } else {
                        stats.batteryPercent = 100;
                    }
                }
                if(stats.batteryPercent < 1) stats.batteryPercent = 100;
                if(stats.batteryWarning) stats.batteryPercent = 0;
                //console.log(stats);
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
    if(power.stats.pluggedIn) info += "\nBattery charging: " + (power.stats.batteryCharging ? 'YES' : 'NO');
    if(power.stats.pluggedIn) info += "\nConsumption: " + twoDigits(power.stats.usbWatts) + "W";
    if(!power.stats.pluggedIn) info += "\nConsumption: " + twoDigits(power.stats.batteryWatts) + "W";
    if(power.stats.pluggedIn) info += "\nUSB Volts: " + twoDigits(power.stats.usbVoltage) + "V";
    if(power.stats.pluggedIn) info += "\nUSB Current: " + twoDigits(power.stats.usbCurrent) + "A";
    info += "\nBattery Level: " + twoDigits(power.stats.batteryPercent) + "%";
    info += "\nBattery Volts: " + twoDigits(power.stats.batteryVoltage) + "V";
    if(!power.stats.pluggedIn) info += "\nBattery Current: " + twoDigits(power.stats.batteryDischargeCurrent) + "A";
    if(power.stats.pluggedIn) info += "\nCharge Current: " + twoDigits(power.stats.batteryChargeCurrent) + "A";
    info += "\nPMIC Temp: " + twoDigits(power.stats.axpTemperature) + "°C";
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

setInterval(power.update, 5000);

module.exports = power;