var util = require('util');
var EventEmitter = require('events').EventEmitter;
var ptpFunctions = require('../common/ptp-functions.js');

var driver = new EventEmitter();

function _log(message) {
    console.log("FUJI:", message);
}

driver.supportedCameras = {
    '04cb:02cd': {
            name: "Fuji X-T2",
            supports: {
                shutter: true,
                aperture: true,
                iso: true,
                liveview: true,
                target: true,
                focus: true,
            }
        },
    '04cb:02d7': {
            name: "Fuji X-H1"
            supports: {
                shutter: true,
                aperture: true,
                iso: true,
                liveview: true,
                target: true,
                focus: true,
            }
        },
    '04cb:02dd': {
            name: "Fuji X-T3"
            supports: {
                shutter: true,
                aperture: true,
                iso: true,
                liveview: true,
                target: true,
                focus: true,
            }
        },
}

driver._event = function(dev, data) { // events received
    _log("data received:", data);
};

module.exports = driver;
