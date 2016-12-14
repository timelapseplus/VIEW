var exec = require('child_process').exec;
var pitft = require("pitft");
var fb = pitft("/dev/fb0", true);

var oled = {};

oled.defaultStatusString = "";
var currentStatus = "";
var chargeStatus = null;
var batteryPercentage = null;

oled.items = [];
oled.selected = 0;
oled.visible = false;
oled.blocked = false;

var oledSize = fb.size();
oled.width = oledSize.width;
oled.height = oledSize.height;

var DEFAULT_THEME = {
    primary: [1, 1, 1],
    secondary: [0.1, 0.1, 0.5],
    alert: [1, 0, 0],
    batteryFull: [0.2, 1, 0.2],
    batteryOk: [0.1, 0.5, 0.1],
    batteryLow: [1, 0.2, 0.2],
    help: [0, 0.6, 0],
    background: [0.1, 0.1, 0.1]
}

var RED_THEME = {
    primary: [0.8, 0, 0],
    secondary: [0.5, 0.0, 0.0],
    alert: [1, 0.1, 0.1],
    batteryFull: [0.3, 0.2, 0.2],
    batteryOk: [0.3, 0.2, 0.2],
    batteryLow: [1, 0.2, 0.2],
    help: [0.6, 0, 0],
    background: [0.1, 0.0, 0.0]
}


oled.colors = DEFAULT_THEME;
oled.theme = 'VIEW Default';

oled.setTheme = function(themeName) {
    if(themeName == 'red') {
        oled.theme = 'Night Red';
        oled.colors = RED_THEME;
    } else {
        oled.theme = 'VIEW Default';
        oled.colors = DEFAULT_THEME;
    }
    oled.writeMenu();
    oled.update();
}

oled.init = function() {
    oled.activity();
    fb.clear();
}

var MENU_XOFFSET = 5;
var MENU_YOFFSET = 35;
var MENU_LINE_HEIGHT = 25;
var MENU_FONT_SIZE = 14;
var MENU_TEXT_FONT_SIZE = 12;
var MENU_STATUS_FONT_SIZE = 8;
var MENU_STATUS_XOFFSET = 5;
var MENU_STATUS_YOFFSET = 10;

var TEXT_LIST = {};
TEXT_LIST.alpha = " ABCDEFGHIJKLMNOPQRSTUVWXYZ";
TEXT_LIST.num = " 0123456789";
TEXT_LIST.sym = " ._,-+~=^!@#$%&?*()<>{}[]:;\"'/\\|`";

var TEXT_INDEX = {};
TEXT_INDEX.alpha = 0;
TEXT_INDEX.num = 0;
TEXT_INDEX.sym = 0;

var TEXT_MODES = ['ucase', 'lcase', 'num', 'sym'];

var textMode = 'ucase';
var textValue = "";

oled.block = function() {
    oled.blocked = true;
}

oled.unblock = function() {
    oled.blocked = false;
    oled.writeMenu();
}

oled.textCycleMode = function() {
    if(textMode == 'ucase') {
        textMode = 'lcase';
    } else if(textMode == 'lcase') {
        textMode = 'num';
    } else if(textMode == 'num') {
        textMode = 'sym';
    } else if(textMode == 'sym') {
        textMode = 'ucase';
    }
    textInitPos();
    textUpdateCurrent();
    oled.writeMenu();
    oled.update();
}

function color(name) {
    if(!name || !oled.colors[name]) name = "primary";
    fb.color(oled.colors[name][0], oled.colors[name][1], oled.colors[name][2]);
}

function textInitPos(setMode) {
    var mode = textGetMode();

    if(setMode && oled.selected < textValue.length) {
        for(var i = 0; i < TEXT_MODES.length; i++) {
            mode = textGetMode(TEXT_MODES[i]);
            var list = TEXT_LIST[mode];
            if(TEXT_MODES[i] == 'lcase') list = list.toLowerCase();       
            if(list.indexOf(textValue.charAt(oled.selected)) !== -1) {
                textMode = TEXT_MODES[i];
                console.log("set text mode to", textMode);
                break;
            }
        }
    }

    if(oled.selected < textValue.length && TEXT_LIST[mode].indexOf(textValue.toUpperCase().charAt(oled.selected)) !== -1 && textValue.charAt(oled.selected) != ' ') {
        TEXT_INDEX[mode] = TEXT_LIST[mode].indexOf(textValue.toUpperCase().charAt(oled.selected));
    }
}

