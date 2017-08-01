var beep = require('interface/beep.js');
var _ = require('underscore');
var oled = null;
var currentProgram = null;
var backupProgram = null;
var currentName = "";
var stack = [];
var screenSaverHandle = null;

//var beepEnter = beep.sine(2954, 0.04);
//var beepBack = beep.sine(1447, 0.04);
//var beepClick = beep.sine(738, 0.02);
var beepAlarm = beep.sine2(2954, 1540, 0.1);

beep.enable(true);

exports.busy = false;
exports.audio = 'disabled';

function activity() {
    oled.activity();
}

exports.init = function(menuController) {
    oled = menuController;
}

function load(program, selected) {
    if(!program) return;// exports.back();
    if (program.alternate && typeof program.alternate == "function") {
        var alternate = program.alternate();
        if (alternate !== false) {
            load(alternate, selected);
            return;
        }
    }

    currentName = program.name;
    currentProgram = _.clone(program);

    if (currentProgram.items && currentProgram.items.slice) {
        currentProgram.items = currentProgram.items.slice(0);
        currentProgram.items = currentProgram.items.filter(function(item) {
            if (typeof item.condition === "function") {
                return item.condition();
            } else {
                return true;
            }
        });
        for (var i = 0; i < currentProgram.items.length; i++) {
            var item = currentProgram.items[i];
            if (typeof item.name == 'function') {
                currentProgram.items[i] = _.clone(item);
                item = currentProgram.items[i];
                item.name = item.name();
            }
            if (selected == null) {
                if (item.selected && typeof item.selected === "function") {
                    if (item.selected()) {
                        selected = i;
                        break;
                    }
                } else if (item.action && item.action.selected && typeof item.action.selected === "function") {
                    if (item.action.selected()) {
                        selected = i;
                        break;
                    }
                }
            }
        }
        if(selected >= currentProgram.items.length) selected = currentProgram.items.length - 1;
    }
    if (currentProgram.type == "timelapse") {
        oled.setTimelapseMode(true);
    } else {
        oled.setTimelapseMode(false);
    }
    if (currentProgram.type == "menu" && currentProgram.hasImages == true) {
        oled.createMenuImage(currentProgram.items.map(function(item) {
            return {
                name: item.name,
                line2: item.line2,
                image: item.image
            };
        }), selected || 0);
        oled.update();
    } else if (currentProgram.type == "menu") {
        oled.create(currentProgram.items.map(function(item) {
            return item.name;
        }), selected || 0);
        oled.update();
    }
    if (currentProgram.type == "options") {
        oled.value(currentProgram.items, selected || 0);
        oled.update();
    }
    if (currentProgram.type == "textInput") {
        oled.text(currentProgram.name, currentProgram.value);
        oled.update();
    }
    if (currentProgram.type == "numberInput") {
        oled.number(currentProgram.name, currentProgram.value);
        oled.update();
    }
    if (currentProgram.type == "timeInput") {
        oled.time(currentProgram.name, currentProgram.value);
        oled.update();
    }
    if (currentProgram.type == "dateInput") {
        oled.date(currentProgram.name, currentProgram.value);
        oled.update();
    }
    if (currentProgram.type == "textDisplay") {
        oled.displayText(currentProgram.name, currentProgram.value);
        oled.update();
    }
    if (currentProgram.type == "png" && currentProgram.file) {
        oled.png(currentProgram.file);
    }
    if (currentProgram.type == "function" && currentProgram.fn) {
        currentProgram.fn(currentProgram.arg, function(err, program) {
            if(!err && program && (program.type)) {
                load(program);
            } else {
                console.log("function completed, going back");
                setTimeout(back);
            }
        });
    }
    if (currentProgram.type == "menuFunction" && currentProgram.fn) {
        currentProgram.fn(currentProgram.arg, function(err, p) {
            if (!err) exports.load(p, true);
        });
    }
}

