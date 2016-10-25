var OLED_BIN_PATH = "/home/view/current/bin/oled";
var spawnSync = require('spawn-sync');

var oled = {};

function oledDriver(args, stdin, timeout) {
    if (!timeout) timeout = 100;
    spawnSync(OLED_BIN_PATH, args, {
        input: stdin,
        timeout: timeout
    });
}

oled.init = function() {
    oledDriver(['-s'], null, 3000);
}

oled.power = function(enable) {
    if (enable)
        oledDriver(['-o']);
    else
        oledDriver(['-x']);
}

oled.pngFile = function(pngPath) {
    oledDriver(['-p', pngPath]);
}

oled.pngBuffer = function(pngBuffer) {
    oledDriver(['-i'], pngBuffer);
}


module.exports = oled;