function textUpdateCurrent() {
    var char = textGetCurrent();
    while(oled.selected >= textValue.length) {
        textValue += ' ';
    }
    textValue = textValue.substr(0, oled.selected) + char + textValue.substr(oled.selected + 1);
}

oled.textMoveForward = function() {
    if(oled.selected < 24) oled.selected++;    
    textInitPos(true);
    oled.writeMenu();
    oled.update();
}

oled.textMoveBackward = function() {
    if(oled.selected > 0) oled.selected--;
    textValue = textValue.trim();
    textInitPos(true);
    oled.writeMenu();
    oled.update();
}

function textGetMode(currentMode) {
    if(!currentMode) currentMode = textMode;
    var mode;
    if(currentMode == 'ucase' || currentMode == 'lcase') mode = 'alpha'; else mode = currentMode;    
    return mode;
}

function textGetCurrent() {
    var mode = textGetMode();
    var char = TEXT_LIST[mode].charAt(TEXT_INDEX[mode]);
    if(textMode == 'lcase') char = char.toLowerCase();
    if(!char) char = " ";
    return char;
}

function textScrollUp() {
    var mode = textGetMode();
    TEXT_INDEX[mode]++;
    if(TEXT_INDEX[mode] >= TEXT_LIST[mode].length) TEXT_INDEX[mode] = 0;
    textUpdateCurrent();
}

function textScrollDown() {
    var mode = textGetMode();
    TEXT_INDEX[mode]--;
    if(TEXT_INDEX[mode] < 0) TEXT_INDEX[mode] = TEXT_LIST[mode].length - 1;
    textUpdateCurrent();
}

//img116x70, isoText, apertureText, shutterText, intervalSeconds, intervalModeChar, hist60, ramp30, frames, remaining, durationSeconds, bufferSeconds, shutterSeconds
function drawTimeLapseStatus(status) {
    fb.clear();

    color("background");
    fb.rect(0, 15, 116, 70, true); // picture placeholder

    fb.font(MENU_TEXT_FONT_SIZE, false, false);
    color("primary");
    fb.text(120, 15, status.isoText || "---");
    fb.text(120, 15 + 15, status.apertureText || "---");
    fb.text(120, 15 + 15*2, status.shutterText || "---");

    var hours = Math.floor(Math.round(status.duration) / 60);
    var minutes = Math.round(status.duration) % 60;

    fb.text(0, 90, (Math.round(status.intervalSeconds * 10) / 10).toString());
    fb.text(0, 90 + 15, status.frames.toString() + "/" + status.remaining.toString());
    fb.text(0, 90 + 15*2, status.hours.toString() + "h" + status.minutes.toString() + "m");

     // histogram window
    color("background");
    fb.rect(90, 90, 64, 32, true);

    // ramp chart window
    color("background");
    fb.rect(120, 52, 36, 24, true); 

    // interval/exposure status line
    var lw = 156; // line width
    var secondsRatio = lw / status.intervalSeconds;

    color("background");
    fb.line(4, 84, lw, 84, 1); 
    color("alert");
    fb.line(4, 84, shutterSeconds * secondsRatio, 84, 1); 
    color("secondary");
    fb.line(shutterSeconds * secondsRatio, 84, (shutterSeconds + bufferSeconds) * secondsRatio, 84, 1); 


}

oled.timelapseStatus = function(status) {
    drawTimeLapseStatus(status);
}

