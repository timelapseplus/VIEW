
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
var fs = require('fs');

var driver = new EventEmitter();

driver.name = "Fujifilm";

function _logD() {
    if(arguments.length > 0) {
        arguments[0] = "PTP-FUJI: " + arguments[0];
    }
    console.log.apply(console, arguments);
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
    _logD("EVENT:", data);
    ptp.parseEvent(data, function(type, event, param1, param2, param3) {
        if(event == ptp.PTP_EC_ObjectAdded) {
            _logD("object added:", param1);
            var objectId = param1;
            ptp.getObjectInfo(camera, objectId, function(err, oi) {
                console.log(oi);
                var image = null;
                //if(camera.thumbnail) {
                    ptp.getThumb(camera, objectId, function(err, jpeg) {
                        fs.writeFileSync("thumb.jpg", jpeg);
                        ptp.deleteObject(camera, objectId);
                    })
                //} else {
                //    ptp.getObject(camera, objectId, function(err, image) {
                //        fs.writeFileSync("image.raf", jpeg);
                //        ptp.deleteObject(camera, objectId);
                //    })
                //}
            });
        }
    });
};

driver.init = function(camera, callback) {
    ptp.init(camera._dev, function(err, di) {
        async.series([
            function(cb){ptp.setPropU16(camera._dev, 0xd38c, 1, cb);},
            function(cb){ptp.setPropU16(camera._dev, 0xd207, 2, cb);}
        ], function(err) {
            driver.capture(camera, "", {}, function(err){
                _logD("capture err result:", err);
            });
            callback && callback(err);
        });
    });
}

driver.set = function(camera, param, value, callback) {

}

driver.capture = function(camera, target, options, callback) {
    var targetValue = (!target || target == "camera") ? 2 : 4;
    camera.thumbnail = true;
    async.series([
        function(cb){ptp.setPropU8(camera._dev, 0xd20c, targetValue, cb);}, // set target
        function(cb){ptp.setPropU16(camera._dev, 0xd208, 0x0200, cb);},
        function(cb){ptp.ptpCapture(camera._dev, [0x0, 0x0], cb);},
        function(cb){
            var check = function() {
                ptp.getPropU16(camera._dev, 0xd209, function(err, data) { // wait if busy
                    if(data == 0x0001) {
                        check();
                    } else {
                        cb(err);
                    }
                });
            }
            check();
        },
        function(cb){ptp.setPropU16(camera._dev, 0xd208, 0x0304, cb);},
        function(cb){ptp.ptpCapture(camera._dev, [0x0, 0x0], cb);},
    ], function(err) {
        callback && callback(err);
    });
}

driver.captureHDR = function(camera, target, options, frames, stops, darkerOnly, callback) {

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
