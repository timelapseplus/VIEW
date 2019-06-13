
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

driver.name = "Nikon";

function _logD() {
    if(arguments.length > 0) {
        arguments[0] = "PTP-NIKON: " + arguments[0];
    }
    console.log.apply(console, arguments);
}

function _logE() {
    if(arguments.length > 0) {
        arguments[0] = "PTP-NIKON: " + arguments[0];
    }
    console.log.apply(console, arguments);
}

function exposureEvent(camera) {
    if(!camera._expCache) camera._expCache = {};
    var update = false;
    for(var k in camera.exposure) {
        if(camera.exposure[k].ev != camera._expCache[k]) {
           camera._expCache[k] = camera.exposure[k].ev;
           update = true; 
        }
    }
    if(update) {
        driver.emit('settings', camera);
    }
}

driver.supportedCameras = {
    '04b0:042c': {
            name: "Nikon D3200",
            supports: {
                shutter: true,
                aperture: true,
                iso: true,
                liveview: true,
                destination: true,
                focus: true,
            }
        },
}

var properties = {
    'shutter': {
        name: 'shutter',
        category: 'exposure',
        setFunction: ptp.setPropU32,
        getFunction: ptp.getPropU32,
        listFunction: ptp.listProp,
        code: 0x500D,
        ev: true,
        values: [
            { name: "bulb",    ev: null,        code:  4294967295 },
            { name: "30s",     ev: -11,         code:  300000 },
            { name: "25s",     ev: -10 - 2 / 3, code:  250000 },
            { name: "20s",     ev: -10 - 1 / 3, code:  200000 },
            { name: "15s",     ev: -10,         code:  150000 },
            { name: "13s",     ev: -9 - 3 / 3,  code:  130000 },
            { name: "10s",     ev: -9 - 1 / 3,  code:  100000 },
            { name: "8s",      ev: -9,          code:  80000 },
            { name: "6s",      ev: -8 - 2 / 3,  code:  60000 },
            { name: "5s",      ev: -8 - 1 / 3,  code:  50000 },
            { name: "4s",      ev: -8,          code:  40000 },
            { name: "3s",      ev: -7 - 2 / 3,  code:  30000 },
            { name: "2.5s",    ev: -7 - 1 / 3,  code:  25000 },
            { name: "2s",      ev: -7,          code:  20000 },
            { name: "1.6s",    ev: -6 - 2 / 3,  code:  16000 },
            { name: "1.3s",    ev: -6 - 1 / 3,  code:  13000 },
            { name: "1s",      ev: -6,          code:  10000 },
            { name: "0.8s",    ev: -5 - 2 / 3,  code:  7692 },
            { name: "0.6s",    ev: -5 - 1 / 3,  code:  6250 },
            { name: "1/2",     ev: -5,          code:  5000 },
            { name: "0.4s",    ev: -4 - 2 / 3,  code:  4000 },
            { name: "1/3",     ev: -4 - 1 / 3,  code:  3333 },
            { name: "1/4",     ev: -4,          code:  2500 },
            { name: "1/5",     ev: -3 - 2 / 3,  code:  2000 },
            { name: "1/6",     ev: -3 - 1 / 3,  code:  1666 },
            { name: "1/8",     ev: -3,          code:  1250 },
            { name: "1/10",    ev: -2 - 2 / 3,  code:  1000 },
            { name: "1/13",    ev: -2 - 1 / 3,  code:  769 },
            { name: "1/15",    ev: -2,          code:  666 },
            { name: "1/20",    ev: -1 - 2 / 3,  code:  500 },
            { name: "1/25",    ev: -1 - 1 / 3,  code:  400 },
            { name: "1/30",    ev: -1,          code:  333 },
            { name: "1/40",    ev: 0 - 2 / 3,   code:  250 },
            { name: "1/50",    ev: 0 - 1 / 3,   code:  200 },
            { name: "1/60",    ev: 0,           code:  166 },
            { name: "1/80",    ev: 0 + 1 / 3,   code:  125 },
            { name: "1/100",   ev: 0 + 2 / 3,   code:  100 },
            { name: "1/125",   ev: 1,           code:  80 },
            { name: "1/160",   ev: 1 + 1 / 3,   code:  62 },
            { name: "1/200",   ev: 1 + 2 / 3,   code:  50 },
            { name: "1/250",   ev: 2,           code:  40 },
            { name: "1/320",   ev: 2 + 1 / 3,   code:  31 },
            { name: "1/400",   ev: 2 + 2 / 3,   code:  25 },
            { name: "1/500",   ev: 3,           code:  20 },
            { name: "1/640",   ev: 3 + 1 / 3,   code:  15 },
            { name: "1/800",   ev: 3 + 2 / 3,   code:  12 },
            { name: "1/1000",  ev: 4,           code:  10 },
            { name: "1/1250",  ev: 4 + 1 / 3,   code:  8 },
            { name: "1/1600",  ev: 4 + 2 / 3,   code:  6 },
            { name: "1/2000",  ev: 5,           code:  5 },
            { name: "1/2500",  ev: 5 + 1 / 3,   code:  4 },
            { name: "1/3200",  ev: 5 + 2 / 3,   code:  3 },
            { name: "1/4000",  ev: 6,           code:  2 },
        ]
    },
    'aperture': {
        name: 'aperture',
        category: 'exposure',
        setFunction: ptp.setPropU16,
        getFunction: ptp.getPropU16,
        listFunction: ptp.listProp,
        code: 0x5007,
        ev: true,
        values: [
            { name: "1.0",      ev: -8,          code: 100  },
            { name: "1.1",      ev: -7 - 2 / 3,  code: 110  },
            { name: "1.2",      ev: -7 - 1 / 3,  code: 120  },
            { name: "1.4",      ev: -7,          code: 140  },
            { name: "1.6",      ev: -6 - 2 / 3,  code: 160  },
            { name: "1.8",      ev: -6 - 1 / 3,  code: 180  },
            { name: "2.0",      ev: -6,          code: 200  },
            { name: "2.2",      ev: -5 - 2 / 3,  code: 220  },
            { name: "2.5",      ev: -5 - 1 / 3,  code: 250  },
            { name: "2.8",      ev: -5,          code: 280  },
            { name: "3.2",      ev: -4 - 2 / 3,  code: 320  },
            { name: "3.6",      ev: -4 - 1 / 3,  code: 360  },
            { name: "4.0",      ev: -4,          code: 400  },
            { name: "4.5",      ev: -3 - 2 / 3,  code: 450  },
            { name: "5.0",      ev: -3 - 1 / 3,  code: 500  },
            { name: "5.6",      ev: -3,          code: 560  },
            { name: "6.3",      ev: -2 - 2 / 3,  code: 640  },
            { name: "7.1",      ev: -2 - 1 / 3,  code: 710  },
            { name: "8",        ev: -2,          code: 800  },
            { name: "9",        ev: -1 - 2 / 3,  code: 900  },
            { name: "10",       ev: -1 - 1 / 3,  code: 1000  },
            { name: "11",       ev: -1,          code: 1100  },
            { name: "13",       ev: -0 - 2 / 3,  code: 1300  },
            { name: "14",       ev: -0 - 1 / 3,  code: 1400  },
            { name: "16",       ev:  0,          code: 1600  },
            { name: "18",       ev:  0 + 1 / 3,  code: 1800  },
            { name: "20",       ev:  0 + 2 / 3,  code: 2000  },
            { name: "22",       ev:  1,          code: 2200  },
            { name: "25",       ev:  2 + 1 / 3,  code: 2500  },
            { name: "29",       ev:  2 + 2 / 3,  code: 2900  },
            { name: "32",       ev:  3,          code: 3200  },
            { name: "36",       ev:  3 + 1 / 3,  code: 3600  },
            { name: "42",       ev:  3 + 2 / 3,  code: 4200  },
            { name: "45",       ev:  4,          code: 4500  },
            { name: "50",       ev:  4 + 1 / 3,  code: 5000  },
            { name: "57",       ev:  4 + 2 / 3,  code: 5700  },
            { name: "64",       ev:  5,          code: 6400  }
        ]
    },
    'iso': {
        name: 'iso',
        category: 'exposure',
        setFunction: ptp.setProp32,
        getFunction: ptp.getProp32,
        listFunction: ptp.listProp,
        code: 0x500F,
        ev: true,
        values: [
            { name: "50",       ev:  1,          code: 50 },
            { name: "64",       ev:  0 + 2 / 3,  code: 64 },
            { name: "80",       ev:  0 + 1 / 3,  code: 80 },
            { name: "100",      ev:  0,          code: 100 },
            { name: "125",      ev: -0 - 1 / 3,  code: 125 },
            { name: "160",      ev: -0 - 2 / 3,  code: 160 },
            { name: "200",      ev: -1,          code: 200 },
            { name: "250",      ev: -1 - 1 / 3,  code: 250 },
            { name: "320",      ev: -1 - 2 / 3,  code: 320 },
            { name: "400",      ev: -2,          code: 400 },
            { name: "500",      ev: -2 - 1 / 3,  code: 500 },
            { name: "640",      ev: -2 - 2 / 3,  code: 640 },
            { name: "800",      ev: -3,          code: 800 },
            { name: "1000",     ev: -3 - 1 / 3,  code: 1000 },
            { name: "1250",     ev: -3 - 2 / 3,  code: 1250 },
            { name: "1600",     ev: -4,          code: 1600 },
            { name: "2000",     ev: -4 - 1 / 3,  code: 2000 },
            { name: "2500",     ev: -4 - 2 / 3,  code: 2500 },
            { name: "3200",     ev: -5,          code: 3200 },
            { name: "4000",     ev: -5 - 1 / 3,  code: 4000 },
            { name: "5000",     ev: -5 - 2 / 3,  code: 5000 },
            { name: "6400",     ev: -6,          code: 6400 },
            { name: "8000",     ev: -6 - 1 / 3,  code: 8000 },
            { name: "10000",    ev: -6 - 2 / 3,  code: 10000 },
            { name: "12800",    ev: -7,          code: 12800 },
            { name: "16000",    ev: -7 - 1 / 3,  code: 16000 },
            { name: "20000",    ev: -7 - 2 / 3,  code: 20000 },
            { name: "25600",    ev: -8,          code: 25600 },
            { name: "32000",    ev: -8 - 1 / 3,  code: 32000 },
            { name: "40000",    ev: -8 - 2 / 3,  code: 40000 },
            { name: "51200",    ev: -9,          code: 51200 },
            { name: "64000",    ev: -9 - 1 / 3,  code: 64000 },
            { name: "80000",    ev: -9 - 2 / 3,  code: 80000 },
            { name: "102400",   ev: -10,         code: 102400 },
            { name: "128000",   ev: -10 - 1 / 3, code: 128000 },
            { name: "160000",   ev: -10 - 2 / 3, code: 160000 },
            { name: "204800",   ev: -11,         code: 204800 },
        ]
    },
    'format': {
        name: 'format',
        category: 'config',
        setFunction: ptp.setPropU16,
        getFunction: ptp.getPropU16,
        listFunction: ptp.listProp,
        code: 0x5004,
        ev: false,
        values: [
            { name: "RAW",               value: 'raw',      code: 4  },
            { name: "JPEG Normal",       value: null,       code: 1  },
            { name: "JPEG Fine",         value: null,       code: 2  },
            { name: "JPEG Basic",         value: null,      code: 0  },
            { name: "RAW + JPEG Fine",   value: 'raw+jpeg', code: 7  },
        ]
    },
    'destination': {
        name: 'destination',
        category: 'config',
        setFunction: null,
        getFunction: null,
        listFunction: null,
        code: null,
        ev: false,
        default: 0,
        values: [
            { name: "camera",            code: 0  },
            { name: "VIEW",              code: 1  },
        ]
    }
}