oled.writeMenu = function() {
    if(oled.blocked) return;
    var itemArray = oled.items;
    var list = [];
    var selected;
    if (oled.selected < 0) oled.selected = 0;

    fb.clear();

    if (oled.setting) { // setting mode
        if (oled.selected >= oled.setting.length) oled.selected = oled.setting.length - 1;
        var name = oled.setting[oled.selected].name || '';
        var value = oled.setting[oled.selected].value || '';

        fb.font(10, false, false);
        color("secondary");
        fb.text(MENU_XOFFSET * 2, 128 / 2 - MENU_FONT_SIZE - 5, name);

        fb.font(MENU_FONT_SIZE * 1.5, false, false);
        color("primary");
        fb.text(MENU_XOFFSET, 128 / 2 + 5, value);

    } else if (oled.textLines) { // text display mode
        fb.font(MENU_STATUS_FONT_SIZE, false, false);
        color("secondary");
        fb.text(MENU_STATUS_XOFFSET, MENU_STATUS_YOFFSET, oled.textTitle);

        fb.font(MENU_TEXT_FONT_SIZE, false, false);
        color("alert");
        fb.text(160 - 10, 12, "x");

        color("primary");
        for(var i = 0; i < 8; i++) {
            if(i + oled.selected >= oled.textLines.length) break;
            fb.text(0, 26 + i * 16, oled.textLines[i + oled.selected]);
        }
    } else if (oled.textInput) { // text input mode
        var name = oled.textInput || '';

        fb.font(10, false, false);
        color("secondary");
        fb.text(MENU_XOFFSET * 2, 128 / 2 - MENU_FONT_SIZE - 12, name);

        fb.font(MENU_FONT_SIZE * 1.5, false, true); // monospace font
        color("primary");
        var xAdvance = 15;
        var xStart;
        var startOffset = 0;
        if(oled.selected > 9) startOffset = oled.selected - 9;

        for(var i = 0; i < 10; i++) {
            xStart = MENU_XOFFSET + (i * xAdvance);
            if(oled.selected - startOffset == i) {
                color("secondary");
                var x = xStart - 2;
                var y = 128 / 2 - 10;
                var w = xAdvance - 1;
                var h = 25;
                fb.line(x, y, x + w / 2, y - 5, 2, 0.1, 0.1, 0.5);
                fb.line(x + w / 2, y - 5, x + w, y, 2, 0.1, 0.1, 0.5);

                fb.line(x, y + h, x + w / 2, y + h + 5, 2, 0.1, 0.1, 0.5);
                fb.line(x + w / 2, y + h + 5, x + w, y + h, 2, 0.1, 0.1, 0.5);

            }
            color("primary");
            if(i < textValue.length - startOffset) fb.text(xStart, 128 / 2 + 9, textValue.charAt(i + startOffset));
        }

        var y = 128 / 2 + 2;
        var w = 4;
        var h = 10;

        if(startOffset > 0) {
            color("alert");
            fb.line(0, y, w, y - h / 2, 2);
            fb.line(0, y, w, y + h / 2, 2);
        }
        if(textValue.length - startOffset > 10) {
            color("alert");
            fb.line(160, y, 160 - w, y - h / 2, 2);
            fb.line(160, y, 160 - w, y + h / 2, 2);
        }

        color("primary");
        fb.font(MENU_FONT_SIZE, false, true); // monospace font
        var modes = ['A', 'a', '1', '$'];
        var cMode = 0;
        if(textMode == 'ucase') cMode = 0;
        if(textMode == 'lcase') cMode = 1;
        if(textMode == 'num') cMode = 2;
        if(textMode == 'sym') cMode = 3;
        var xAdvance = 10;
        for(var i = 0; i < modes.length; i++) {
            if(cMode == i) {
                color("primary");
            } else {
                color("secondary");
            }           
            fb.text(160 - 48 + i * xAdvance, 125, modes[i]);
        }
        color("primary");
        var w = 5;
        var h = 8;
        var x = 160 - w;
        var y = 128 - h - 1;

        fb.line(x, y, x + w, y + h / 2, 1, 1, 1, 1);
        fb.line(x + w, y + h / 2, x, y + h, 1, 1, 1, 1);

        color("help");
        fb.font(10, false, false);
        fb.text(0, 128 - 20, "press knob to advance");
        fb.text(0, 128 - 10, "cursor, press and");
        fb.text(0, 128 - 0, "hold to scroll cursor");


    } else { // menu mode
        
        if (oled.selected >= itemArray.length) selected = itemArray.length - 1;
        if (itemArray.length <= 3) {
            list = itemArray;
            selected = oled.selected;
        } else if (oled.selected == itemArray.length - 1) {
            list = itemArray.slice(oled.selected - 2, oled.selected + 3);
            selected = 2;
        } else if (oled.selected == 0) {
            list = itemArray.slice(0, 5);
            selected = 0;
        } else {
            list = itemArray.slice(oled.selected - 1, oled.selected + 4);
            selected = 1;
        }
        if (!selected) selected = 0;
        if (selected >= list.length) selected = list.length - 1;

        // draw status bar
        fb.font(MENU_STATUS_FONT_SIZE, false, false);
        color("primary");
        fb.text(MENU_STATUS_XOFFSET, MENU_STATUS_YOFFSET, currentStatus);

        // draw battery status
        if(batteryPercentage !== null) {
            var bx = 160 - 20.5;
            var by = 2.5;

            var bw = 18;
            var bh = 8

            color("primary");
            fb.rect(bx, by, bw, bh, false); // battery outline
            fb.line(bx + bw + 1, by + bh * .25, bx + bw + 1, by + bh * .75, 1, 1, 1, 1); // bump

            var fillWidth = Math.ceil((batteryPercentage / 100) * (bw - 1.5));
            if(fillWidth < 1) fillWidth = 1;
            if(batteryPercentage > 20) {
                color("batteryOk");
            } else if(batteryPercentage == 100) {
                color("batteryFull");
            } else {
                color("batteryLow");
            }
            fb.rect(bx + 0.5, by + 0.5, fillWidth, bh - 1, true); // battery fill

            if(chargeStatus) {
                color("primary");
                fb.line(bx + bw * .25, by + bh * .5, bx + bw * .5, by + bh * .4, 1, 1, 1, 1);
                fb.line(bx + bw * .5, by + bh * .25, bx + bw * .5, by + bh * .6, 1.5, 1, 1, 1);
                fb.line(bx + bw * .5, by + bh * .75, bx + bw * .75, by + bh * .5, 1, 1, 1, 1);
            }

        }

        // draw selection area
        var sX = 0;
        var sY = MENU_YOFFSET - (MENU_LINE_HEIGHT / 2 + 5) + selected * MENU_LINE_HEIGHT;
        var sW = oled.width - 1;
        var sH = MENU_LINE_HEIGHT - 2;

        color("secondary");
        fb.rect(sX, sY, sW, sH, false);
        fb.rect(sX + 1, sY + 1, sW, sH, false);

        // draw menu text
        fb.font(MENU_FONT_SIZE, false, false);
        color("primary");
        for(var i = 0; i < list.length; i++) {
            var parts = list[i].split('~');

            var textSize = fb.text(MENU_XOFFSET, MENU_YOFFSET + i * MENU_LINE_HEIGHT, parts[0]);
            
            if(parts[1]) { // menu item value
                color("secondary");
                fb.text(MENU_XOFFSET + textSize.width, MENU_YOFFSET + i * MENU_LINE_HEIGHT, ' ' + parts[1]);
                color("primary");
            }
        }

    }
}

