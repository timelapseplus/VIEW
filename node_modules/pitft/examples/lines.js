var pitft = require("../pitft");

var fb = pitft("/dev/fb1"); // Returns a framebuffer in direct mode.  See the clock.js example for double buffering mode

// Clear the screen buffer
fb.clear();

var xMax = fb.size().width;
var yMax = fb.size().height;

for (var n=0; n<500; n++) {
    var x0, y0, x1, y1, r, g, b;

    x0 = parseInt(Math.random() * xMax, 10);
    y0 = parseInt(Math.random() * yMax, 10);

    x1 = parseInt(Math.random() * xMax, 10);
    y1 = parseInt(Math.random() * yMax, 10);

    r = Math.random();
    g = Math.random();
    b = Math.random();

    fb.color(r, g, b);
    fb.line(x0, y0, x1, y1, 1, r, g, b); // Draw a line from (x0, y0) to (x1, y1) with a width of one pixel, and the color (r, g, b)
}