driver._error = function(camera, error) { // events received
    _logE(error);
};

driver._event = function(camera, data) { // events received
    ptp.parseEvent(data, function(type, event, param1, param2, param3) {
        if(event == ptp.PTP_EC_ObjectAdded) {
            _logD("object added:", ptp.hex(param1));
            camera._objectsAdded.push(param1);
        } else if(event == ptp.PTP_EC_DevicePropChanged) {
            var check = function() {
                if(camera._eventTimer) clearTimeout(camera._eventTimer);            
                camera._eventTimer = setTimeout(function() {
                    camera._eventTimer = null;
                    if(!camera._blockEvents) {
                        driver.refresh(camera);
                    } else {
                        camera._eventTimer = setTimeout(check, 500);
                    }
                }, 500);
            }
            check();
        } else {
            _logD("EVENT:", data);
        }
    });
};

driver.refresh = function(camera, callback) {
    var keys = [];
    for(var key in properties) {
        keys.push(key);
    }
    async.series([
        function(cb){
            var fetchNextProperty = function() {
                var key = keys.pop();
                if(key) {
                    if(!camera[properties[key].category]) camera[properties[key].category] = {};
                    if(!camera[properties[key].category][key]) camera[properties[key].category][key] = {};
                    if(properties[key].listFunction) {
                        properties[key].listFunction(camera._dev, properties[key].code, function(err, current, list, type) {
                            if(err) {
                                _logE("failed to list", key, ", err:", err);
                            } else {
                                _logD(key, "type is", type);
                                var currentMapped = mapPropertyItem(current, properties[key].values);
                                if(!currentMapped) {
                                    _logE(key, "item not found:", current);
                                    currentMapped = {
                                        name: "UNKNOWN",
                                        ev: null,
                                        value: null,
                                        code: current
                                    }
                                }
                                _logD(key, "=", currentMapped.name);
                                camera[properties[key].category][key] = ptp.objCopy(currentMapped, {});
                                var mappedList = [];
                                for(var i = 0; i < list.length; i++) {
                                    var mappedItem = mapPropertyItem(list[i], properties[key].values);
                                    if(!mappedItem) {
                                        _logE(key, "list item not found:", list[i]);
                                    } else {
                                        mappedList.push(mappedItem);
                                    }
                                }
                                camera[properties[key].category][key].list = mappedList;
                            }
                        });
                    } else {
                        if(properties[key].default != null) {
                            if(!camera[properties[key].category][key])
                            var currentMapped = mapPropertyItem(properties[key].default, properties[key].values);
                            camera[properties[key].category][key] = ptp.objCopy(currentMapped, {});
                            var mappedList = [];
                            for(var i = 0; i < properties[key].values.length; i++) {
                                mappedList.push(properties[key].values[i]);
                            }
                            camera[properties[key].category][key].list = mappedList;
                        }
                    }
                    fetchNextProperty();
                } else {
                    //console.log(camera.exposure);
                    cb();
                    exposureEvent(camera);
                }
            }
            fetchNextProperty();
        }
    ], function(err) {
        return callback && callback(err);
    });
}

