var pitft = require("../pitft");

var fb = pitft("/dev/fb1"); // Returns a framebuffer in direct mode.  See the clock.js example for double buffering mode

// Clear the screen buffer
fb.clear();

var xMax = fb.size().width;
var yMax = fb.size().height;

fb.image(x, y, "raspberry-pi.png"); // Draw the image from the file "raspberry-pi.png" at position x, y

for (var n=0; n<1000; n++) {
    var x = Math.random() * (xMax + 32) - 16;
    var y = Math.random() * (yMax + 32) - 16;

    fb.image(x, y, "raspberry-pi-icon.png");
}
