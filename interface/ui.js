var _ = require('underscore');
var oled = null;
var currentProgram = null;
var backupProgram = null;
var currentName = "";
var stack = [];
var screenSaverHandle = null;

exports.busy = false;

function activity() {
    oled.activity();
}

exports.init = function(menuController) {
    oled = menuController;
}

function load(program, selected) {
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
    if (currentProgram.type == "menu") {
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
    if (currentProgram.type == "textDisplay") {
        oled.displayText(currentProgram.name, currentProgram.value);
        oled.update();
    }
    if (currentProgram.type == "png" && currentProgram.file) {
        oled.png(currentProgram.file);
    }
    if (currentProgram.type == "function" && currentProgram.fn) {
        currentProgram.fn(currentProgram.arg, function(err, program) {
            if(!err && program && program.type) {
                load(program);
            } else {
                console.log("function completed, going back");
                setTimeout(exports.back);
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
    if ((forceStack && backupProgram !== null) || (backupProgram !== null && !noPush && backupProgram.type != "options" && backupProgram.type != "function")) {
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
    if(exports.busy) return;
    activity();
    if (currentProgram.type == "menu" || currentProgram.type == "options") {
        oled.up();
    } else if(currentProgram.type == "textDisplay") {
        oled.up();
    } else if(currentProgram.type == "textInput") {
        if(alt) {
            oled.textMoveBackward();
        } else {
            oled.up();
        }
    }
}
exports.down = function(alt) {
    if(exports.busy) return;
    activity();
    if (currentProgram.type == "menu" || currentProgram.type == "options") {
        oled.down();
    } else if(currentProgram.type == "textDisplay") {
        oled.down();
    } else if(currentProgram.type == "textInput") {
        if(alt) {
            oled.textMoveForward();
        } else {
            oled.down();
        }
    }
}
exports.enter = function(alt) {
    if(exports.busy) return;
    activity();
    if (currentProgram.type == "menu" || currentProgram.type == "options") {
        if(currentProgram.items[oled.selected]) exports.load(currentProgram.items[oled.selected].action);
    } else if (currentProgram.type == "textInput") {
        if(alt) {
            oled.textMoveForward();
        } else {
            console.log("resulting string", oled.getTextValue());
            if(currentProgram.onSave) currentProgram.onSave(oled.getTextValue());
            exports.back();
        }
    } else if (currentProgram.type == "png") {
        exports.back();
    }
}
exports.help = function() {
    if(exports.busy) return;
    activity();
    if(currentProgram.type == "textDisplay" && currentProgram.origin == "help") {
        exports.back();
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
exports.alert = function(title, text) {
    activity();
    exports.load({
        type: "textDisplay",
        origin: "alert",
        name: title,
        value: text
    });
}
exports.dismissAlert = function() {
    activity();
    if (currentProgram.type == "textDisplay" && currentProgram.origin == "alert" ) exports.back();
}
exports.button3 = function() {
    if(exports.busy) return;
    if (currentProgram.type == "menu" && currentProgram.items[oled.selected] && currentProgram.items[oled.selected].button3) {
        currentProgram.items[oled.selected].button3(currentProgram.items[oled.selected]);
    } else if (currentProgram.type == "textInput") {
        oled.textCycleMode();
    }
}
exports.back = function() {
    if(exports.busy) return;
    if (stack.length > 0) {
        activity();
        var b;
        do {
            b = stack.pop();
        } while(!b.name || b.origin == 'prompt');

        console.log("BACK to " + b.name);
        exports.load(b.program, true, b.selected);
    } else {
        if (oled.visible) oled.hide();
    }
}

exports.set = function(object, key, value, callback) {
    return {
        type: "function",
        fn: function(arg, cb) {
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
                    exports.back();
                    if(callback1) callback1(cb); else cb();
                }
            }
        }, {
            name: promptText,
            value: optionText2,
            help: helpText,
            action: {
                type: 'function',
                fn: function(arg, cb) {
                    exports.back();
                    if(callback2) callback2(cb); else cb();
                }
            }
        }]
    }, null, null, true);
}