exports.load = function(menuProgram, noPush, selected, forceStack) {
    exports.busy = false;
    if(currentProgram && currentProgram.intervalHandle) {
        clearInterval(currentProgram.intervalHandle)
        currentProgram.intervalHandle = null;
    }
    if ((forceStack && backupProgram != null) || (backupProgram != null && !noPush && backupProgram.type != "options" && backupProgram.type != "function")) {
        stack.push({
            program: backupProgram,
            selected: oled.selected,
            name: currentName
        });
    }
    backupProgram = menuProgram;

    if (typeof menuProgram == 'function') {
        exports.busy = true;
        oled.showBusy();
        menuProgram(function(arg, program) {
            exports.busy = false;
            load(program, selected);
        });
    } else {
        load(menuProgram, selected);
    }

}

exports.reload = function() {
    if (backupProgram.type == "menu" || backupProgram.type == "options") {
        exports.load(backupProgram, true, oled.selected);
    }
}

exports.up = function(alt) {
    activity();
    if(exports.busy) return;
    if (currentProgram.type == "menu" || currentProgram.type == "options") {
        oled.up();
    } else if(currentProgram.type == "textDisplay") {
        oled.up();
    } else if(currentProgram.type == "textInput" || currentProgram.type == "numberInput" || currentProgram.type == "timeInput" || currentProgram.type == "dateInput") {
        if(alt) {
            oled.textMoveBackward();
        } else {
            oled.up();
        }
    }
}
exports.down = function(alt) {
    activity();
    if(exports.busy) return;
    if (currentProgram.type == "menu" || currentProgram.type == "options") {
        oled.down();
    } else if(currentProgram.type == "textDisplay") {
        oled.down();
    } else if(currentProgram.type == "textInput" || currentProgram.type == "numberInput" || currentProgram.type == "timeInput" || currentProgram.type == "dateInput") {
        if(alt) {
            oled.textMoveForward();
        } else {
            oled.down();
        }
    }
}
exports.enter = function(alt) {
    activity();
    if(exports.busy) return;
    if (currentProgram.type == "menu" || currentProgram.type == "options") {
        if(currentProgram.items[oled.selected]) exports.load(currentProgram.items[oled.selected].action);
    } else if (currentProgram.type == "textInput") {
        if(alt) {
            oled.textMoveForward();
        } else {
            //console.log("resulting string", oled.getTextValue());
            if(currentProgram.onSave) currentProgram.onSave(oled.getTextValue());
            back();
        }
    } else if (currentProgram.type == "numberInput") {
        if(alt) {
            oled.textMoveForward();
        } else {
            //console.log("resulting string", oled.getTextValue());
            if(currentProgram.onSave) currentProgram.onSave(oled.getNumberValue());
            back();
        }
    } else if (currentProgram.type == "timeInput") {
        if(alt) {
            oled.textMoveForward();
        } else {
            //console.log("resulting string", oled.getTextValue());
            if(currentProgram.onSave) currentProgram.onSave(oled.getTimeValue());
            back();
        }
    } else if (currentProgram.type == "dateInput") {
        if(alt) {
            oled.textMoveForward();
        } else {
            //console.log("resulting string", oled.getTextValue());
            if(currentProgram.onSave) currentProgram.onSave(oled.getDateValue());
            back();
        }
    } else if (currentProgram.type == "png") {
        back();
    } else if (currentProgram.enter && typeof currentProgram.enter == "function") {
        currentProgram.enter();
    }
}
exports.help = function() {
    activity();
    if(exports.busy) return;
    if(currentProgram.type == "textDisplay" && currentProgram.origin == "help") {
        back();
    } else if (currentProgram.type == "menu" || currentProgram.type == "options") {
        if (currentProgram.items[oled.selected] && currentProgram.items[oled.selected].help) {
            exports.load({
                type: "textDisplay",
                origin: "help",
                name: "HELP - " + currentProgram.items[oled.selected].name || currentProgram.name,
                value: currentProgram.items[oled.selected].help
            });
        }
    } else if(currentProgram.help) {
        exports.load({
            type: "textDisplay",
            origin: "help",
            name: "HELP - " + currentProgram.name,
            value: currentProgram.help
        });
    }
}
exports.alert = function(title, text, updateInterval, audioAlert) {
    activity();
    if(audioAlert && exports.audio != 'disabled') beep.play(beepAlarm, 3, 0.2);
    var f, intervalHandle = null;
    if(typeof text === 'function') {
        f = text;
        text = f();
        intervalHandle = setInterval(function() {
            oled.updateDisplayText(f());
        }, updateInterval||1000);
    }
    exports.load({
        type: "textDisplay",
        origin: "alert",
        name: title,
        value: text,
        intervalHandle: intervalHandle
    });
}
exports.currentOrigin = function() {
    return currentProgram.origin;
}
exports.dismissAlert = function() {
    activity();
    if (currentProgram.type == "textDisplay" && currentProgram.origin == "alert" ) back();
}
exports.button3 = function() {
    activity();
    if(exports.busy) return;
    //beep.play(beepClick);
    if (currentProgram.type == "menu" && currentProgram.items[oled.selected] && currentProgram.items[oled.selected].button3) {
        currentProgram.items[oled.selected].button3(currentProgram.items[oled.selected]);
    } else if (currentProgram.type == "textInput") {
        oled.textCycleMode();
    } else if (currentProgram.button3 && typeof currentProgram.button3 == "function") {
        currentProgram.button3();
    }
}
function back() {
    if(stack.length == 0) {
        console.log("already at menu top");
        return;
    }
    var b;
    do {
        b = stack.pop();
    } while((!b || !b.name) && stack.length > 0);
    if(currentProgram.origin == "prompt" && stack.length > 0) {
        do {
            b = stack.pop();
        } while((!b || !b.name) && stack.length > 0);
    }
    console.log("BACK to " + b.name);
    exports.load(b.program, true, b.selected);
}
exports.back = function() {
    exports.busy = false;
    if (stack.length > 0) {
        activity();
        back();
    } else {
        //if (oled.visible) oled.hide();
    }
}