driver.init = function(camera, callback) {
    camera._objectsAdded = [];
    ptp.init(camera._dev, function(err, di) {
        async.series([
            //function(cb){ptp.setPropU16(camera._dev, 0xd38c, 1, cb);}, // PC mode
            //function(cb){ptp.setPropU16(camera._dev, 0xd207, 2, cb);},  // USB control
            function(cb){driver.refresh(camera, cb);}  // get settings
        ], function(err) {
            
            var shutterEv = camera.exposure.shutter.ev; 
            var capture = function() {

                driver.capture(camera, "", {}, function(err, thumb, filename, rawImage){
                    if(err) {
                        if(err != 0x2019) _logD("capture err result:", ptp.hex(err));
                    } else {
                        _logD("captured image:", filename);
                    }
                    var delay = 1000;
                    if(err == 0x2019) delay = 50; 
                    setTimeout(function() {
                        shutterEv++;
                        var set = function() {
                            driver.set(camera, 'shutter', shutterEv, function(err) {
                                if(err == 0x2019) return setTimeout(set, 100);
                                if(err) _logD("set error:", err);
                                capture();
                            });
                        }
                        set();
                    }, delay);
                });
            }
            //capture();
            //driver.refresh(camera);

            //ptp.listProp(camera._dev, 0x500D, function(err, current, list) {
            //    _logD("0x500D", current, list);
            //});

            callback && callback(err);
        });
    });
}