oled.showBusy = function() {
    var s = "loading...";

    fb.font(MENU_FONT_SIZE, false, false);
    var ts = fb.textSize(s);
    var pad = 6;
    var w = ts.width + pad * 2;
    var h = 20;
    var x = 160 / 2 - w / 2;
    var y = 128 / 2 - h / 2;


    fb.color(0, 0, 0);
    fb.rect(x - 1, y - 1, w + 2, h + 2, true);
    color("alert");
    fb.rect(x, y, w, h, false);
    fb.text(x + pad, y + h - 5, s);
    oled.update();
}

var screenTimeout = null;
oled.create = function(itemArray, selected) {
    oled.textInput = null;
    oled.textLines = null;
    oled.setting = null;
    oled.items = itemArray;
    oled.selected = selected || 0;
    oled.writeMenu();
}

oled.value = function(pairs, selected) {
    oled.textInput = null;
    oled.textLines = null;
    oled.setting = pairs;
    oled.selected = selected || 0;
    oled.writeMenu();
}

oled.text = function(name, value) {
    console.log("setting up text input: ", name, value);
    oled.setting = null;
    oled.textLines = null;
    oled.textInput = name;
    oled.selected = 0;
    textValue = value || "";
    textMode = 'ucase';
    textInitPos(true);
    oled.writeMenu();
}

oled.displayText = function(title, text) {
    oled.textInput = null;
    oled.textLines = null;
    oled.setting = null;
    oled.textTitle = title;
    var maxWidth = 158;
    var words = text.replace(/[\n\r]+/g, ' \n ').replace(/[ ]+/g, ' ').split(' ');
    oled.textLines = [];
    fb.font(MENU_TEXT_FONT_SIZE, false, false);
    var i = 0;
    var line = "";
    for(i = 0; i < words.length; i++) {
        if(words[i] == "\n") {
            if(line.length > 0) oled.textLines.push(line);
            line = "";
            oled.textLines.push(' ');
            continue;
        }
        var newLine = (line + ' ' + words[i]).trim();
        var size = fb.textSize(newLine);
        if(size.width <= maxWidth) {
            line = newLine;
        } else {
            oled.textLines.push(line);
            line = (words[i]).trim();
        }
    }
    if(line.length > 0) oled.textLines.push(line);
    oled.selected = 0;
    oled.writeMenu();
}

