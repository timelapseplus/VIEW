
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

driver.name = "Olympus";

function _logD() {
    if(arguments.length > 0) {
        arguments[0] = "PTP-OLYMPUS: " + arguments[0];
    }
    console.log.apply(console, arguments);
}

function _logE() {
    if(arguments.length > 0) {
        arguments[0] = "PTP-OLYMPUS: " + arguments[0];
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


driver.supportsNativeHDR = true;

driver.supportedCameras = {
    '07b4:0130': { name: "Olympus OM-D",   status: 'unknown', supports: { shutter: true, aperture: true, iso: true, liveview: true, destination: true, focus: true, }, usb: 'USB C' },
}

var properties = {
    'shutter': {
        name: 'shutter',
        category: 'exposure',
        setFunction: ptp.setPropU32,
        getFunction: ptp.getPropU32,
        listFunction: ptp.listProp,
        code: 0xD01C,
        ev: true,
        values: [
            { name: "LIVETIME", ev: null,        code:  4294967293 },
            { name: "bulb",     ev: null,        code:  4294967292 },
            { name: "LIVECOMP", ev: null,        code:  4294967290 },
            { name: "60s",     ev: -11,         code:  39321610  },
            { name: "50s",     ev: -11,         code:  32768010  },
            { name: "40s",     ev: -11,         code:  26214410  },
            { name: "30s",     ev: -11,         code:  19660810  },
            { name: "25s",     ev: -10 - 2 / 3, code:  16384010  },
            { name: "20s",     ev: -10 - 1 / 3, code:  13107210  },
            { name: "15s",     ev: -10,         code:  9830410  },
            { name: "13s",     ev: -9 - 2 / 3,  code:  8519690  },
            { name: "10s",     ev: -9 - 1 / 3,  code:  6553610  },
            { name: "8s",      ev: -9,          code:  5242890  },
            { name: "6s",      ev: -8 - 2 / 3,  code:  3932170  },
            { name: "5s",      ev: -8 - 1 / 3,  code:  3276810  },
            { name: "4s",      ev: -8,          code:  2621450  },
            { name: "3s",      ev: -7 - 2 / 3,  code:  2097162  },
            { name: "2.5s",    ev: -7 - 1 / 3,  code:  1638410  },
            { name: "2s",      ev: -7,          code:  1310730  },
            { name: "1.6s",    ev: -6 - 2 / 3,  code:  1048586  },
            { name: "1.3s",    ev: -6 - 1 / 3,  code:  851978  },
            { name: "1s",      ev: -6,          code:  655370  },
            { name: "0.8s",    ev: -5 - 2 / 3,  code:  655373  },
            { name: "0.6s",    ev: -5 - 1 / 3,  code:  655376  },
            { name: "1/2",     ev: -5,          code:  655380  },
            { name: "0.4s",    ev: -4 - 2 / 3,  code:  655385  },
            { name: "1/3",     ev: -4 - 1 / 3,  code:  65539  },
            { name: "1/4",     ev: -4,          code:  65540  },
            { name: "1/5",     ev: -3 - 2 / 3,  code:  65541  },
            { name: "1/6",     ev: -3 - 1 / 3,  code:  65542  },
            { name: "1/8",     ev: -3,          code:  65544  },
            { name: "1/10",    ev: -2 - 2 / 3,  code:  65546  },
            { name: "1/13",    ev: -2 - 1 / 3,  code:  65549  },
            { name: "1/15",    ev: -2,          code:  65551  },
            { name: "1/20",    ev: -1 - 2 / 3,  code:  65556  },
            { name: "1/25",    ev: -1 - 1 / 3,  code:  65561  },
            { name: "1/30",    ev: -1,          code:  65566  },
            { name: "1/40",    ev: 0 - 2 / 3,   code:  65576  },
            { name: "1/50",    ev: 0 - 1 / 3,   code:  65586  },
            { name: "1/60",    ev: 0,           code:  65596  },
            { name: "1/80",    ev: 0 + 1 / 3,   code:  65616  },
            { name: "1/100",   ev: 0 + 2 / 3,   code:  65636  },
            { name: "1/125",   ev: 1,           code:  65661  },
            { name: "1/160",   ev: 1 + 1 / 3,   code:  65696  },
            { name: "1/200",   ev: 1 + 2 / 3,   code:  65736  },
            { name: "1/250",   ev: 2,           code:  65786  },
            { name: "1/320",   ev: 2 + 1 / 3,   code:  65856  },
            { name: "1/400",   ev: 2 + 2 / 3,   code:  65936  },
            { name: "1/500",   ev: 3,           code:  66036  },
            { name: "1/640",   ev: 3 + 1 / 3,   code:  66176  },
            { name: "1/800",   ev: 3 + 2 / 3,   code:  66336  },
            { name: "1/1000",  ev: 4,           code:  66536  },
            { name: "1/1250",  ev: 4 + 1 / 3,   code:  66786  },
            { name: "1/1600",  ev: 4 + 2 / 3,   code:  67136  },
            { name: "1/2000",  ev: 5,           code:  67536  },
            { name: "1/2500",  ev: 5 + 1 / 3,   code:  68036  },
            { name: "1/3200",  ev: 5 + 2 / 3,   code:  68736  },
            { name: "1/4000",  ev: 6,           code:  69536  },
            { name: "1/5000",  ev: 6 + 1 / 3,   code:  70536  },
            { name: "1/6400",  ev: 6 + 2 / 3,   code:  71936  },
            { name: "1/8000",  ev: 7,           code:  73536  },
        ]
    },
    'aperture': {
        name: 'aperture',
        category: 'exposure',
        setFunction: ptp.setPropU16,
        getFunction: ptp.getPropU16,
        listFunction: ptp.listProp,
        code: 0xD002,
        ev: true,
        values: [
            { name: "1.0",      ev: -8,          code: 10  },
            { name: "1.1",      ev: -7 - 2 / 3,  code: 11  },
            { name: "1.2",      ev: -7 - 1 / 3,  code: 12  },
            { name: "1.4",      ev: -7,          code: 14  },
            { name: "1.6",      ev: -6 - 2 / 3,  code: 16  },
            { name: "1.8",      ev: -6 - 1 / 3,  code: 18  },
            { name: "2.0",      ev: -6,          code: 20  },
            { name: "2.2",      ev: -5 - 2 / 3,  code: 22  },
            { name: "2.5",      ev: -5 - 1 / 3,  code: 25  },
            { name: "2.8",      ev: -5,          code: 28  },
            { name: "3.2",      ev: -4 - 2 / 3,  code: 32  },
            { name: "3.5",      ev: -4 - 1 / 3,  code: 35  },
            { name: "3.6",      ev: -4 - 1 / 3,  code: 36  },
            { name: "4.0",      ev: -4,          code: 40  },
            { name: "4.5",      ev: -3 - 2 / 3,  code: 45  },
            { name: "5.0",      ev: -3 - 1 / 3,  code: 50  },
            { name: "5.6",      ev: -3,          code: 56  },
            { name: "6.3",      ev: -2 - 2 / 3,  code: 63  },
            { name: "6.3",      ev: -2 - 2 / 3,  code: 64  },
            { name: "7.1",      ev: -2 - 1 / 3,  code: 71  },
            { name: "8",        ev: -2,          code: 80  },
            { name: "9",        ev: -1 - 2 / 3,  code: 90  },
            { name: "10",       ev: -1 - 1 / 3,  code: 100  },
            { name: "11",       ev: -1,          code: 110  },
            { name: "13",       ev: -0 - 2 / 3,  code: 130  },
            { name: "14",       ev: -0 - 1 / 3,  code: 140  },
            { name: "16",       ev:  0,          code: 160  },
            { name: "18",       ev:  0 + 1 / 3,  code: 180  },
            { name: "20",       ev:  0 + 2 / 3,  code: 200  },
            { name: "22",       ev:  1,          code: 220  },
            { name: "25",       ev:  2 + 1 / 3,  code: 250  },
            { name: "29",       ev:  2 + 2 / 3,  code: 290  },
            { name: "32",       ev:  3,          code: 320  },
            { name: "36",       ev:  3 + 1 / 3,  code: 360  },
            { name: "42",       ev:  3 + 2 / 3,  code: 420  },
            { name: "45",       ev:  4,          code: 450  },
            { name: "50",       ev:  4 + 1 / 3,  code: 500  },
            { name: "57",       ev:  4 + 2 / 3,  code: 570  },
            { name: "64",       ev:  5,          code: 640  }
        ]
    },
    'iso': {
        name: 'iso',
        category: 'exposure',
        setFunction: ptp.setProp32,
        getFunction: ptp.getProp32,
        listFunction: ptp.listProp,
        code: 0xD007,
        ev: true,
        values: [
            { name: "32",       ev:  1 + 2 / 3,  code: 32 },
            { name: "40",       ev:  1 + 1 / 3,  code: 40 },
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
        setFunction: ptp.setPropU8,
        getFunction: ptp.getPropU8,
        listFunction: ptp.listProp,
        code: 0xd00d,
        ev: false,
        values: [
            { name: "RAW",               value: 'raw',      code: 35   },
            { name: "Large JPEG Fine",   value: 'jpeg',     code: 257  },
            { name: "Large JPEG",        value: 'jpeg',     code: 258  },
            { name: "Medium JPEG",       value: 'jpeg',     code: 259  },
            { name: "Small JPEG",        value: 'jpeg',     code: 260  },
            { name: "RAW + JPEG Large Fine",  value: 'raw+jpeg', code: 289  },
            { name: "RAW + JPEG Large",       value: 'raw+jpeg', code: 290  },
            { name: "RAW + JPEG Medium",      value: 'raw+jpeg', code: 291  },
            { name: "RAW + JPEG Small",       value: 'raw+jpeg', code: 292  },
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
    },
    'focusPos': {
        name: 'focusPos',
        category: 'status',
        setFunction: null,
        getFunction: null,
        listFunction: null,
        code: null,
        ev: false,
        default: 0,
    },
    'battery': {
        name: 'battery',
        category: 'status',
        setFunction: null,
        getFunction: ptp.getPropU8,
        listFunction: null,
        code: 0x5001,
        ev: false,
    },
    'burst': {
        name: 'burst',
        category: 'config',
        setFunction: ptp.setPropU16,
        getFunction: ptp.getPropU16,
        listFunction: null,
        code: 0x5018,
        ev: false,
    },
    //'bracketing': {
    //    name: 'bracketing',
    //    category: 'config',
    //    setFunction: ptp.setPropU8,
    //    getFunction: ptp.getPropU8,
    //    listFunction: ptp.listProp,
    //    code: 0xD0C0,
    //    ev: false,
    //    values: [
    //        { name: "disabled",  value: 0, code: 0 },
    //        { name: "enabled",   value: 1, code: 1 },
    //    ]
    //},
    //'bracketingStops': {
    //    name: 'bracketingStops',
    //    category: 'config',
    //    setFunction: ptp.setPropU8,
    //    getFunction: ptp.getPropU8,
    //    listFunction: ptp.listProp,
    //    code: 0xD0C1,
    //    ev: false,
    //    values: [
    //        { name: "1/3 stop",  value: 1/3, code: 0 },
    //        { name: "2/3 stop",  value: 2/3, code: 1 },
    //        { name: "1 stop",    value: 1,   code: 2 },
    //        { name: "2 stop",    value: 2,   code: 3 },
    //        { name: "3 stop",    value: 3,   code: 4 },
    //    ]
    //},
    //'bracketingProgram': {
    //    name: 'bracketingProgram',
    //    category: 'config',
    //    setFunction: ptp.setPropU8,
    //    getFunction: ptp.getPropU8,
    //    listFunction: ptp.listProp,
    //    code: 0xD0C2,
    //    ev: false,
    //    values: [
    //        { name: "2, minus side",  value: -2,   code: 0 },
    //        { name: "2, plus side",   value: 2,    code: 1 },
    //        { name: "3, minus side",  value: -3,   code: 2 },
    //        { name: "3, plus side",   value: null, code: 3 },
    //        { name: "3, both sides",  value: 3,    code: 4 },
    //        { name: "5, both sides",  value: 5,    code: 5 },
    //        { name: "7, both sides",  value: 7,    code: 6 },
    //        { name: "9, both sides",  value: 9,    code: 7 },
    //    ]
    //},
    //'bracketingCount': {
    //    name: 'bracketingCount',
    //    category: 'config',
    //    setFunction: ptp.setPropU8,
    //    getFunction: ptp.getPropU8,
    //    listFunction: ptp.listProp,
    //    code: 0xD0C3,
    //    ev: false,
    //    values: [
    //        { name: "UNKNOWN",  value: 0, code: 1 },
    //    ]
    //},
    //'bracketingOrder': {
    //    name: 'bracketingOrder',
    //    category: 'config',
    //    setFunction: ptp.setPropU8,
    //    getFunction: ptp.getPropU8,
    //    listFunction: ptp.listProp,
    //    code: 0xD07A,
    //    ev: false,
    //    values: [
    //        { name: "Center first",  value: 'center', code: 0 },
    //        { name: "Under first",   value: 'under',  code: 1 },
    //    ]
    //},
    //'bracketingParams': {
    //    name: 'bracketingParams',
    //    category: 'config',
    //    setFunction: ptp.setPropU8,
    //    getFunction: ptp.getPropU8,
    //    listFunction: ptp.listProp,
    //    code: 0xD079,
    //    ev: false,
    //    values: [
    //        { name: "Shutter",            value: 's',   code: 0 },
    //        { name: "Shutter/Aperture",   value: 's+a', code: 1 },
    //        { name: "Aperture",           value: 'a',   code: 2 },
    //        { name: "Flash only",         value: 'f',   code: 3 },
    //    ]
    //},
    //'bracketingMode': {
    //    name: 'bracketingMode',
    //    category: 'config',
    //    setFunction: ptp.setPropU8,
    //    getFunction: ptp.getPropU8,
    //    listFunction: ptp.listProp,
    //    code: 0xD078,
    //    ev: false,
    //    values: [
    //        { name: "AE & Flash",         value: 'flash',   code: 0 },
    //        { name: "AE only",            value: 'default', code: 1 },
    //        { name: "Flash only",         value: null,      code: 2 },
    //        { name: "ADL Bracketing",     value: null,      code: 3 },
    //    ]
    //},
    'focusMode': {
        name: 'focusMode',
        category: 'config',
        setFunction: ptp.setPropU16,
        getFunction: ptp.getPropU16,
        listFunction: ptp.listProp,
        code: 0x500A,
        ev: false,
        values: [
            { name: "MF",         value: 'mf',       code: 0x0001 },
            { name: "AF",         value: 'af',       code: 0x0002 },
            { name: "AF Macro",   value: null,       code: 0x0003 },
            { name: "AF-S",       value: null,       code: 0x8010 },
            { name: "AF-C",       value: null,       code: 0x8011 },
            { name: "AF-A",       value: null,       code: 0x8012 },
        ]
    },
    'liveviewMode': {
        name: 'liveviewMode',
        category: 'config',
        setFunction: ptp.setPropU32,
        getFunction: ptp.getPropU32,
        listFunction: ptp.listProp,
        code: 0xD06D,
        ev: false,
        values: [
            { name: "enabled",         value: 'on',        code: 67109632 },
            { name: "disabled",        value: 'off',       code: 0 },
        ]
    },
    'focusPoint': {
        name: 'focusPoint',
        category: 'config',
        setFunction: ptp.setPropU32,
        getFunction: ptp.getPropU32,
        listFunction: ptp.listProp,
        code: 0xD051,
        ev: false,
        values: [
            { name: "unknown",         value: 'on',        code: 0 },
        ]
    },
}

driver.properties = properties;

function propMapped(propCode) {
    for(name in properties) {
        if(properties.hasOwnProperty(name)) {
            if(propCode === properties[name].code) return true;
        }
    }
    return false;
}

driver._error = function(camera, error) { // events received
    _logE(error);
};

driver._event = function(camera, data) { // events received
    if(!camera._eventData) {
        camera._eventData = data;
    } else {
        camera._eventData = Buffer.concat([camera._eventData, data]);
    }
    if(camera._eventData.length < 12) return;
    ptp.parseEvent(camera._eventData, function(type, event, param1, param2, param3) {
        camera._eventData = null;
        if(event == 0xC102) {
            _logD("object added:", ptp.hex(param1));
            camera._objectsAdded.push(param1);
        } else if(event == 0xC108) {
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
            if(propMapped(param1)) {
                _logD("property changed:", ptp.hex(param1), "(mapped)");
                check();
            } else {
                _logD("property changed:", ptp.hex(param1), "(not mapped)");
            }
        } else {
            _logD("EVENT:", ptp.hex(event), data);
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
                        properties[key].listFunction(camera._dev, properties[key].code, function(err, current, list, valueSize, listType) {
                            if(err || !list) {
                                _logE("failed to list", key, ", err:", err);
                            } else {
                                var propertyListValues = properties[key].values;
                                properties[key].size = valueSize; // save for setting value
                                if(properties[key].filter) {
                                    var val = properties[key].filter.fn(list);
                                    propertyListValues = propertyListValues.filter(function(item) {
                                        return item[properties[key].filter.by] == val;
                                    });
                                }
                                _logD(key, "size is", valueSize, "listType", listType);
                                if(listType == 1 && list.length == 3) { // convert range to list
                                    _logD(key, "list", list);
                                    var newList = [];
                                    for(var val = list[0]; val <= list[1]; val += list[2]) newList.push(val);
                                    list = newList;
                                }
                                var currentMapped = mapPropertyItem(current, propertyListValues);
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
                                    var mappedItem = mapPropertyItem(list[i], propertyListValues);
                                    if(!mappedItem) {
                                        if(key != "aperture") _logE(key, "list item not found:", list[i]);
                                    } else {
                                        mappedList.push(mappedItem);
                                    }
                                }
                                camera[properties[key].category][key].list = mappedList;
                            }
                            fetchNextProperty();
                        });
                    } else if(properties[key].getFunction) {
                        driver.get(camera, key, function(err, val){
                            _logD(key, "=", val);
                            fetchNextProperty();
                        });
                    } else {
                        if(properties[key].default != null) {
                            if(properties[key].values) {
                                if(!camera[properties[key].category][key]) {
                                    var currentMapped = mapPropertyItem(properties[key].default, properties[key].values);
                                    camera[properties[key].category][key] = ptp.objCopy(currentMapped, {});
                                    var mappedList = [];
                                    for(var i = 0; i < properties[key].values.length; i++) {
                                        mappedList.push(properties[key].values[i]);
                                    }
                                    camera[properties[key].category][key].list = mappedList;
                                }
                            } else {
                                camera[properties[key].category][key] = properties[key].default;
                            }
                        }
                        fetchNextProperty();
                    }
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
    camera.supportsNativeHDR = driver.supportsNativeHDR;
    camera._objectsAdded = [];
    ptp.init(camera._dev, function(err, di) {
        async.series([
            function(cb){ ptp.transaction(camera._dev, 0x1016, [0xD052], ptp.uint16buf(0x0001), cb); },
            function(cb){driver.refresh(camera, cb);}  // get settings
        ], function(err) {
            callback && callback(err);
        });
    });
}

function mapPropertyItem(cameraValue, list) {
    if(list == null) return cameraValue;
    for(var i = 0; i < list.length; i++) {
        if(cameraValue == list[i].code) return list[i];
    }
    return null;
}
function equalEv(ev1, ev2) {
    if(ev1 == null || ev2 == null) {
        return ev1 == ev2;
    }
    return Math.abs(ev1 - ev2) < 0.15;
}
driver.set = function(camera, param, value, callback) {
    async.series([
        function(cb){
            var cameraValue = null;
            if(properties[param].values) {
                if(properties[param].ev && typeof value == "number") {
                    for(var i = 0; i < properties[param].values.length; i++) {
                        if(equalEv(properties[param].values[i].ev, value)) {
                            cameraValue = properties[param].values[i].code;
                            break;
                        }
                    }
                } else {
                    for(var i = 0; i < properties[param].values.length; i++) {
                        if(properties[param].values[i].name == value || properties[param].values[i].value == value) {
                            cameraValue = properties[param].values[i].code;
                            break;
                        }
                    }
                }
            } else {
                cameraValue = value;            
            }
            if(properties[param] && properties[param].setFunction) {
                if(cameraValue !== null) {
                    _logD("setting", ptp.hex(properties[param].code), "to", cameraValue);
                    properties[param].setFunction(camera._dev, properties[param].code, cameraValue, function(err) {
                        if(!err) {
                            if(properties[param].values) {
                                var newItem =  mapPropertyItem(cameraValue, properties[param].values);
                                for(var k in newItem) {
                                    if(newItem.hasOwnProperty(k)) camera[properties[param].category][param][k] = newItem[k];
                                }
                            } else {
                                camera[properties[param].category][param][k] = cameraValue;
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
                if(properties[param].values) {
                    var newItem =  mapPropertyItem(cameraValue, properties[param].values);
                    for(var k in newItem) {
                        if(newItem.hasOwnProperty(k)) camera[properties[param].category][param][k] = newItem[k];
                    }
                } else {
                    camera[properties[param].category][param][k] = cameraValue;
                }
                cb();
                exposureEvent(camera);
            } else {
                _logE("set: unknown param", param);
                return cb("unknown param");
            }
        },
    ], function(err) {
        if(!properties[param].ev) {
            driver.refresh(camera, callback);
        } else {
            return callback && callback(err);
        }
    });
}

driver.get = function(camera, param, callback) {
    async.series([
        function(cb){
            if(properties[param] && properties[param].getFunction) {
                properties[param].getFunction(camera._dev, properties[param].code, function(err, data, size) {
                    if(!err) {
                        properties[param].size = size;
                        if(properties[param].values) {
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
                        } else {
                            if(properties[param].parser) {
                                data = properties[param].parser(data);
                            }
                            camera[properties[param].category][param] = data;                   
                        }
                        return cb(err);
                    } else {
                        return cb(err);
                    }
                });
            } else {
                if(properties[param] && properties[param].default) {
                    return cb();
                } else {
                    return cb("unknown param");
                }
            }
        },
    ], function(err) {
        return callback && callback(err, camera[properties[param].category][param]);
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
        if(camera.thumbnail) { // saved to camera
            if(camera._objectsAdded.length == 0) {
                return setTimeout(check, 50);
            }
        }
        var objectId = camera._objectsAdded.shift();
        ptp.getObjectInfo(camera._dev, objectId, function(err, oi) {
            //console.log(oi);
            if(oi.objectFormat == ptp.PTP_OFC_Association) return setTimeout(check, 50); // folder added, keep waiting for image
            var image = null;
            results.filename = oi.filename;
            results.indexNumber = objectId;
            if(camera.thumbnail) {
                ptp.getThumb(camera._dev, objectId, function(err, jpeg) {
                    results.thumb = jpeg;
                    if(camera.config.destination.name == 'VIEW') {
                        ptp.deleteObject(camera._dev, objectId, function() {
                            callback && callback(err, results);
                        });
                    } else {
                        callback && callback(err, results);
                    }
                });
            } else {
                ptp.getObject(camera._dev, objectId, function(err, image) {
                    results.thumb = ptp.extractJpeg(image);
                    results.rawImage = image;
                    if(camera.config.destination.name == 'VIEW') {
                        ptp.deleteObject(camera._dev, objectId, function() {
                            callback && callback(err, results);
                        });
                    } else {
                        callback && callback(err, results);
                    }
                });
            }
        });
    }
    check();
}

driver.capture = function(camera, target, options, callback, noImage, noChangeBracketing, _tries) {
    var targetValue = (!target || target == "camera") ? "camera" : "VIEW";
    camera.thumbnail = targetValue == 'camera';
    var results = {};
    async.series([
        function(cb){ // set destination
            if(camera.config.destination.name == targetValue) cb(); else driver.set(camera, "destination", targetValue, cb);
        },
        function(cb){ ptp.transaction(camera._dev, 0x9481, [0x0003], null, cb); }, // press shutter
        function(cb){ ptp.transaction(camera._dev, 0x9481, [0x0006], null, cb); }, // release shutter
        function(cb){ // retrieve captured image
            getImage(camera, 60000, function(err, imageResults) {
                results = imageResults;
                cb(err);
            });
        },
    ], function(err, res) {
        if(err) _logE("capture error", ptp.hex(err), "at item", res.length);
        if(err == 0x2019 && _tries < 3) {
            return driver.capture(camera, target, options, callback, noImage, noChangeBracketing, _tries + 1);
        }
        if(err == ptp.PTP_RC_StoreFull || err == ptp.PTP_RC_StoreNotAvailable) {
            err = "camera card full or unavailable";
        } 
        if(err == ptp.PTP_RC_StoreReadOnly) {
            err = "camera card is read-only";
        } 
        callback && callback(err, results.thumb, results.filename, results.rawImage);
    });
}

/*
    enableBracketing = 0xD0C0 (8-bit, 1=enabled, 0=disabled)
    

*/
driver.captureHDR = function(camera, target, options, frames, stops, darkerOnly, callback, _tries) {
    callback && callback("not supported");
}

driver.liveviewMode = function(camera, enable, callback, _tries) {
    if(!_tries) _tries = 0;
    if(camera._dev._lvTimer) clearTimeout(camera._dev._lvTimer);
    //if(enable) {
    //    camera._dev._lvTimer = setTimeout(function(){
    //        driver.liveviewMode(camera, false);
    //    }, 60000*10);
    //}
    if(camera.status.liveview != !!enable) {
        if(enable) {
            driver.set(camera, 'liveviewMode', 'on', function(err) {
                if(err == 0x2019) {
                    _tries++;
                    if(_tries < 15) {
                        return setTimeout(function(){
                            driver.liveviewMode(camera, enable, callback, _tries);
                        }, 50);
                    }
                }
                if(err) {
                    _logD("error enabling liveview:", err);
                    return callback && callback(err);
                }
                camera.status.liveview = true;
                _logD("LV enabled");
                return callback && callback();
            });
        } else {
            driver.set(camera, 'liveviewMode', 'off', function(err) {
                if(err) return callback && callback(err);
                camera.status.liveview = false;
                _logD("LV disabled");
                return callback && callback();
            });
        }
    } else {
        callback && callback();
    }
}

driver.liveviewImage = function(camera, callback, _tries) {
    if(!_tries) _tries = 1;
    if(camera.status.liveview) {
        if(camera._dev._lvTimer) clearTimeout(camera._dev._lvTimer);
        camera._dev._lvTimer = setTimeout(function(){
            _logD("automatically disabling liveview");
            driver.liveviewMode(camera, false);
        }, 5000);

        ptp.transaction(camera._dev, 0x9484, [0x00000001], null, function(err, responseCode, data) {
            if(err) return callback && callback(err);
            //_logD("preview data:", data);
            if((!data || data.length < 1024) && _tries > 25) return callback && callback(responseCode);
            if(data && data.length >= 1024) {
                var image = ptp.extractJpegSimple(data);
                if(image) {
                    return callback && callback(null, image);
                } else {
                    setTimeout(function(){
                        driver.liveviewImage(camera, callback, _tries + 1);
                    }, 50);
                }
            } else {
                setTimeout(function(){
                    driver.liveviewImage(camera, callback, _tries + 1);
                }, 50);
            }
        });
    } else {
        callback && callback("not enabled");
    }
}

driver.moveFocus = function(camera, steps, resolution, callback) {
    if(!steps) return callback && callback();

    var dir = steps < 0 ? 0x02 : 0x01;
    var sign = steps < 0 ? -1 : 1;
    resolution = Math.round(Math.abs(resolution));

    if(resolution > 3) resolution = 0x3c;
    if(resolution == 2) resolution = 0x0e;
    if(resolution < 1) resolution = 0x03;
    steps = Math.round(Math.abs(steps));

    var doStep = function() {
        ptp.transaction(camera._dev, 0x9487, [dir, resolution], null, function(err, responseCode) {
            if(err) return callback && callback(err);
            steps--;
            camera.status.focusPos += sign;
            if(steps > 0) {
                setTimeout(doStep, 50);
            } else {
                callback && callback();
            }
        });
    }
    doStep();
}

driver.setFocusPoint = function(camera, x, y, callback) {
    var focusPoint = camera.config.focusPoint;
    focusPoint.x = x;
    focusPoint.y = y;
    driver.set(camera, 'focusPoint', focusPoint, callback);
}

driver.af = function(camera, callback) {
    var buf = new Buffer(8);
    buf.writeUInt32LE(0x03000055, 0); // might also be 0x03000055
    buf.writeUInt32LE(0x00000000, 4);

    ptp.transaction(camera._dev, 0x9416, [0x03000055], buf, callback);
}



module.exports = driver;
