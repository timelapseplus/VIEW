var exec = require('child_process').exec;
var pitft = require("pitft");
var fb = pitft("/dev/fb0", true);
var fs = require('fs');
var moment = require('moment');

var oled = {};

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

var FONT_DEFAULT = 0;
var FONT_MONO = 1;
var FONT_ICON = 2;

var ICON_STAR = '';
var ICON_CAMERA = '';
var ICON_WIFI = '';
var ICON_WEB = '';
var ICON_BT = '';
var ICON_GPS = '';

var icon = {};

var DEFAULT_THEME = {
    primary: [1, 1, 1],
    //secondary: [0.1, 0.1, 0.5],
    secondary: [0.1, 0.1, 0.9],
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

var HC_THEME = {
    primary: [1, 1, 1],
    secondary: [1, 1, 0.5],
    alert: [1, 0, 0],
    batteryFull: [0.2, 1, 0.2],
    batteryOk: [0.1, 0.5, 0.1],
    batteryLow: [1, 0.2, 0.2],
    help: [0, 1, 0],
    background: [0.1, 0.1, 0.1]
}


oled.colors = DEFAULT_THEME;
oled.theme = 'VIEW Default';

oled.setTheme = function(themeName) {
    if(themeName == 'red') {
        oled.theme = 'Night Red';
        oled.colors = RED_THEME;
    } else if(themeName == 'hc') {
        oled.theme = 'High Contrast';
        oled.colors = HC_THEME;
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
var MENU_SELECT_FONT_SIZE = 18
var MENU_TEXT_FONT_SIZE = 12;
var MENU_STATUS_FONT_SIZE = 8;
var MENU_STATUS_XOFFSET = 5;
var MENU_STATUS_YOFFSET = 10;
var IMAGE_WIDTH = 75;
var IMAGE_HEIGHT = 40;

oled.IMAGE_WIDTH = IMAGE_WIDTH;
oled.IMAGE_HEIGHT = IMAGE_HEIGHT;

var TEXT_MAX_CHARS = 32;
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

    if(textMode != 'number' && setMode && oled.selected < textValue.length) {
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
    var list = getTextList();
    if(oled.selected < textValue.length && list.indexOf(textValue.toUpperCase().charAt(oled.selected)) !== -1 && textValue.charAt(oled.selected) != ' ') {
        TEXT_INDEX[mode] = list.indexOf(textValue.toUpperCase().charAt(oled.selected));
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
    if(oled.mode == 'text' || oled.mode == 'number') {
        if(oled.selected < TEXT_MAX_CHARS) oled.selected++;    
        if(textMode == 'number') {
            var textLength = textValue.length;
            textValue = textValue.replace(/ /g, '');
            oled.selected -= textLength - textValue.length;
        }
        textInitPos(true);
    } else if(oled.mode == 'time' || oled.mode == "date") {
        if(oled.selected < 2) oled.selected++; else oled.selected = 0;  
    }
    oled.writeMenu();
    oled.update();
}

oled.textMoveBackward = function() {
    if(oled.selected > 0) oled.selected--;
    if(oled.mode == 'text' || oled.mode == 'number') {
        textValue = textValue.trim();
        if(textMode == 'number') {
            textValue = textValue.replace(/ /g, '');
        }
        textInitPos(true);
    }
    oled.writeMenu();
    oled.update();
}

function textGetMode(currentMode) {
    if(!currentMode) currentMode = textMode;
    var mode;
    if(currentMode == 'ucase' || currentMode == 'lcase') mode = 'alpha'; else mode = currentMode == 'number' ? 'num' : currentMode;    
    return mode;
}

function textGetCurrent() {
    var mode = textGetMode();
    var list = getTextList();
    var char = list.charAt(TEXT_INDEX[mode]);
    if(textMode == 'lcase') char = char.toLowerCase();
    if(!char) {
        char = textMode == 'number' ? "0" : " ";
    }
    return char;
}

function getTextList() {
    if(textMode == 'number') {
        if(oled.selected == 0) {
            return TEXT_LIST['num'].concat(['-']);
        } else if(textValue.indexOf('.') === -1 || textValue.indexOf('.') === oled.selected) {
            return TEXT_LIST['num'].concat(['.']);
        } else {
            return TEXT_LIST['num'];
        }        
    } else {
        return TEXT_LIST[textGetMode()];
    }
}

function textScrollUp() {
    var mode = textGetMode();
    TEXT_INDEX[mode]++;
    var list = getTextList();
    if(TEXT_INDEX[mode] >= list.length) TEXT_INDEX[mode] = 0;
    textUpdateCurrent();
}

function textScrollDown() {
    var mode = textGetMode();
    TEXT_INDEX[mode]--;
    var list = getTextList();
    if(TEXT_INDEX[mode] < 0) TEXT_INDEX[mode] = list.length - 1;
    textUpdateCurrent();
}

//img100x68, hist60, ramp30
//isoText, apertureText, shutterText, intervalSeconds, intervalModeChar, frames, remaining, durationSeconds, bufferSeconds, shutterSeconds
var statusDetails = {};
function drawTimeLapseStatus(status) {
    if (!oled.visible) return; // don't waste cpu if not seen
    fb.clear();

    var imageWidth = 110;
    var upperTextStart = imageWidth + 4

    fb.font(MENU_TEXT_FONT_SIZE, false, FONT_DEFAULT);
    color("primary");
    fb.text(upperTextStart, 24, status.isoText || "---");
    fb.text(upperTextStart, 37, status.apertureText || "---");
    fb.text(upperTextStart, 50, status.shutterText || "---");
    fb.text(upperTextStart, 63, status.evText || "---");
    fb.text(upperTextStart, 76, status.rampModeText);

    var m = Math.round(status.durationSeconds / 60);
    var hours = Math.floor(m / 60);
    var minutes = m % 60;

    if(status.remaining === null) status.remaining = "Inf";

    fb.text(0, 100, "Interval: " + (Math.round(status.intervalSeconds * 10) / 10).toString() + "s (" + status.intervalModeText + ")");
    fb.text(0, 113, "Frames:   " + (status.frames || 0).toString() + "/" + status.remaining.toString());
    fb.text(0, 126, "Duration: " + hours.toString() + "h" + minutes.toString() + "m");

    // ramp chart window
    //color("background");
    //fb.rect(110, 88, 50, 40, true);

    // histogram window
    color("background");
    var histX = 110;
    var histY = 90;
    var histH = 37;
    var histW = 50;
    if(statusDetails.histogram) {
        fb.rect(histX, histY, histW, histH, false);
        color("primary");
        for(var i = 0; i < 256; i++) {
            var x = histX + 1 + (histW - 2) * (i/255);
            var h = statusDetails.histogram[i] ? (histH - 2) * (statusDetails.histogram[i]/256) : 0;
            fb.line(x, histY + 1 + histH - h, x, histY + 1 + histH, 1);
        }
    } else {
        fb.rect(histX, histY, histW, histH, false); 
    }

    // interval/exposure status line
    var lw = 156; // line width
    var secondsRatio = lw / status.intervalSeconds;

    var intervalPos = ((new Date() / 1000) - status.captureStartTime) * secondsRatio;
    if(intervalPos > lw) intervalPos = lw;
    intervalPos = Math.round(intervalPos) + 3.5;
    color("primary");
    fb.line(intervalPos, 84.5 - 2, intervalPos, 84.5 + 2, 2);

    var shutterLineStart = 4;
    var shutterLineEnd = shutterLineStart + Math.ceil(status.shutterSeconds * secondsRatio);
    var bufferLineStart = shutterLineEnd;
    var bufferLineEnd = shutterLineEnd + Math.ceil(status.bufferSeconds * secondsRatio);

    color("background");
    fb.line(4, 84.5, lw, 84.5, 1); 
    color("alert");
    fb.line(shutterLineStart, 84.5, shutterLineEnd, 84.5, 1); 
    color("secondary");
    fb.line(bufferLineStart, 84.5, bufferLineEnd, 84.5, 1);

    if(statusDetails.img110) {
        oled.jpeg(statusDetails.img110, 0, 15, true);
    } else {
        color("background");
        fb.rect(0, 15, 105, 65, true); // picture placeholder
    }
    drawStatusBar();
    oled.update();
}

var statusIntervalHandle = null;
oled.updateTimelapseStatus = function(status) {
    if(statusIntervalHandle) {
        clearTimeout(statusIntervalHandle);
        statusIntervalHandle = null;
    }
    if(status) {
        oled.timelapseStatus = status;
        if(status.running) {
            if(oled.mode == 'timelapse') statusIntervalHandle = setInterval(function(){drawTimeLapseStatus(status);}, 100); 
        } else {
            statusDetails = {};
        }
    }
}
oled.updateThumbnailPreview = function(path) {
    setTimeout(function(){
        statusDetails.img110 = path;
    }, 100);
}
oled.updateHistogram = function(histogram) {
    setTimeout(function(){
        statusDetails.histogram = histogram;
    }, 100);
}

oled.setTimelapseMode = function(set) {
    if(set) {
        oled.mode = 'timelapse';
        oled.writeMenu();
    } else {
        oled.mode = 'menu';
        oled.updateTimelapseStatus();
    }
}

oled.setIcon = function(type, enabled) {
    icon[type] = enabled;
}

function drawStatusBar() {
    // draw status bar
    fb.font(MENU_STATUS_FONT_SIZE, false, FONT_DEFAULT);
    color("primary");
    fb.text(MENU_STATUS_XOFFSET, MENU_STATUS_YOFFSET, currentStatus);

    // draw icons
    fb.font(MENU_STATUS_FONT_SIZE, false, FONT_ICON);
    var statusIconX = 160 - 33.5;
    if(icon.wifi) {
        fb.text(statusIconX, MENU_STATUS_YOFFSET - 0.5, ICON_WIFI);
        statusIconX -= 10;
    }
    if(icon.bt) {
        fb.text(statusIconX, MENU_STATUS_YOFFSET - 0.5, ICON_BT);
        statusIconX -= 10;
    }
    if(icon.web) {
        fb.text(statusIconX, MENU_STATUS_YOFFSET - 0.5, ICON_WEB);
        statusIconX -= 10;
    }
    if(icon.camera) {
        fb.text(statusIconX, MENU_STATUS_YOFFSET - 0.5, ICON_CAMERA);
        statusIconX -= 10;
    }
    if(icon.gps) {
        fb.text(statusIconX, MENU_STATUS_YOFFSET - 0.5, ICON_GPS);
        statusIconX -= 10;
    }


    // draw battery status
    if(batteryPercentage != null) {
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
}

oled.writeMenu = function() {
    if(oled.blocked) return;
    var itemArray = oled.items;
    var list = [];
    var selected;
    if (oled.selected < 0) oled.selected = 0;

    if (oled.mode != 'timelapse') fb.clear();

    if (oled.mode == 'timelapse') {
        if(oled.timelapseStatus) oled.updateTimelapseStatus(oled.timelapseStatus);
    } else if (oled.mode == 'list') { // setting mode
        if (oled.selected >= oled.setting.length) oled.selected = oled.setting.length - 1;
        var name = oled.setting[oled.selected].name || '';
        var value = oled.setting[oled.selected].value || '';

        fb.font(10, false, FONT_DEFAULT);
        color("secondary");
        fb.text(MENU_XOFFSET * 2, 128 / 2 - MENU_FONT_SIZE - 5, name);

        fb.font(MENU_SELECT_FONT_SIZE, false, FONT_DEFAULT);
        color("primary");
        fb.text(MENU_XOFFSET, 128 / 2 + 5, value);

    } else if (oled.mode == 'read') { // text display mode
        fb.font(MENU_STATUS_FONT_SIZE, false, FONT_DEFAULT);
        color("secondary");
        fb.text(MENU_STATUS_XOFFSET, MENU_STATUS_YOFFSET, oled.textTitle);

        fb.font(MENU_TEXT_FONT_SIZE, false, FONT_DEFAULT);
        color("alert");
        fb.text(160 - 10, 12, "x");

        color("primary");
        for(var i = 0; i < 8; i++) {
            if(i + oled.selected >= oled.textLines.length) break;
            fb.text(0, 26 + i * 16, oled.textLines[i + oled.selected]);
        }
    } else if (oled.mode == 'text' || oled.mode == 'number') { // text/number input mode
        var name = oled.name || '';

        fb.font(10, false, FONT_DEFAULT);
        color("secondary");
        fb.text(MENU_XOFFSET * 2, 128 / 2 - MENU_FONT_SIZE - 12, name);

        fb.font(MENU_SELECT_FONT_SIZE, false, FONT_MONO); // monospace font
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

        if(textMode != 'number') {
            color("primary");
            fb.font(MENU_FONT_SIZE, false, FONT_MONO); // monospace font
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
        }

        color("help");
        fb.font(10, false, FONT_DEFAULT);
        fb.text(0, 128 - 20, "press knob to advance");
        fb.text(0, 128 - 10, "cursor, press and");
        fb.text(0, 128 - 0, "hold to scroll cursor");


    } else if (oled.mode == 'time') { // date/time input mode
        var name = oled.name || '';

        fb.font(10, false, FONT_DEFAULT);
        color("secondary");
        fb.text(MENU_XOFFSET * 2, 128 / 2 - MENU_FONT_SIZE - 12, name);

        fb.font(MENU_SELECT_FONT_SIZE, false, FONT_MONO); // monospace font
        color("primary");
        var xAdvance = 15;
        var xStart;

        var h = oled.timeObject.hours.toString();
        if(h.length < 2) h = '0' + h;
        if(h.length < 2) h = '0' + h;
        var m = oled.timeObject.minutes.toString();
        if(m.length < 2) m = '0' + m;
        if(m.length < 2) m = '0' + m;
        var s = oled.timeObject.seconds.toString();
        if(s.length < 2) s = '0' + s;
        if(s.length < 2) s = '0' + s;

        var timeString = h + ':' + m + ':' + s;

        for(var i = 0; i < 3; i++) {
            xStart = MENU_XOFFSET + (i * xAdvance * 2);
            if(oled.selected == i) {
                color("secondary");
                var x = xStart - 2 + xAdvance / 2;
                var y = 128 / 2 - 10;
                var w = xAdvance - 1;
                var h = 25;
                fb.line(x, y, x + w / 2, y - 5, 2, 0.1, 0.1, 0.5);
                fb.line(x + w / 2, y - 5, x + w, y, 2, 0.1, 0.1, 0.5);

                fb.line(x, y + h, x + w / 2, y + h + 5, 2, 0.1, 0.1, 0.5);
                fb.line(x + w / 2, y + h + 5, x + w, y + h, 2, 0.1, 0.1, 0.5);

            }
            color("primary");
        }
        fb.text(MENU_XOFFSET, 128 / 2 + 9, timeString);

        color("help");
        fb.font(10, false, FONT_DEFAULT);
        fb.text(0, 128 - 20, "press knob to advance");
        fb.text(0, 128 - 10, "cursor, press and");
        fb.text(0, 128 - 0, "hold to scroll cursor");


    } else if (oled.mode == 'date') { // date/time input mode
        var name = oled.name || '';

        fb.font(10, false, FONT_DEFAULT);
        color("secondary");
        fb.text(MENU_XOFFSET * 2, 128 / 2 - MENU_FONT_SIZE - 12, name);

        fb.font(MENU_SELECT_FONT_SIZE, false, FONT_MONO); // monospace font
        color("primary");
        var xAdvance = 15;
        var xStart;

        var d = oled.timeObject.moment.format("D");
        if(d.length < 2) d = ' ' + d;
        var m = oled.timeObject.moment.format("MMM");
        var y = oled.timeObject.moment.format("YYYY");

        var dateString = d + ' ' + m + ' ' + y;

        for(var i = 0; i < 3; i++) {
            xStart = MENU_XOFFSET + (i * xAdvance * 3);
            if(oled.selected == i) {
                color("secondary");
                var x = xStart - 2 + xAdvance / 2;
                var y = 128 / 2 - 10;
                var w = xAdvance - 1;
                var h = 25;
                fb.line(x, y, x + w / 2, y - 5, 2, 0.1, 0.1, 0.5);
                fb.line(x + w / 2, y - 5, x + w, y, 2, 0.1, 0.1, 0.5);

                fb.line(x, y + h, x + w / 2, y + h + 5, 2, 0.1, 0.1, 0.5);
                fb.line(x + w / 2, y + h + 5, x + w, y + h, 2, 0.1, 0.1, 0.5);

            }
            color("primary");
        }
        fb.text(MENU_XOFFSET, 128 / 2 + 9, dateString);

        color("help");
        fb.font(10, false, FONT_DEFAULT);
        fb.text(0, 128 - 20, "press knob to advance");
        fb.text(0, 128 - 10, "cursor, press and");
        fb.text(0, 128 - 0, "hold to scroll cursor");


    } else if(oled.mode == 'imageMenu') { // menu image list mode
        //console.log("MENU-IMAGE mode");
        itemArray = oled.imageMenu;

        if (oled.selected >= itemArray.length) selected = itemArray.length - 1;
        if (itemArray.length <= 2) {
            list = itemArray;
            selected = oled.selected;
        } else if (oled.selected == itemArray.length - 1) {
            list = itemArray.slice(oled.selected - 1, oled.selected + 2);
            selected = 1;
        } else if (oled.selected == 0) {
            list = itemArray.slice(0, 4);
            selected = 0;
        } else {
            list = itemArray.slice(oled.selected - 1, oled.selected + 2);
            selected = 1;
        }
        if (!selected) selected = 0;
        if (selected >= list.length) selected = list.length - 1;

        // draw selection area
        var sX = 0;
        var sY = MENU_YOFFSET - (MENU_LINE_HEIGHT / 2 + 5) + selected * MENU_LINE_HEIGHT * 2;
        var sW = oled.width - 1;
        var sH = MENU_LINE_HEIGHT * 2 - 2;

        color("secondary");
        fb.rect(sX, sY, sW, sH, false);
        fb.rect(sX + 1, sY + 1, sW, sH, false);

        // draw menu text
        fb.font(MENU_FONT_SIZE, false, FONT_DEFAULT);

        for(var i = 0; i < list.length; i++) {
            color("primary");
            if(list[i].image) {
                fs.writeFileSync('/tmp/menuImage' + i.toString(), list[i].image);
                fb.jpeg(MENU_XOFFSET, MENU_YOFFSET + i * MENU_LINE_HEIGHT * 2 - 12, '/tmp/menuImage' + i.toString());
            } else {
                fb.rect(MENU_XOFFSET, MENU_YOFFSET + i * MENU_LINE_HEIGHT * 2 - 12, IMAGE_WIDTH, IMAGE_HEIGHT, false);
            }

            fb.text(MENU_XOFFSET + IMAGE_WIDTH + 3, MENU_YOFFSET + i * MENU_LINE_HEIGHT * 2 + 2, list[i].name);
            color("secondary");
            fb.text(MENU_XOFFSET + IMAGE_WIDTH + 3, MENU_YOFFSET + i * MENU_LINE_HEIGHT * 2 + MENU_LINE_HEIGHT - 3, list[i].line2);
        }

        drawStatusBar();

    } else { // menu mode
        //console.log("MENU mode");
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

        // draw selection area
        var sX = 0;
        var sY = MENU_YOFFSET - (MENU_LINE_HEIGHT / 2 + 5) + selected * MENU_LINE_HEIGHT;
        var sW = oled.width - 1;
        var sH = MENU_LINE_HEIGHT - 2;

        color("secondary");
        fb.rect(sX, sY, sW, sH, false);
        fb.rect(sX + 1, sY + 1, sW, sH, false);

        // draw menu text
        fb.font(MENU_FONT_SIZE, false, FONT_DEFAULT);
        color("primary");
        for(var i = 0; i < list.length; i++) {
            if(list[i] == null || typeof list[i] != "string") list[i] = "---";
            var parts = list[i].split('~');

            var textSize = fb.text(MENU_XOFFSET, MENU_YOFFSET + i * MENU_LINE_HEIGHT, parts[0]);
            
            if(parts[1]) { // menu item value
                color("secondary");
                fb.text(MENU_XOFFSET + textSize.width, MENU_YOFFSET + i * MENU_LINE_HEIGHT, ' ' + parts[1]);
                color("primary");
            }
        }

        drawStatusBar();
    }
}

oled.showBusy = function() {
    var s = "loading...";

    fb.font(MENU_FONT_SIZE, false, FONT_DEFAULT);
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
    oled.mode = 'menu';
    oled.items = itemArray;
    oled.selected = selected || 0;
    oled.writeMenu();
}

oled.createMenuImage = function(itemArray, selected) {
    oled.mode = 'imageMenu';
    oled.imageMenu = itemArray;
    oled.items = itemArray;
    oled.selected = selected || 0;
    oled.writeMenu();
}

oled.value = function(pairs, selected) {
    oled.mode = 'list';
    oled.setting = pairs;
    oled.selected = selected || 0;
    oled.writeMenu();
}

oled.text = function(name, value) {
    oled.mode = 'text';
    oled.name = name;
    oled.selected = 0;
    textValue = value || "";
    textMode = 'ucase';
    textInitPos(true);
    oled.writeMenu();
}

oled.number = function(name, value) {
    oled.mode = 'number';
    oled.name = name;
    oled.selected = 0;
    if(typeof value == "number") value = value.toString();
    textValue = value || "0";
    textMode = 'number';
    textInitPos(true);
    oled.writeMenu();
}

oled.time = function(name, value) {
    oled.mode = 'time';
    oled.name = name;
    oled.selected = 0;
    value = moment(value).utc();
    oled.timeObject = {
        hours: value.hours(),
        minutes: value.minutes(),
        seconds: value.seconds(),
        moment: value
    }
    oled.writeMenu();
}

oled.date = function(name, value) {
    oled.mode = 'date';
    oled.name = name;
    oled.selected = 0;
    value = moment(value).utc();
    oled.timeObject = {
        hours: value.hours(),
        minutes: value.minutes(),
        seconds: value.seconds(),
        moment: value
    }
    oled.writeMenu();
}

function parseTextIntoLines(text) {
    var lines = [];
    var maxWidth = 158;
    if(typeof text !== "string") {
        text = "an unknown error occurred";
    }
    var words = text.replace(/[\n\r]+/g, ' \n ').replace(/[\t]+/g, ' \t ').replace(/[ ]+/g, ' ').split(' ');
    fb.font(MENU_TEXT_FONT_SIZE, false, FONT_DEFAULT);
    var i = 0;
    var line = "";
    for(i = 0; i < words.length; i++) {
        if(words[i] == "\n") {
            if(line.length > 0) lines.push(line);
            line = "";
            lines.push(' ');
            continue;
        } else if(words[i] == "\t") {
            if(line.length > 0) lines.push(line);
            line = "";
            continue;
        }
        var newLine = (line + ' ' + words[i]).trim();
        var size = fb.textSize(newLine);
        if(size.width <= maxWidth) {
            line = newLine;
        } else {
            lines.push(line);
            line = (words[i]).trim();
        }
    }
    if(line.length > 0) lines.push(line);
    return lines;
}

oled.displayText = function(title, text) {
    oled.mode = 'read';
    oled.textTitle = title;
    oled.textLines = parseTextIntoLines(text);
    oled.selected = 0;
    oled.writeMenu();
}

oled.updateDisplayText = function(text) {
    oled.textLines = parseTextIntoLines(text);
    oled.writeMenu();
    oled.update();
}

oled.getTextValue = function() {
    return textValue.trim();
}

oled.getNumberValue = function() {
    return parseFloat(textValue.trim().replace(/ /g, '')) || 0;
}

oled.getTimeValue = function() {
    oled.timeObject.moment.hours(oled.timeObject.hours);
    oled.timeObject.moment.minutes(oled.timeObject.minutes);
    oled.timeObject.moment.seconds(oled.timeObject.seconds);
    return oled.timeObject.moment;
}

oled.getDateValue = function() {
    return oled.timeObject.moment;
}

oled.select = function(index) {
    oled.selected = index;
}

oled.activity = function() {
    if (screenTimeout) clearTimeout(screenTimeout);
    screenTimeout = setTimeout(oled.hide, 30000);
    if (!oled.visible) oled.show();
}

oled.update = function(override) {
    if(!oled.blocked || override) fb.blit();
}

oled.up = function() {
    if (oled.mode == 'text' || oled.mode == 'number') {
        textScrollDown();
    } else if (oled.mode == 'time') {
        if(oled.selected == 0) {
            if(oled.timeObject.hours > 0) oled.timeObject.hours--; else oled.timeObject.hours = 23;
        } else if(oled.selected == 1) {
            if(oled.timeObject.minutes > 0) oled.timeObject.minutes--; else oled.timeObject.minutes = 59;
        } else if(oled.selected == 2) {
            if(oled.timeObject.seconds > 0) oled.timeObject.seconds--; else oled.timeObject.seconds = 59;
        }
    } else if (oled.mode == 'date') {
        if(oled.selected == 0) {
            oled.timeObject.moment.subtract(1, 'days');
        } else if(oled.selected == 1) {
            oled.timeObject.moment.subtract(1, 'months');
        } else if(oled.selected == 2) {
            oled.timeObject.moment.subtract(1, 'years');
        }
    } else if (oled.selected > 0) {
        oled.selected--;
        oled.select(oled.selected);
    }
    oled.writeMenu();
    oled.update();
}

oled.down = function() {
    if (oled.mode == 'text' || oled.mode == 'number') {
        textScrollUp();
    } else if (oled.mode == 'read') {
        if(oled.selected < oled.textLines.length - 3) {
            oled.selected++;
            oled.writeMenu();
            oled.update();
        }
    } else if (oled.mode == 'time') {
        if(oled.selected == 0) {
            if(oled.timeObject.hours < 23) oled.timeObject.hours++; else oled.timeObject.hours = 0;
        } else if(oled.selected == 1) {
            if(oled.timeObject.minutes < 59) oled.timeObject.minutes++; else oled.timeObject.minutes = 0;
        } else if(oled.selected == 2) {
            if(oled.timeObject.seconds < 59) oled.timeObject.seconds++; else oled.timeObject.seconds = 0;
        }
    } else if (oled.mode == 'date') {
        if(oled.selected == 0) {
            oled.timeObject.moment.add(1, 'days');
        } else if(oled.selected == 1) {
            oled.timeObject.moment.add(1, 'months');
        } else if(oled.selected == 2) {
            oled.timeObject.moment.add(1, 'years');
        }
    } else if (oled.mode == 'list' || oled.selected < oled.items.length - 1) {
        oled.selected++;
        oled.select(oled.selected);
    }
    oled.writeMenu();
    oled.update();
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

oled.liveview = function(jpegFile, text) {
    oled.jpeg(jpegFile, 0, 14, true);
    fb.color(0, 0, 0);
    fb.rect(0, 119, 159, 127, true);
    fb.font(MENU_STATUS_FONT_SIZE, false, FONT_DEFAULT);
    color("primary");
    fb.text(3, 127, text);
    oled.update(true);
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

oled.writeStatus = function(status) {
    console.log("setting oled status:", status);
    currentStatus = status;
    oled.writeMenu();
    oled.update();
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
    console.log("playing video, mode=", typeof frames);
    if(oled.videoRunning) return callback && setTimeout(callback);
    var frameArray = null;
    if(!frames || (!videoPathFormat && typeof frames != 'object')) return callback && setTimeout(callback);
    if(typeof frames == 'object') {
        frameArray = frames;
        frames = frameArray.length;
        console.log("running video from array of frames with length", frames);
    }
    oled.block();
    videoCallback = callback;
    fb.clear();
    oled.videoRunning = true;
    var frameIndex = 0;
    skipFrames = 0;
    var indexString, paddingLength;
    var frameComplete = true;
    var frameLineFactor = (160 - 6) / frames;

    videoIntervalHandle = setInterval(function(){
        if(!frameComplete) {
            console.log("dropping frame #" + index);
            return; // drop frame
        }
        frameComplete = false;
        frameIndex += skipFrames;
        skipFrames = 0;
        if(frameIndex > frames) oled.stopVideo();

        if(frameArray) {
            fb.jpeg(0, 0, frameArray[frameIndex]);
            frameIndex++;
        } else {
            frameIndex++;
            indexString = frameIndex.toString();
            paddingLength = 5 - indexString.length;
            while(paddingLength > 0) {
                paddingLength--;
                indexString = '0' + indexString;
            }
            //fb.jpegUnbuffered(0, 0, videoPathFormat.replace('%05d', indexString));
            fb.jpeg(0, 0, videoPathFormat.replace('%05d', indexString));
        }
        color("background");
        fb.line(3, 127 - 3, 159 - 3, 127 - 3, 2);
        color("primary");
        fb.line(3, 127 - 3, frameIndex * frameLineFactor, 127 - 3, 2);
        fb.blit();
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