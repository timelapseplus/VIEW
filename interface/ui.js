var beep = require('interface/beep.js');
var _ = require('underscore');
var oled = null;
var backupProgram = null;
var currentName = "";
var stack = [];
var screenSaverHandle = null;

//var beepEnter = beep.sine(2954, 0.04);
//var beepBack = beep.sine(1447, 0.04);
//var beepClick = beep.sine(738, 0.02);
var beepAlarm = beep.sine2(2954, 1540, 0.1);

beep.enable(true);

exports.currentProgram = null;
exports.busy = false;
exports.audio = 'disabled';
exports.name = "";
exports.type = "";

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
    exports.currentProgram = _.clone(program);

    exports.name = currentName;
    exports.type = exports.currentProgram.type;

    if (exports.currentProgram.items && exports.currentProgram.items.slice) {
        exports.currentProgram.items = exports.currentProgram.items.slice(0);
        exports.currentProgram.items = exports.currentProgram.items.filter(function(item) {
            if (typeof item.condition === "function") {
                return item.condition();
            } else {
                return true;
            }
        });
        for (var i = 0; i < exports.currentProgram.items.length; i++) {
            var item = exports.currentProgram.items[i];
            if (typeof item.name == 'function') {
                exports.currentProgram.items[i] = _.clone(item);
                item = exports.currentProgram.items[i];
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
        if(selected >= exports.currentProgram.items.length) selected = exports.currentProgram.items.length - 1;
    }
    if (exports.currentProgram.type == "timelapse") {
        oled.setTimelapseMode(true);
    } else {
        oled.setTimelapseMode(false);
    }
    if (exports.currentProgram.type == "menu" && exports.currentProgram.hasImages == true) {
        oled.createMenuImage(exports.currentProgram.items.map(function(item) {
            return {
                name: item.name,
                line2: item.line2,
                image: item.image
            };
        }), selected || 0);
        oled.update();
    } else if (exports.currentProgram.type == "menu") {
        oled.create(exports.currentProgram.items.map(function(item) {
            return item.name;
        }), selected || 0);
        oled.update();
    }
    if (exports.currentProgram.type == "options") {
        oled.value(exports.currentProgram.items, selected || 0);
        oled.update();
    }
    if (exports.currentProgram.type == "textInput") {
        oled.text(exports.currentProgram.name, exports.currentProgram.value);
        oled.update();
    }
    if (exports.currentProgram.type == "numberInput") {
        oled.number(exports.currentProgram.name, exports.currentProgram.value);
        oled.update();
    }
    if (exports.currentProgram.type == "timeInput") {
        oled.time(exports.currentProgram.name, exports.currentProgram.value);
        oled.update();
    }
    if (exports.currentProgram.type == "dateInput") {
        oled.date(exports.currentProgram.name, exports.currentProgram.value);
        oled.update();
    }
    if (exports.currentProgram.type == "progress") {
        oled.progress(exports.currentProgram.name, exports.currentProgram.status, exports.currentProgram.progress, exports.currentProgram.button3 ? true : false);
        oled.update();
    }
    if (exports.currentProgram.type == "textDisplay") {
        oled.displayText(exports.currentProgram.name, exports.currentProgram.value);
        oled.update();
    }
    if (exports.currentProgram.type == "png" && exports.currentProgram.file) {
        oled.png(exports.currentProgram.file);
    }
    if (exports.currentProgram.type == "function" && exports.currentProgram.fn) {
        exports.currentProgram.fn(exports.currentProgram.arg, function(err, program) {
            if(!err && program && (program.type)) {
                load(program);
            } else {
                console.log("function completed, going back");
                setTimeout(back);
            }
        });
    }
    if (exports.currentProgram.type == "menuFunction" && exports.currentProgram.fn) {
        exports.currentProgram.fn(exports.currentProgram.arg, function(err, p) {
            if (!err) exports.load(p, true);
        });
    }
}

exports.load = function(menuProgram, noPush, selected, forceStack) {
    exports.busy = false;
    if(exports.currentProgram && exports.currentProgram.intervalHandle) {
        clearInterval(exports.currentProgram.intervalHandle)
        exports.currentProgram.intervalHandle = null;
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
    if (exports.currentProgram.type == "menu" || exports.currentProgram.type == "options") {
        oled.up();
    } else if(exports.currentProgram.type == "textDisplay") {
        oled.up();
    } else if(exports.currentProgram.type == "textInput" || exports.currentProgram.type == "numberInput" || exports.currentProgram.type == "timeInput" || exports.currentProgram.type == "dateInput") {
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
    if (exports.currentProgram.type == "menu" || exports.currentProgram.type == "options") {
        oled.down();
    } else if(exports.currentProgram.type == "textDisplay") {
        oled.down();
    } else if(exports.currentProgram.type == "textInput" || exports.currentProgram.type == "numberInput" || exports.currentProgram.type == "timeInput" || exports.currentProgram.type == "dateInput") {
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
    if (exports.currentProgram.type == "menu" || exports.currentProgram.type == "options") {
        if(exports.currentProgram.items[oled.selected]) exports.load(exports.currentProgram.items[oled.selected].action);
    } else if (exports.currentProgram.type == "textInput") {
        if(alt) {
            oled.textMoveForward();
        } else {
            //console.log("resulting string", oled.getTextValue());
            if(exports.currentProgram.onSave) exports.currentProgram.onSave(oled.getTextValue());
            back();
        }
    } else if (exports.currentProgram.type == "numberInput") {
        if(alt) {
            oled.textMoveForward();
        } else {
            //console.log("resulting string", oled.getTextValue());
            if(exports.currentProgram.onSave) exports.currentProgram.onSave(oled.getNumberValue());
            back();
        }
    } else if (exports.currentProgram.type == "timeInput") {
        if(alt) {
            oled.textMoveForward();
        } else {
            //console.log("resulting string", oled.getTextValue());
            if(exports.currentProgram.onSave) exports.currentProgram.onSave(oled.getTimeValue());
            back();
        }
    } else if (exports.currentProgram.type == "dateInput") {
        if(alt) {
            oled.textMoveForward();
        } else {
            //console.log("resulting string", oled.getTextValue());
            if(exports.currentProgram.onSave) exports.currentProgram.onSave(oled.getDateValue());
            back();
        }
    } else if (exports.currentProgram.type == "png") {
        back();
    } else if (exports.currentProgram.enter && typeof exports.currentProgram.enter == "function") {
        exports.currentProgram.enter();
    }
}
exports.help = function() {
    activity();
    if(exports.busy) return;
    if(exports.currentProgram.type == "textDisplay" && exports.currentProgram.origin == "help") {
        back();
    } else if (exports.currentProgram.type == "menu" || exports.currentProgram.type == "options") {
        if (exports.currentProgram.items[oled.selected] && exports.currentProgram.items[oled.selected].help) {
            exports.load({
                type: "textDisplay",
                origin: "help",
                name: "HELP - " + exports.currentProgram.items[oled.selected].name || exports.currentProgram.name,
                value: exports.currentProgram.items[oled.selected].help
            });
        }
    } else if(exports.currentProgram.help) {
        exports.load({
            type: "textDisplay",
            origin: "help",
            name: "HELP - " + exports.currentProgram.name,
            value: exports.currentProgram.help
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
    return exports.currentProgram.origin;
}
exports.dismissAlert = function() {
    activity();
    if (exports.currentProgram.type == "textDisplay" && exports.currentProgram.origin == "alert" ) back();
}
exports.button3 = function() {
    activity();
    //if(exports.busy) return;
    //beep.play(beepClick);
    if (exports.currentProgram.type == "menu" && exports.currentProgram.items[oled.selected] && exports.currentProgram.items[oled.selected].button3) {
        exports.currentProgram.items[oled.selected].button3(exports.currentProgram.items[oled.selected]);
    } else if (exports.currentProgram.type == "textInput") {
        oled.textCycleMode();
    } else if (exports.currentProgram.button3 && typeof exports.currentProgram.button3 == "function") {
        exports.currentProgram.button3();
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
    if(exports.currentProgram.origin == "prompt" && stack.length > 0) {
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
        if(exports.busy || exports.currentProgram.type == 'progress') return;
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