oled.getTextValue = function() {
    return textValue.trim();
}

oled.select = function(index) {
    oled.selected = index;
}

oled.activity = function() {
    if (screenTimeout) clearTimeout(screenTimeout);
    screenTimeout = setTimeout(oled.hide, 30000);
    if (!oled.visible) oled.show();
}

oled.update = function() {
    fb.blit();
}

oled.up = function() {
    if (oled.textInput) {
        textScrollDown();
        oled.writeMenu();
        oled.update();
    } else if (oled.selected > 0) {
        oled.selected--;
        oled.select(oled.selected);
        oled.writeMenu();
        oled.update();
    }
}

oled.down = function() {
    if (oled.textInput) {
        textScrollUp();
        oled.writeMenu();
        oled.update();
    } else if (oled.textLines) {
        if(oled.selected < oled.textLines.length - 3) {
            oled.selected++;
            oled.writeMenu();
            oled.update();
        }
    } else if (oled.setting || oled.selected < oled.items.length - 1) {
        oled.selected++;
        oled.select(oled.selected);
        oled.writeMenu();
        oled.update();
    }
}

oled.hide = function() {
    if(oled.videoRunning) return oled.activity();
    console.log("power off  OLED");
    exec("echo 0 | sudo tee /sys/class/leds/view-oled-backlight/brightness");
    oled.visible = false;
}

oled.show = function() {
    exec("echo 255 | sudo tee /sys/class/leds/view-oled-backlight/brightness");
    oled.visible = true;
}

oled.close = function() {
}

oled.jpeg = function(jpegFile, x, y, overlay) {
    if(!overlay) fb.clear();
    fb.jpeg(x||0, y||0, jpegFile);
}

oled.png = function(pngFile, x, y, overlay) {
    if(!overlay) fb.clear();
    fb.png(x||0, y||0, pngFile);
    fb.blit();
}

function writeStatus(status) {
    console.log("setting oled status:", status);
    currentStatus = status;
    oled.writeMenu();
    oled.update();
}

var statusTimeoutHandle = null;

oled.status = function(status) {
    if(statusTimeoutHandle) clearTimeout(statusTimeoutHandle);
    if(status) {
        writeStatus(status);
        if(oled.defaultStatusString) {
            statusTimeoutHandle = setTimeout(function(){
                writeStatus(oled.defaultStatusString);
            }, 6000);
        }
    } else {
        writeStatus(oled.defaultStatusString);
    }
}

oled.defaultStatus = function(status) {
    oled.defaultStatusString = status;
}

oled.chargeStatus = function(status) {
    chargeStatus = status;
    oled.writeMenu();
    oled.update();
}

oled.batteryPercentage = function(percentage) {
    batteryPercentage = percentage;
    oled.writeMenu();
    oled.update();
}

var videoIntervalHandle = null;
var videoCallback = null;
var skipFrames = 0;
oled.video = function(videoPathFormat, frames, fps, callback) {
    if(oled.videoRunning) return;
    if(!frames) return;
    oled.block();
    videoCallback = callback;
    fb.clear();
    oled.videoRunning = true;
    var frameIndex = 0;
    skipFrames = 0;
    var indexString, paddingLength;
    var frameComplete = true;
    videoIntervalHandle = setInterval(function(){
        if(!frameComplete) {
            console.log("dropping frame #" + index);
            return; // drop frame
        }
        frameComplete = false;
        frameIndex++;
        frameIndex += skipFrames;
        skipFrames = 0;
        if(frameIndex > frames) oled.stopVideo();
        indexString = frameIndex.toString();
        paddingLength = 5 - indexString.length;
        while(paddingLength > 0) {
            paddingLength--;
            indexString = '0' + indexString;
        }
        fb.jpeg(0, 0, videoPathFormat.replace('%05d', indexString));
        frameComplete = true;
    }, 1000 / (fps||24));
}

oled.stopVideo = function() {
    oled.videoRunning = false;
    if(videoIntervalHandle) clearInterval(videoIntervalHandle);
    oled.unblock();
    if(videoCallback) videoCallback();
}
oled.videoSkipFrames = function(frames) {
    if(oled.videoRunning) {
        skipFrames = frames;
    }
}
module.exports = oled;