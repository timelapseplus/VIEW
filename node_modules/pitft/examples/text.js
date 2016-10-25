var pitft = require("../pitft");

var fb = pitft("/dev/fb1"); // Returns a framebuffer in direct mode.  See the clock.js example for double buffering mode

// Clear the screen buffer
fb.clear();

var xMax = fb.size().width;
var yMax = fb.size().height;

fb.color(1, 1, 1); // Set the color to white

for (var a=0; a<=90; a+=15) {
    fb.font("fantasy", 12); // Use the "fantasy" font with size 12
    fb.text(20, 20, "Rotated text", false, a); // Draw the text non-centered, rotated _a_ degrees
}

for (var a=0; a<=180; a+=15) {
    fb.font("fantasy", 24, true); // Use the "fantasy" font with size 24, and font weight bold
    fb.text(xMax/2, yMax/2, "Rotated text", true, a); // Draw the text centered, rotated _a_ degrees
}

for (var a=180; a<=270; a+=15) {
    fb.font("fantasy", 12); // Use the "fantasy" font with size 12
    fb.text(xMax-20, yMax-20, "Rotated text", false, a); // Draw the text non-centered, rotated _a_ degrees
}
