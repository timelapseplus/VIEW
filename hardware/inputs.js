var INPUTS_BIN_PATH = "/home/view/current/bin/inputs";
var GESTURE_BIN_PATH = "/home/view/current/bin/gesture";
var EventEmitter = require("events").EventEmitter;
var spawn = require('child_process').spawn;
var exec = require('child_process').exec;
var Button = require('gpio-button');

var inputs = new EventEmitter();

var inputsProcess = null;
var inputsRunning = false;
var gestureProcess = null;
var gestureRunning = false;

var stop = false;
var stopGesture = false;

var HOLD_TIME = 1500;

var buttons = {
    power: {
        name: "power",
        platformEvent: "1c2ac00.i2c-platform-axp20x-pek",
        pressed: 5,
        held: 6
    }, 
    back: {
        name: "back",
        platformEvent: "button-back",
        pressed: 1,
        held: 1+6
    }, 
    enter: {
        name: "enter",
        platformEvent: "button-enter",
        pressed: 2,
        held: 2+6
    },
    menu: {
        name: "menu",
        platformEvent: "button-menu",
        pressed: 3,
        held: 3+6
    },
    knob: {
        name: "knob",
        platformEvent: "button-knob",
        pressed: 4,
        held: 4+6
    }
};

//setupButton(buttons.power);
setupButton(buttons.back);
//setupButton(buttons.enter);
setupButton(buttons.menu);
setupButton(buttons.knob);

function setupButton(buttonConfig) {
    buttonConfig._button = new Button(buttonConfig.platformEvent);

    buttonConfig._btnPowerPressedTimer = null;
    buttonConfig._button.on('press', function() {
        console.log("button", buttonConfig.name, "pressed");
        buttonConfig._pressed = true;
        inputs.emit('B', buttonConfig.pressed);
        if(buttonConfig._btnPowerPressedTimer != null) clearTimeout(buttonConfig._btnPowerPressedTimer);
        buttonConfig._btnPowerPressedTimer = setTimeout(function(){
            inputs.emit('B', buttonConfig.held);
        }, HOLD_TIME);
    });

    buttonConfig._button.on('release', function() {
        console.log("button", buttonConfig.name, "released");
        buttonConfig._pressed = false;
        if(buttonConfig._btnPowerPressedTimer != null) clearTimeout(buttonConfig._btnPowerPressedTimer);
    });

    buttonConfig._button.on('error', function(err) {
        console.log("button error: ", buttonConfig.name, err);
    });
}


exec("killall gesture");
exec("killall inputs");

inputs.start = function() {
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
                if(buttons.knob._pressed) dir += "+";
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

}

inputs.startGesture = function() {
    stopGesture = false;
    inputs.gestureStatus = "enabled";
    if(gestureRunning) return;
    gestureProcess = spawn(GESTURE_BIN_PATH);
    gestureRunning = true;
    console.log("gesture process started");
    gestureProcess.stdout.on('data', function(chunk) {
        console.log("gesture stdin: " + chunk.toString());
        var matches = chunk.toString().match(/([A-Z])=([A-Z0-9\-]+)/);
        if (matches && matches.length > 1) {
            inputs.emit(matches[1], matches[2]);
        }
    });
    gestureProcess.stderr.on('data', function(chunk) {
        console.log("gesture stderr: " + chunk.toString());
        chunk = null;
    });
    gestureProcess.on('close', function(code) {
        console.log("gesture process exited");
        gestureRunning = false;
        if (!stopGesture) {
            setTimeout(function() {
                if(!stopGesture) inputs.startGesture();
            }, 100);
        }
    });
}

inputs.stop = function(callback) {
    process.nextTick(function(){
        stop = true;
        stopGesture = true;
        if (inputsRunning) {
            console.log("inputs process exiting...");
            try {
                inputsProcess.stdin.write('\n');
            } catch (e) {
                console.log("input close error: ", e);                
            }
            setTimeout(function(){
                inputsProcess.kill();
            }, 1000);
        }
        inputs.stopGesture();
        if(callback) setTimeout(callback, 100); // give time for processes to exit
    });
}

inputs.stopGesture = function() {
    stopGesture = true;
    inputs.gestureStatus = "disabled";
    if (gestureRunning) {
        console.log("gesture process exiting...");
        gestureProcess.stdin.write('\n');
        setTimeout(function(){
            gestureProcess.kill();
        }, 1000);
    }    
}

module.exports = inputs;