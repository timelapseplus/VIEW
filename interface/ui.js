var _ = require('underscore');
var menu = null;
var currentProgram = null;
var backupProgram = null;
var currentName = "";
var stack = [];
var screenSaverHandle = null;

function activity() {
    if (screenSaverHandle) clearTimeout(screenSaverHandle);
    screenSaverHandle = setTimeout(function() {
        if (menu.visible) menu.hide();
    }, 30000);
    if (!menu.visible) menu.show();
}

exports.init = function(menuController) {
    menu = menuController;
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
    }
    if (currentProgram.type == "menu") {
        menu.create(currentProgram.items.map(function(item) {
            return item.name;
        }), selected || 0);
        menu.update();
    }
    if (currentProgram.type == "options") {
        menu.value(currentProgram.items, selected || 0);
        menu.update();
    }
    if (currentProgram.type == "textInput") {
        menu.text(currentProgram.name, currentProgram.value);
        menu.update();
    }
    if (currentProgram.type == "textDisplay") {
        menu.displayText(currentProgram.name, currentProgram.value);
        menu.update();
    }
    if (currentProgram.type == "png" && currentProgram.file) {
        menu.png(currentProgram.file);
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

exports.load = function(menuProgram, noPush, selected) {
    if (backupProgram !== null && !noPush && backupProgram.type != "options") {
        stack.push({
            program: backupProgram,
            selected: menu.selected,
            name: currentName
        });
    }
    backupProgram = menuProgram;

    if (typeof menuProgram == 'function') {
        menuProgram(function(arg, program) {
            load(program, selected);
        });
    } else {
        load(menuProgram, selected);
    }

}

exports.reload = function() {
    if (backupProgram.type == "menu" || backupProgram.type == "options") {
        exports.load(backupProgram, true, menu.selected);
    }
}

exports.up = function(alt) {
    activity();
    if (currentProgram.type == "menu" || currentProgram.type == "options" || currentProgram.type == "textDisplay") {
        menu.up();
    } else if(currentProgram.type == "textInput") {
        if(alt) {
            menu.textMoveBackward();
        } else {
            menu.up();
        }
    }
}
exports.down = function(alt) {
    activity();
    if (currentProgram.type == "menu" || currentProgram.type == "options" || currentProgram.type == "textDisplay") {
        menu.down();
    } else if(currentProgram.type == "textInput") {
        if(alt) {
            menu.textMoveForward();
        } else {
            menu.down();
        }
    }
}
exports.enter = function(alt) {
    activity();
    if (currentProgram.type == "menu" || currentProgram.type == "options") {
        if(currentProgram.items[menu.selected]) exports.load(currentProgram.items[menu.selected].action);
    } else if (currentProgram.type == "textInput") {
        if(alt) {
            menu.textMoveForward();
        } else {
            console.log("resulting string", menu.getTextValue());
            if(currentProgram.onSave) currentProgram.onSave(menu.getTextValue());
            exports.back();
        }
    } else if (currentProgram.type == "png" || currentProgram.type == "textDisplay") {
        exports.back();
    }
}
exports.help = function() {
    activity();
    if (currentProgram.help) {
        exports.load({
            type: "textDisplay",
            name: currentProgram.name,
            value: currentProgram.help
        });
    }
}
exports.button3 = function() {
    if (currentProgram.type == "menu" && currentProgram.items[menu.selected].button3) {
        currentProgram.items[menu.selected].button3(currentProgram.items[menu.selected]);
    } else if (currentProgram.type == "textInput") {
        menu.textCycleMode();
    }
}
exports.back = function() {
    if (stack.length > 0) {
        activity();
        var b = stack.pop();
        console.log("BACK to " + b.name);
        exports.load(b.program, true, b.selected);
    } else {
        if (menu.visible) menu.hide();
    }
}

exports.set = function(object, key, value) {
    return {
        type: "function",
        fn: function(arg, cb) {
            object[key] = value;
            if (cb) cb();
        },
        selected: exports.select(object, key, value)
    }
}

exports.select = function(object, key, value) {
    return function() {
        return object && object[key] == value;
    }
}