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

var BTN_POWER = {
    ev: "1c2ac00.i2c-platform-axp20x-pek",
    pressed: 5,
    held: 6
}

var btnPower = new Button(BTN_POWER.ev);

var btnPowerPressedTimer = null;
btnPower.on('press', function() {
    inputs.emit('B', BTN_POWER.pressed);
    if(btnPowerPressedTimer != null) clearTimeout(btnPowerPressedTimer);
    btnPowerPressedTimer = setTimeout(function(){
        inputs.emit('B', BTN_POWER.held);
    }, HOLD_TIME);
});

btnPower.on('release', function() {
    if(btnPowerPressedTimer != null) clearTimeout(btnPowerPressedTimer);
});

btnPower.on('error', function(err) {
    console.log("btnPower error: ", err);
});

exec("killall gesture");
exec("killall inputs");

inputs.button = [];
inputs.button[0] = false;
inputs.button[1] = false;
inputs.button[2] = false;
inputs.button[3] = false;
inputs.button[4] = false;

inputs.start = function() {
    stop = false;
    if(inputsRunning) return;
    inputsProcess = spawn(INPUTS_BIN_PATH);
    inputsRunning = true;
    inputs.button[0] = false;
    inputs.button[1] = false;
    inputs.button[2] = false;
    inputs.button[3] = false;
    inputs.button[4] = false;
    console.log("inputs process started");
    inputsProcess.stdout.on('data', function(chunk) {
        //console.log("inputs stdin: " + chunk.toString());
        var matches = chunk.toString().match(/([A-Z])=([A-Z0-9\-]+)/);
        if (matches && matches.length > 1) {
            if(matches[1] == 'D') {
                var dir = matches[2];
                if(inputs.button[3]) dir += "+";
                inputs.emit('D', dir);
            } else if(matches[1] == 'B') {
                var pressed = [];
                var status = parseInt(matches[2]);
                //console.log("button event", status.toString(2));
                for(var i = 0; i < 4; i++) {
                    pressed[i] = (status & 1<<i) ? true : false;
                    if(pressed[i] != inputs.button[i]) {
                        inputs.button[i] = pressed[i];
                        if(inputs.button[i]) inputs.emit('B', i + 1);
                    }
                }
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
            setTimeout(inputs.start);
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
            setTimeout(inputs.startGesture);
        }
    });
}

inputs.stop = function(callback) {
    stop = true;
    if (inputsRunning) {
        console.log("inputs process exiting...");
        inputsProcess.stdin.write('\n');
        setTimeout(function(){
            inputsProcess.kill();
        }, 1000);
    }
    inputs.stopGesture();
    if(callback) setTimeout(callback, 1500); // give time for processes to exit
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