function mapPropertyItem(cameraValue, list) {
    for(var i = 0; i < list.length; i++) {
        if(cameraValue == list[i].code) return list[i];
    }
    return null;
}

driver.set = function(camera, param, value, callback) {
    async.series([
        function(cb){
            if(properties[param] && properties[param].setFunction) {
                var cameraValue = null;
                if(properties[param].ev && typeof value == "number") {
                    for(var i = 0; i < properties[param].values.length; i++) {
                        if(properties[param].values[i].ev == value) {
                            cameraValue = properties[param].values[i].code;
                            break;
                        }
                    }
                } else {
                    for(var i = 0; i < properties[param].values.length; i++) {
                        if(properties[param].values[i].name == value) {
                            cameraValue = properties[param].values[i].code;
                            break;
                        }
                    }
                }
                if(cameraValue !== null) {
                    _logD("setting", ptp.hex(properties[param].code), "to", cameraValue);
                    properties[param].setFunction(camera._dev, properties[param].code, cameraValue, function(err) {
                        if(!err) {
                            var newItem =  mapPropertyItem(cameraValue, properties[param].values);
                            for(var k in newItem) {
                                if(newItem.hasOwnProperty(k)) camera[properties[param].category][param][k] = newItem[k];
                            }
                            cb(err);
                            exposureEvent(camera);
                        } else {
                            return cb(err);
                        }
                    });
                } else {
                    _logE("set: unknown value", value, "for", param);
                    return cb("unknown value");
                }
            } else if(properties[param] && properties[param].default != null) {
                var newItem =  mapPropertyItem(cameraValue, properties[param].values);
                for(var k in newItem) {
                    if(newItem.hasOwnProperty(k)) camera[properties[param].category][param][k] = newItem[k];
                }
                cb();
                exposureEvent(camera);
            } else {
                _logE("set: unknown param", param);
                return cb("unknown param");
            }
        },
    ], function(err) {
        return callback && callback(err);
    });
}