exports.backButton = function() {
    if (stack.length > 0) {
        activity();
        if(exports.busy) return;
        //beep.play(beepBack);
        back();
    } else {
        if (oled.visible) oled.hide();
    }
}

exports.set = function(object, key, value, callback) {
    return {
        type: "function",
        fn: function(arg, cb) {
            console.log("ui.set: " + key + " = " + value);
            object[key] = value;
            if(callback) {
                callback(cb);
            } else {
                cb && cb();
            }
        },
        selected: exports.select(object, key, value)
    }
}

exports.select = function(object, key, value) {
    return function() {
        return object && object[key] == value;
    }
}

exports.confirmationPrompt = function(promptText, optionText1, optionText2, helpText, callback1, callback2) {
    exports.load({
        name: promptText,
        origin: "prompt",
        type: "options",
        items: [{
            name: promptText,
            value: optionText1,
            help: helpText,
            action: {
                type: 'function',
                fn: function(arg, cb) {
                    if(callback1) {
                        callback1(cb);
                    } else {
                        back();
                        cb();
                    }
                }
            }
        }, {
            name: promptText,
            value: optionText2,
            help: helpText,
            action: {
                type: 'function',
                fn: function(arg, cb) {
                    if(callback2) {
                        callback2(cb);
                    } else {
                        back();
                        cb();
                    }
                }
            }
        }]
    }, null, null, true);
}

exports.defaultStatusString = "";
var statusTimeoutHandle = null;

exports.status = function(status) {
    if(statusTimeoutHandle) clearTimeout(statusTimeoutHandle);
    if(status) {
        oled.writeStatus(status);
        if(exports.busy) oled.showBusy();
        if(exports.defaultStatusString) {
            statusTimeoutHandle = setTimeout(function(){
                oled.writeStatus(exports.defaultStatusString);
                if(exports.busy) oled.showBusy();
            }, 6000);
        }
    } else {
        oled.writeStatus(exports.defaultStatusString);
        if(exports.busy) oled.showBusy();
    }
}

exports.defaultStatus = function(status) {
    exports.defaultStatusString = status;
}
