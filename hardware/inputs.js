require('rootpath')();
var INPUTS_BIN_PATH = "/home/view/current/bin/inputs";
var GESTURE_BIN_PATH = "/home/view/current/bin/gesture";
var GestureLib = require('apds-gesture');
var spawn = require('child_process').spawn;
var exec = require('child_process').exec;
var Button = require('gpio-button');
var db = require("system/db.js");
var EventEmitter = require("events").EventEmitter;

var inputs = new EventEmitter();

var GESTURE_INT_GPIO = 72;//PC8
var GESTURE_I2C_BUS = 2;

var gesture = GestureLib.use(GESTURE_I2C_BUS, GESTURE_INT_GPIO);

gesture.on('ready', function() {
    console.log("INPUTS: found a gesture sensor");
});

gesture.on('error', function(err) {
    console.log("INPUTS: Gesture Error: ", err);
});

gesture.on('movement', function(dir) {
    inputs.emit('G', dir.substr(0, 1).toUpperCase());
});

var inputsProcess = null;
var inputsRunning = false;
var gestureProcess = null;
var gestureRunning = false;

var stop = false;
var stopGesture = false;

var HOLD_TIME = 1500;

var powerButton = {
    platformEvent: "1c2ac00.i2c-platform-axp20x-pek",
    116: {
        name: "power",
        pressed: 5,
        held: 6
    }
}
var buttons = {
    platformEvent: "button-knob",
    1: {
        name: "back",
        pressed: 1,
        held: 1+6
    }, 
    2: {
        name: "enter",
        pressed: 2,
        held: 2+6
    },
    3: {
        name: "menu",
        pressed: 3,
        held: 3+6
    },
    4: {
        name: "knob",
        pressed: 4,
        held: 4+6
    }
};

setupButton(powerButton);
setupButton(buttons);

function setupButton(buttonConfig) {
    buttonConfig._button = new Button(buttonConfig.platformEvent);

    buttonConfig._btnPowerPressedTimer = null;
    buttonConfig._button.on('press', function(code) {
        if(code && buttonConfig[code]) {
            //console.log("button", buttonConfig[code].name, "pressed");
            buttonConfig[code]._pressed = true;
            inputs.emit('B', buttonConfig[code].pressed);
            if(buttonConfig[code]._btnPowerPressedTimer != null) clearTimeout(buttonConfig[code]._btnPowerPressedTimer);
            buttonConfig[code]._btnPowerPressedTimer = setTimeout(function(){
                inputs.emit('B', buttonConfig[code].held);
            }, HOLD_TIME);
        }
    });

    buttonConfig._button.on('release', function(code) {
        if(code && buttonConfig[code]) {
            //console.log("button", buttonConfig[code].name, "released");
            buttonConfig[code]._pressed = false;
            if(buttonConfig[code]._btnPowerPressedTimer != null) clearTimeout(buttonConfig[code]._btnPowerPressedTimer);
        }
    });

    buttonConfig._button.on('error', function(err) {
        console.log("button error: ", buttonConfig.name, err);
    });
}


exec("killall gesture");
exec("killall inputs");
var options = {};
var mcuSetup = false;
inputs.start = function(knobOptions) {
    options = knobOptions;
    if(knobOptions.knob) {
        stop = false;
        if(inputsRunning) return;
        inputsProcess = spawn(INPUTS_BIN_PATH);
        inputsRunning = true;
        console.log("inputs process started");
        inputsProcess.stdout.on('data', function(chunk) {
            //console.log("inputs stdin: " + chunk.toString());
            var matches = chunk.toString().match(/([A-Z])=([A-Z0-9\-]+)/);
            if (matches && matches.length > 1) {
                if(matches[1] == 'D') {
                    var dir = matches[2];
                    if(buttons['4']._pressed) dir += "+";
                    inputs.emit('D', dir);
                }
            }
        });
        inputsProcess.stderr.on('data', function(chunk) {
            console.log("inputs stderr: " + chunk.toString());
            chunk = null;
        });
        inputsProcess.on('close', function(code) {
            console.log("inputs process exited");
            inputsRunning = false;
            if (!stop) {
                setTimeout(function() {
                    if(!stop) inputs.start();
                }, 500);
            }
        });
    } else if(options.mcu) {
        if(mcuSetup) return;
        mcuSetup = true;
        options.mcu.on('knob', function(val) {
            k = 'U';
            if(val < 0) {
                k = 'D';
            }
            if(buttons['4']._pressed) k += "+";
            inputs.emit('D', k);
        });
    }
}

inputs.startGesture = function() {
    inputs.gestureStatus = "enabled";
    db.get('gestureCalibration', function(err, gestureCalibration) {
        if(err || !gestureCalibration) gestureCalibration = {};
        gesture.setup(gestureCalibration, function(){
            console.log("INPUTS: starting gesture sensor", (gestureCalibration.gUOffset ? "(calibrated)" : ""));
            gesture.start();
        });
    });
}
inputs.calibrateGesture = function(statusCallback) {
    gesture.calibrate(function(err, status, calResults) {
        if(calResults) {
            db.set('gestureCalibration', calResults);
            gesture.start();
        } else if(err) {
            console.log("INPUTS: error calibrating gesture: ", err);
        }
        statusCallback && statusCallback(err, status, (calResults || err) ? true : false);
    });
}

inputs.stop = function(callback) {
    process.nextTick(function(){
        stop = true;
        stopGesture = true;
        if (inputsRunning) {
            console.log("inputs process exiting...");
            try {
                inputsProcess.stdin.write('\n\n\n');
                inputsProcess.stdin.end();
            } catch (e) {
                console.log("input close error: ", e);                
                setTimeout(function(){
                    inputsProcess.kill();
                }, 1000);
            }
        }
        inputs.stopGesture();
        if(callback) setTimeout(callback, 100); // give time for processes to exit
    });
}

inputs.stopGesture = function() {
    inputs.gestureStatus = "disabled";
    gesture.stop();
    gesture.disable();
}

module.exports = inputs;