driver.get = function(camera, param, callback) {
    async.series([
        function(cb){
            if(properties[param] && properties[param].getFunction) {
                properties[param].getFunction(camera._dev, properties[param].code, function(err, data) {
                    if(!err) {
                        var newItem =  mapPropertyItem(data, properties[param].values);
                        if(newItem) {
                            for(var k in newItem) {
                                if(newItem.hasOwnProperty(k)) camera[properties[param].category][param][k] = newItem[k];
                            }
                        } else {
                            var list = camera[properties[param].category][param].list;
                            camera[properties[param].category][param] = {
                                list: list
                            }
                        }
                        return cb(err);
                    } else {
                        return cb(err);
                    }
                });
            } else {
                return cb("unknown param");
            }
        },
    ], function(err) {
        return callback && callback(err, camera[properties[key].category][key]);
    });
}

function getImage(camera, timeout, callback) {
    var results = {
        thumb: null,
        filename: null,
        indexNumber: null,
        rawImage: null
    }

    var startTime = Date.now();

    camera._objectsAdded = []; // clear queue

    var check = function() {
        if(Date.now() - startTime > timeout) {
            return callback && callback("timeout", results);
        }
        if(camera._objectsAdded.length == 0) {
            return setTimeout(check, 50);
        }
        checkReady(camera, function(err, ready) { // wait if busy
            //console.log("data:", data);
            if(!err && ready) {
                var objectId = camera._objectsAdded.shift();
                ptp.getObjectInfo(camera._dev, objectId, function(err, oi) {
                    //console.log(oi);
                    if(oi.objectFormat == ptp.PTP_OFC_Association) return setTimeout(check, 50); // folder added, keep waiting for image
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
                        });
                    } else {
                        ptp.getObject(camera._dev, objectId, function(err, image) {
                            ptp.deleteObject(camera._dev, objectId, function() {
                                results.thumb = ptp.extractJpeg(image);
                                results.rawImage = image;
                                callback && callback(err, results);
                                deleteRemaining();
                            });
                        });
                    }
                });
            } else {
                setTimeout(check, 50);
            }
        });
    }
    check();
}

