var oled = require("./oled.js");
var Canvas = require('canvas');
var canvas = new Canvas(160, 128);

var screen = {};
screen.oled = oled;
screen.ctx = canvas.getContext('2d');

screen.init = function() {
    oled.init();
}

screen.newContext = function() {
    screen.ctx = canvas.getContext('2d');
}

screen.pngFile = function(pngPath) {
    oled.pngFile(pngPath);
}

screen.off = function() {
    oled.power(false);
}

screen.on = function() {
    oled.power(true);
}

screen.update = function() {
    oled.pngBuffer(canvas.toBuffer());
}

module.exports = screen;