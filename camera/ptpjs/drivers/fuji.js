
/****************************************************************************
 LICENSE: CC BY-NC-SA 4.0 https://creativecommons.org/licenses/by-nc-sa/4.0/
 This is an original driver by Elijah Parker <mail@timelapseplus.com>
 It is free to use in other projects for non-commercial purposes.  For a
 commercial license and consulting, please contact mail@timelapseplus.com
*****************************************************************************/

var util = require('util');
var async = require('async');
var EventEmitter = require('events').EventEmitter;
var ptp = require('../common/ptp-functions.js');

var driver = new EventEmitter();

driver.name = "Fujifilm";

function _log(message) {
    console.log("FUJI:", message);
}
driver.supportedCameras = {
    '04cb:02cb': {
            name: "Fuji X-Pro2",
            supports: {
                shutter: true,
                aperture: true,
                iso: true,
                liveview: true,
                target: true,
                focus: true,
            }
        },
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
            name: "Fuji X-H1",
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
            name: "Fuji X-T3",
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

var properties = {
    'capture': {
        name: 'capture',
        function: ptp.setPropU16,
        code: 0xd208,
        values: [
            {name: 'focus', code: 0x0200},
            {name: 'capture', code: 0x0304},
        ]
    },
    'shutter': {
        name: 'shutter',
        function: ptp.setPropU16,
        code: 0xD219,
        ev: true,
        values: [
            {name: '1s', ev: -6, code: 0},
        ]
    }
}

driver._event = function(camera, data) { // events received
    _log("data received:", data);
};

driver.init = function(camera, callback) {
    ptp.init(camera._dev, function(err, di) {
        async.series([
            function(cb){ptp.setPropU16(camera._dev, 0xd38c, 1, cb);},
            function(cb){ptp.setPropU16(camera._dev, 0xd207, 2, cb);}
        ], function(err) {
            callback && callback(err);
        });
    });
}

driver.set = function(camera, param, value, callback) {

}

driver.capture = function(camera, target, options, callback) {

}

driver.liveviewMode = function(camera, enable, callback) {

}

driver.liveviewImage = function(camera, nable, callback) {

}

driver.moveFocus = function(camera, steps, resolution, callback) {

}

driver.get = function(camera, param, value, callback) {

}

module.exports = driver;