function checkReady(camera, callback) {
    ptp.transaction(camera._dev, 0x90C8, [], null, function(err, responseCode) {
        if(err || (responseCode != 0x2001 || responseCode != 0x2019)) return callback && callback(err || responseCode);
        return callback && callback(null, responseCode == 0x2001);
    });
}

driver.capture = function(camera, target, options, callback, tries) {
    var targetValue = (!target || target == "camera") ? "camera" : "VIEW";
    camera.thumbnail = targetValue == 'camera';
    var results = {};
    var lvMode = camera.status.liveview;
    async.series([
        function(cb){
            if(camera.config.destination.name == targetValue) cb(); else driver.set(camera, "destination", targetValue, cb);
        },
        function(cb){
            let check = function() {
                checkReady(camera, function(err, ready) {
                    if(err) return cb(err);
                    if(ready) return cb();
                    setTimeout(check, 50);
                });
            }
            check();
        },
        function(cb){
            ptp.transaction(camera._dev, 0x9207, [0xffffffff, camera.config.destination.code || 0], null, function(err, responseCode) {
                if(err) {
                    return cb(err);
                } else if(responseCode != 0x2001) {
                    return cb(responseCode);
                } else {
                    return cb();
                }
            });
        },
        function(cb){
            getImage(camera, 60000, function(err, imageResults) {
                results = imageResults;
                cb(err);
            });
        },
    ], function(err, res) {
        if(err) _logE("capture error", ptp.hex(res), "at item", res.length);
        if(err == 0x2019 && tries < 3) {
            return driver.capture(camera, target, options, callback, tries + 1);
        }
        callback && callback(err, results.thumb, results.filename, results.rawImage);
    });
}

driver.captureHDR = function(camera, target, options, frames, stops, darkerOnly, callback) {

}

driver.liveviewMode = function(camera, enable, callback) {
    if(camera._dev._lvTimer) clearTimeout(camera._dev._lvTimer);
    if(camera.status.liveview != !!enable) {
        if(enable) {
            camera._dev._lvTimer = setTimeout(function(){
                driver.liveviewMode(camera, false);
            }, 5000);
            ptp.initiateOpenCapture(camera._dev, function(err) {
                if(!err) camera.status.liveview = true;
                callback && callback(err);
            });
        } else {
            ptp.terminateOpenCapture(camera._dev, function(err) {
                if(!err) camera.status.liveview = false;
                callback && callback(err);
            });
        }
    } else {
        callback && callback();
    }
}

driver.liveviewImage = function(camera, callback) {
    if(camera.status.liveview) {
        if(camera._dev._lvTimer) clearTimeout(camera._dev._lvTimer);
        camera._dev._lvTimer = setTimeout(function(){
            _logD("automatically disabling liveview");
            driver.liveviewMode(camera, false);
        }, 5000);
        ptp.getObject(camera._dev, 0x80000001, function(err, image) {
            ptp.deleteObject(camera._dev, 0x80000001);
            callback && callback(err, image);
        });
    } else {
        callback && callback("not enabled");
    }
}

driver.moveFocus = function(camera, steps, resolution, callback) {

}


module.exports = driver;
