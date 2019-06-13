
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
            { name: "15m",     ev: -15,         code:  0 },
            { name: "8m",      ev: -14,         code:  0 },
            { name: "4m",      ev: -13,         code:  0 },
            { name: "2m",      ev: -12,         code:  0 },
            { name: "60s",     ev: -11,         code:  0 },
            { name: "50s",     ev: -11 - 2 / 3, code:  0 },
            { name: "40s",     ev: -11 - 1 / 3, code:  0 },
            { name: "30s",     ev: -11,         code:  0 },
            { name: "25s",     ev: -10 - 2 / 3, code:  0 },
            { name: "20s",     ev: -10 - 1 / 3, code:  0 },
            { name: "15s",     ev: -10,         code:  0 },
            { name: "13s",     ev: -9 - 3 / 3,  code:  0 },
            { name: "10s",     ev: -9 - 1 / 3,  code:  0 },
            { name: "8s",      ev: -9,          code:  0 },
            { name: "6s",      ev: -8 - 2 / 3,  code:  0 },
            { name: "5s",      ev: -8 - 1 / 3,  code:  0 },
            { name: "4s",      ev: -8,          code:  0 },
            { name: "3s",      ev: -7 - 2 / 3,  code:  0 },
            { name: "2.5s",    ev: -7 - 1 / 3,  code:  0 },
            { name: "2s",      ev: -7,          code:  0 },
            { name: "1.6s",    ev: -6 - 2 / 3,  code:  0 },
            { name: "1.3s",    ev: -6 - 1 / 3,  code:  0 },
            { name: "1s",      ev: -6,          code:  0 },
            { name: "0.8s",    ev: -5 - 2 / 3,  code:  0 },
            { name: "0.6s",    ev: -5 - 1 / 3,  code:  0 },
            { name: "1/2",     ev: -5,          code:  0 },
            { name: "0.4s",    ev: -4 - 2 / 3,  code:  0 },
            { name: "1/3",     ev: -4 - 1 / 3,  code:  0 },
            { name: "1/4",     ev: -4,          code:  0 },
            { name: "1/5",     ev: -3 - 2 / 3,  code:  0 },
            { name: "1/6",     ev: -3 - 1 / 3,  code:  0 },
            { name: "1/8",     ev: -3,          code:  0 },
            { name: "1/10",    ev: -2 - 2 / 3,  code:  0 },
            { name: "1/13",    ev: -2 - 1 / 3,  code:  0 },
            { name: "1/15",    ev: -2,          code:  0 },
            { name: "1/20",    ev: -1 - 2 / 3,  code:  0 },
            { name: "1/25",    ev: -1 - 1 / 3,  code:  0 },
            { name: "1/30",    ev: -1,          code:  0 },
            { name: "1/40",    ev: 0 - 2 / 3,   code:  0 },
            { name: "1/50",    ev: 0 - 1 / 3,   code:  0 },
            { name: "1/60",    ev: 0,           code:  0 },
            { name: "1/80",    ev: 0 + 1 / 3,   code:  0 },
            { name: "1/100",   ev: 0 + 2 / 3,   code:  0 },
            { name: "1/125",   ev: 1,           code:  0 },
            { name: "1/160",   ev: 1 + 1 / 3,   code:  0 },
            { name: "1/200",   ev: 1 + 2 / 3,   code:  0 },
            { name: "1/250",   ev: 2,           code:  0 },
            { name: "1/320",   ev: 2 + 1 / 3,   code:  0 },
            { name: "1/400",   ev: 2 + 2 / 3,   code:  0 },
            { name: "1/500",   ev: 3,           code:  0 },
            { name: "1/640",   ev: 3 + 1 / 3,   code:  0 },
            { name: "1/800",   ev: 3 + 2 / 3,   code:  0 },
            { name: "1/1000",  ev: 4,           code:  0 },
            { name: "1/1250",  ev: 4 + 1 / 3,   code:  0 },
            { name: "1/1600",  ev: 4 + 2 / 3,   code:  0 },
            { name: "1/2000",  ev: 5,           code:  0 },
            { name: "1/2500",  ev: 5 + 1 / 3,   code:  0 },
            { name: "1/3200",  ev: 5 + 2 / 3,   code:  0 },
            { name: "1/4000",  ev: 6,           code:  0 },
            { name: "1/5000",  ev: 6 + 1 / 3,   code:  0 },
            { name: "1/6400",  ev: 6 + 2 / 3,   code:  0 },
            { name: "1/8000",  ev: 7,           code:  0 },
            { name: "1/10000", ev: 7 + 1 / 3,   code:  0 },
            { name: "1/13000", ev: 7 + 2 / 3,   code:  0 },
            { name: "1/16000", ev: 8,           code:  0 },
            { name: "1/20000", ev: 8 + 1 / 3,   code:  0 },
            { name: "1/25000", ev: 8 + 2 / 3,   code:  0 },
            { name: "1/32000", ev: 9,           code:  0 }
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
            { name: "1.0",      ev: -8,          code: 0  },
            { name: "1.1",      ev: -7 - 2 / 3,  code: 0  },
            { name: "1.2",      ev: -7 - 1 / 3,  code: 0  },
            { name: "1.4",      ev: -7,          code: 0  },
            { name: "1.6",      ev: -6 - 2 / 3,  code: 0  },
            { name: "1.8",      ev: -6 - 1 / 3,  code: 0  },
            { name: "2.0",      ev: -6,          code: 0  },
            { name: "2.2",      ev: -5 - 2 / 3,  code: 0  },
            { name: "2.5",      ev: -5 - 1 / 3,  code: 0  },
            { name: "2.8",      ev: -5,          code: 0  },
            { name: "3.2",      ev: -4 - 2 / 3,  code: 0  },
            { name: "3.6",      ev: -4 - 1 / 3,  code: 0  },
            { name: "4.0",      ev: -4,          code: 0  },
            { name: "4.5",      ev: -3 - 2 / 3,  code: 0  },
            { name: "5.0",      ev: -3 - 1 / 3,  code: 0  },
            { name: "5.6",      ev: -3,          code: 0  },
            { name: "6.3",      ev: -2 - 2 / 3,  code: 0  },
            { name: "7.1",      ev: -2 - 1 / 3,  code: 0  },
            { name: "8",        ev: -2,          code: 0  },
            { name: "9",        ev: -1 - 2 / 3,  code: 0  },
            { name: "10",       ev: -1 - 1 / 3,  code: 0  },
            { name: "11",       ev: -1,          code: 0  },
            { name: "13",       ev: -0 - 2 / 3,  code: 0  },
            { name: "14",       ev: -0 - 1 / 3,  code: 0  },
            { name: "16",       ev:  0,          code: 0  },
            { name: "18",       ev:  0 + 1 / 3,  code: 0  },
            { name: "20",       ev:  0 + 2 / 3,  code: 0  },
            { name: "22",       ev:  1,          code: 0  },
            { name: "25",       ev:  2 + 1 / 3,  code: 0  },
            { name: "29",       ev:  2 + 2 / 3,  code: 0  },
            { name: "32",       ev:  3,          code: 0  },
            { name: "36",       ev:  3 + 1 / 3,  code: 0  },
            { name: "42",       ev:  3 + 2 / 3,  code: 0  },
            { name: "45",       ev:  4,          code: 0  },
            { name: "50",       ev:  4 + 1 / 3,  code: 0  },
            { name: "57",       ev:  4 + 2 / 3,  code: 0  },
            { name: "64",       ev:  5,          code: 0  }
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
            { name: "160",      ev: -2 / 3,      code: 0 },
            { name: "200",      ev: -1,          code: 0 },
            { name: "250",      ev: -1 - 1 / 3,  code: 0 },
            { name: "320",      ev: -1 - 2 / 3,  code: 0 },
            { name: "400",      ev: -2,          code: 0 },
            { name: "500",      ev: -2 - 1 / 3,  code: 0 },
            { name: "640",      ev: -2 - 2 / 3,  code: 0 },
            { name: "800",      ev: -3,          code: 0 },
            { name: "1000",     ev: -3 - 1 / 3,  code: 0 },
            { name: "1250",     ev: -3 - 2 / 3,  code: 0 },
            { name: "1600",     ev: -4,          code: 0 },
            { name: "2000",     ev: -4 - 1 / 3,  code: 0 },
            { name: "2500",     ev: -4 - 2 / 3,  code: 0 },
            { name: "3200",     ev: -5,          code: 0 },
            { name: "4000",     ev: -5 - 1 / 3,  code: 0 },
            { name: "5000",     ev: -5 - 2 / 3,  code: 0 },
            { name: "6400",     ev: -6,          code: 0 },
            { name: "8000",     ev: -6 - 1 / 3,  code: 0 },
            { name: "10000",    ev: -6 - 2 / 3,  code: 0 },
            { name: "12800",    ev: -7,          code: 0 },
            { name: "err-1",    ev: null,        code: 0 },
            { name: "err-2",    ev: null,        code: 0 },
            { name: "err-3",    ev: null,        code: 0 }
        ]
    },
    'format': {
        name: 'format',
        category: 'config',
        setFunction: ptp.setPropU16,
        getFunction: ptp.getPropU16,
        listFunction: ptp.listProp,
        code: 0xD018,
        ev: false,
        values: [
            { name: "RAW",               value: 'raw',      code: 0  },
            { name: "JPEG Fine",         value: null,       code: 0  },
            { name: "JPEG Normal",       value: null,       code: 0  },
            { name: "RAW + JPEG Fine",   value: null,       code: 0  },
            { name: "RAW + JPEG Normal", value: 'raw+jpeg', code: 0  }
        ]
    },
    'destination': {
        name: 'destination',
        category: 'config',
        setFunction: ptp.setPropU16,
        getFunction: ptp.getPropU16,
        listFunction: ptp.listProp,
        code: 0xD20C,
        ev: false,
        values: [
            { name: "UNKNOWN1",          code: 0  },
            { name: "camera",            code: 0  },
            { name: "UNKNOWN2",          code: 0  },
            { name: "VIEW",              code: 0  },
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
                    properties[key].listFunction(camera._dev, properties[key].code, function(err, current, list, type) {
                        _logD(key, "type is", type);
                        if(!camera[properties[key].category]) camera[properties[key].category] = {};
                        if(!camera[properties[key].category][key]) camera[properties[key].category][key] = {};
                        var currentMapped = mapPropertyItem(current, properties[key].values);
                        if(!currentMapped) {
                            _logD(key, "item not found:", current);
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
                        fetchNextProperty();
                    });
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
    ptp.init(camera._dev, function(err, di) {
        async.series([
            function(cb){ptp.setPropU16(camera._dev, 0xd38c, 1, cb);}, // PC mode
            function(cb){ptp.setPropU16(camera._dev, 0xd207, 2, cb);},  // USB control
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

    var check = function() {
        if(Date.now() - startTime > timeout) {
            return callback && callback("timeout", results);
        }
        ptp.getPropData(camera._dev, 0xd212, function(err, data) { // wait if busy
            //console.log("data:", data);
            if(!err && data && data.length >= 4 && data.readUInt16LE(2) == 0xD20E) {
                var getHandles = function() {
                    if(Date.now() - startTime > timeout) {
                        return callback && callback("timeout", results);
                    }
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
    var targetValue = (!target || target == "camera") ? "camera" : "VIEW";
    camera.thumbnail = targetValue == 'camera';
    var results = {};
    var lvMode = camera.status.liveview;
    async.series([
        function(cb){
            if(lvMode) driver.liveviewMode(camera, false, cb); else cb();
        },
        function(cb){
            if(camera.config.destination.name == targetValue) cb(); else driver.set(camera, "destination", targetValue, cb);
        },
        function(cb){ptp.setPropU16(camera._dev, 0xd208, 0x0200, cb);},
        function(cb){ptp.ptpCapture(camera._dev, [0x0, 0x0], cb);},
        function(cb){
            var check = function() {
                ptp.getPropU16(camera._dev, 0xd209, function(err, data) { // wait if busy
                    if(data == 0x0001) {
                        setTimeout(check, 50);
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
        function(cb){
            if(lvMode) driver.liveviewMode(camera, true, cb); else cb();
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
