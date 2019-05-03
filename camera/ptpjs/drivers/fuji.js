
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
        setFunction: ptp.setPropU16,
        getFunction: ptp.getPropU16,
        listFunction: ptp.listPropU16,
        code: 0xD219,
        ev: true,
        values: [
            { name: "30s",     ev: -11,        code: -30 },
            { name: "25s",     ev: -10 - 2 / 3,code: -28 },
            { name: "20s",     ev: -10 - 1 / 3,code: -26 },
            { name: "15s",     ev: -10,        code: -24 },
            { name: "13s",     ev: -9 - 3 / 3, code: -22 },
            { name: "10s",     ev: -9 - 1 / 3, code: -20 },
            { name: "8s",      ev: -9,         code: -18 },
            { name: "6s",      ev: -8 - 2 / 3, code: -16 },
            { name: "5s",      ev: -8 - 1 / 3, code: -14 },
            { name: "4s",      ev: -8,         code: -12 },
            { name: "3s",      ev: -7 - 2 / 3, code: -10 },
            { name: "2.5s",    ev: -7 - 1 / 3, code:  -8 },
            { name: "2s",      ev: -7,         code:  -6 },
            { name: "1.6s",    ev: -6 - 2 / 3, code:  -4 },
            { name: "1.3s",    ev: -6 - 1 / 3, code:  -2 },
            { name: "1s",      ev: -6,         code:   0 },
            { name: "1/1.3s",  ev: -5 - 2 / 3, code:   2 },
            { name: "1/1.6s",  ev: -5 - 1 / 3, code:   4 },
            { name: "1/2s",    ev: -5,         code:   6 },
            { name: "1/2.5s",  ev: -4 - 2 / 3, code:   8 },
            { name: "1/3s",    ev: -4 - 1 / 3, code:  10 },
            { name: "1/4s",    ev: -4,         code:  12 },
            { name: "1/5s",    ev: -3 - 2 / 3, code:  14 },
            { name: "1/6s",    ev: -3 - 1 / 3, code:  16 },
            { name: "1/8s",    ev: -3,         code:  18 },
            { name: "1/10s",   ev: -2 - 2 / 3, code:  20 },
            { name: "1/13s",   ev: -2 - 1 / 3, code:  22 },
            { name: "1/15s",   ev: -2,         code:  24 },
            { name: "1/20s",   ev: -1 - 2 / 3, code:  26 },
            { name: "1/25s",   ev: -1 - 1 / 3, code:  28 },
            { name: "1/30s",   ev: -1,         code:  30 },
            { name: "1/40s",   ev: 0 - 2 / 3,  code:  32 },
            { name: "1/50s",   ev: 0 - 1 / 3,  code:  34 },
            { name: "1/60s",   ev: 0,          code:  36 },
            { name: "1/80s",   ev: 0 + 1 / 3,  code:  38 },
            { name: "1/100s",  ev: 0 + 2 / 3,  code:  40 },
            { name: "1/125s",  ev: 1,          code:  42 },
            { name: "1/160s",  ev: 1 + 1 / 3,  code:  44 },
            { name: "1/200s",  ev: 1 + 2 / 3,  code:  46 },
            { name: "1/250s",  ev: 2,          code:  48 },
            { name: "1/320s",  ev: 2 + 1 / 3,  code:  50 },
            { name: "1/400s",  ev: 2 + 2 / 3,  code:  52 },
            { name: "1/500s",  ev: 3,          code:  54 },
            { name: "1/640s",  ev: 3 + 1 / 3,  code:  56 },
            { name: "1/800s",  ev: 3 + 2 / 3,  code:  58 },
            { name: "1/1000s", ev: 4,          code:  60 },
            { name: "1/1250s", ev: 4 + 1 / 3,  code:  62 },
            { name: "1/1250s", ev: 4 + 2 / 3,  code:  62 },
            { name: "1/1600s", ev: 5,          code:  64 },
            { name: "1/2000s", ev: 5 + 1 / 3,  code:  66 },
            { name: "1/2500s", ev: 5 + 2 / 3,  code:  68 },
            { name: "1/3200s", ev: 6,          code:  70 },
            { name: "1/4000s", ev: 6 + 1 / 3,  code:  72 },
            { name: "1/5000s", ev: 6 + 2 / 3,  code:  74 },
            { name: "1/6400s", ev: 7,          code:  76 },
            { name: "1/8000s", ev: 7 + 1 / 3,  code:  78 }
        ]
    }
}






