var pitft = require("../pitft");

var fb = pitft("/dev/fb1", true); // Returns a framebuffer in double buffering mode

// Clear the back buffer
fb.clear();

var xMax = fb.size().width;
var yMax = fb.size().height;

var radius = yMax/2 - 10;

var RA = 180/Math.PI;

var drawDial = function() {
    fb.color(1, 1, 1);
    fb.circle(xMax/2, yMax/2, radius);

    fb.color(0, 0, 0);
    for (var a = 0; a < 360; a += 6) {
        var x0, y0;

        var x0 = xMax/2 + Math.sin(a/RA) * (radius * 0.95);
        var y0 = yMax/2 + Math.cos(a/RA) * (radius * 0.95);

        if (a % 30 == 0) {
            x1 = xMax/2 + Math.sin(a/RA) * (radius * 0.85);
            y1 = yMax/2 + Math.cos(a/RA) * (radius * 0.85);
            fb.line(x0, y0, x1, y1, radius * 0.05);
        } else {
            x1 = xMax/2 + Math.sin(a/RA) * (radius * 0.90);
            y1 = yMax/2 + Math.cos(a/RA) * (radius * 0.90);
            fb.line(x0, y0, x1, y1, radius * 0.01);
        }
    }
}

var hand = function(_fb, x, y, angle, length, width) {
    var x0 = xMax/2 + Math.sin(angle/RA);
    var y0 = yMax/2 - Math.cos(angle/RA);

    var x1 = xMax/2 + Math.sin(angle/RA) * length;
    var y1 = yMax/2 - Math.cos(angle/RA) * length;

    fb.line(x0, y0, x1, y1, width);
}

var update = function() {
    var now = new Date(),
        midnight = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
            0,0,0),
        hours = (now.getTime() - midnight.getTime())/1000/60/60,
        minutes = (hours * 60) % 60;
    seconds = parseInt((minutes * 60) % 60);

    fb.color(1, 1, 1);
    fb.circle(xMax/2, yMax/2, radius * 0.85);
    fb.image(xMax/2 - 16, yMax/2 + radius * 0.50 - 16, "raspberry-pi-icon.png");
    fb.color(1, 0, 0);
    hand(fb, 0, 0, hours/12 * 360, radius * 0.6, radius * 0.05);
    hand(fb, 0, 0, minutes/60 * 360, radius * 0.8, radius * 0.05);
    fb.color(0, 0, 0);
    hand(fb, 0, 0, seconds/60 * 360, radius * 0.8, radius * 0.015);
    fb.color(1, 0, 0);
    fb.circle(xMax/2, yMax/2, radius * 0.075);
    fb.blit(); // Transfer the back buffer to the screen buffer
};

drawDial();
setInterval(function() {
    update();
}, 100);