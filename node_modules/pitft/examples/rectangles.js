var pitft = require("../pitft");

var fb = pitft("/dev/fb1"); // Returns a framebuffer in direct mode.  See the clock.js example for double buffering mode

// Clear the screen buffer
fb.clear();

var xMax = fb.size().width;
var yMax = fb.size().height;

for (var n=0; n<500; n++) {
    var x, y, w, h, r, g, b;

    do {
        x = parseInt(Math.random() * xMax, 10);
        w = parseInt(Math.random() * xMax, 10);
    } while ((x + w) >= xMax)

    do {
        y = parseInt(Math.random() * yMax, 10);
        h = parseInt(Math.random() * yMax, 10);
    } while ((y + h) >= yMax)

    r = Math.random();
    g = Math.random();
    b = Math.random();

    fb.color(r, g, b);
    fb.rect(x, y, w, h, false, 1); // Draw an outlined rectangle with a 1 pixel wide border
}

fb.clear();

for (var n=0; n<500; n++) {
    var x, y, w, h, r, g, b;

    do {
        x = parseInt(Math.random() * xMax, 10);
        w = parseInt(Math.random() * xMax, 10);
    } while ((x + w) >= xMax)

    do {
        y = parseInt(Math.random() * yMax, 10);
        h = parseInt(Math.random() * yMax, 10);
    } while ((y + h) >= yMax)

    r = Math.random();
    g = Math.random();
    b = Math.random();

    fb.color(r, g, b);
    fb.rect(x, y, w, h, true); // Draw a filled rectangle
}