driver._error = function(camera, error) { // events received
    _logD("ERROR:", error);
};

driver._event = function(camera, data) { // events received
    _logD("EVENT:", data);
    ptp.parseEvent(data, function(type, event, param1, param2, param3) {
        if(event == ptp.PTP_EC_ObjectAdded) {
            _logD("object added:", param1);
        }
    });
};

driver.init = function(camera, callback) {
    ptp.init(camera._dev, function(err, di) {
        async.series([
            function(cb){ptp.setPropU16(camera._dev, 0xd38c, 1, cb);}, // PC mode
            function(cb){ptp.setPropU16(camera._dev, 0xd207, 2, cb);}  // USB control
        ], function(err) {
            var capture = function() {
                driver.capture(camera, "", {}, function(err, thumb, filename, rawImage){
                    if(err) {
                        if(err != 0x2019) _logD("capture err result:", ptp.hex(err));
                    } else {
                        _logD("captureed image:", filename);
                    }
                    var delay = 1000;
                    if(err == 0x2019) delay = 50; 
                    setTimeout(function() {
                        capture();
                    }, delay);
                });
            }
            //capture();
            ptp.listProp(camera._dev, 0x500D, function(err, current, list) {
                _logD("0x500D", current, list);
            });
            callback && callback(err);
        });
    });
}

driver.set = function(camera, param, value, callback) {

}

function getImage(camera, timeout, callback) {
    var results = {
        thumb: null,
        filename: null,
        indexNumber: null,
        rawImage: null
    }

    var startTime = Date.now();

    var check = function() {
        if(Date.now() - startTime > timeout) {
            return callback && callback("timeout", results);
        }
        ptp.getPropData(camera._dev, 0xd212, function(err, data) { // wait if busy
            //console.log("data:", data);
            if(data.length >= 4 && data.readUInt16LE(2) == 0xD20E) {
                var getHandles = function() {
                    ptp.getObjectHandles(camera._dev, function(err, handles) {
                        if(handles.length > 0) {
                            var objectId = handles[0];
                            var deleteRemaining = function() {
                                if(handles.length > 1) {
                                    var id = handles.pop();
                                    ptp.deleteObject(camera._dev, id, function(err) {
                                        deleteRemaining();
                                    });
                                }
                            }
                            ptp.getObjectInfo(camera._dev, objectId, function(err, oi) {
                                //console.log(oi);
                                var image = null;
                                results.filename = oi.filename;
                                results.indexNumber = objectId;
                                if(camera.thumbnail) {
                                    ptp.getThumb(camera._dev, objectId, function(err, jpeg) {
                                        ptp.deleteObject(camera._dev, objectId, function() {
                                            results.thumb = jpeg;
                                            callback && callback(err, results);
                                            deleteRemaining();
                                        });
                                    })
                                } else {
                                    ptp.getObject(camera._dev, objectId, function(err, image) {
                                        ptp.deleteObject(camera._dev, objectId, function() {
                                            results.thumb = ptp.extractJpeg(image);
                                            results.rawImage = image;
                                            callback && callback(err, results);
                                            deleteRemaining();
                                        });
                                    })
                                }
                            });
                        } else {
                            setTimeout(getHandles, 50);
                        }
                    });
                }
                getHandles();
            } else {
                setTimeout(check, 50);
            }
        });
    }
    check();
}

driver.capture = function(camera, target, options, callback, tries) {
    var targetValue = (!target || target == "camera") ? 2 : 4;
    camera.thumbnail = true;
    var results = {};
    async.series([
        function(cb){ptp.setPropU16(camera._dev, 0xd20c, targetValue, cb);}, // set target
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
        function(cb){
            getImage(camera, 60000, function(err, imageResults) {
                results = imageResults;
                cb(err);
            });
        },
    ], function(err) {
        callback && callback(err, results.thumb, results.filename, results.rawImage);
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
