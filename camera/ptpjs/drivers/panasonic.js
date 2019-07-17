
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

driver.name = "Panasonic";

function _logD() {
    if(arguments.length > 0) {
        arguments[0] = "PTP-PANASONIC: " + arguments[0];
    }
    console.log.apply(console, arguments);
}

function _logE() {
    if(arguments.length > 0) {
        arguments[0] = "PTP-PANASONIC: " + arguments[0];
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

var PTP_OC_PANASONIC_GetProperty      =  0x9402;
var PTP_OC_PANASONIC_SetProperty      =  0x9403;
var PTP_OC_PANASONIC_ListProperty     =  0x9108;
var PTP_OC_PANASONIC_9401             =  0x9401;
var PTP_OC_PANASONIC_InitiateCapture  =  0x9404;
var PTP_OC_PANASONIC_9101             =  0x9101;
var PTP_OC_PANASONIC_9102             =  0x9102;
var PTP_OC_PANASONIC_9107             =  0x9107;
var PTP_OC_PANASONIC_Liveview         =  0x9412;
var PTP_OC_PANASONIC_LiveviewImage    =  0x9706;
var PTP_OC_PANASONIC_PollEvents       =  0x9414;
var PTP_OC_PANASONIC_ManualFocusDrive =  0x9416;
var PTP_OC_PANASONIC_SetCaptureTarget =  0x940B;



driver.supportsNativeHDR = true;

driver.supportedCameras = {
    '04da:2382': { name: "Panasonic Lumix",   status: 'unknown', supports: { shutter: true, aperture: true, iso: true, liveview: true, destination: true, focus: true, }, usb: 'USB C' },
}

var properties = {
    'shutter': {
        name: 'shutter',
        category: 'exposure',
        setFunction: setProperty,
        getFunction: getProperty,
        listFunction: listProperty,
        code: 0x2000030,
        ev: true,
        values: [
            { name: "bulb",    ev: null,        code:  4294967295 },
            { name: "60s",     ev: -12,         code:  2147543648 },
            { name: "50s",     ev: -11 - 2 / 3, code:  2147533648 },
            { name: "40s",     ev: -11 - 1 / 3, code:  2147523648 },
            { name: "30s",     ev: -11,         code:  2147513648 },
            { name: "25s",     ev: -10 - 2 / 3, code:  2147508648 },
            { name: "20s",     ev: -10 - 1 / 3, code:  2147503648 },
            { name: "15s",     ev: -10,         code:  2147498648 },
            { name: "13s",     ev: -9 - 2 / 3,  code:  2147496648 },
            { name: "10s",     ev: -9 - 1 / 3,  code:  2147493648 },
            { name: "8s",      ev: -9,          code:  2147491648 },
            { name: "6s",      ev: -8 - 2 / 3,  code:  2147489648 },
            { name: "5s",      ev: -8 - 1 / 3,  code:  2147488648 },
            { name: "4s",      ev: -8,          code:  2147487648 },
            { name: "3s",      ev: -7 - 2 / 3,  code:  2147486848 },
            { name: "2.5s",    ev: -7 - 1 / 3,  code:  2147486148 },
            { name: "2s",      ev: -7,          code:  2147485648 },
            { name: "1.6s",    ev: -6 - 2 / 3,  code:  2147485248 },
            { name: "1.3s",    ev: -6 - 1 / 3,  code:  2147484948 },
            { name: "1s",      ev: -6,          code:  2147484648 },
            { name: "0.8s",    ev: -5 - 2 / 3,  code:  1300 },
            { name: "0.6s",    ev: -5 - 1 / 3,  code:  1600 },
            { name: "1/2",     ev: -5,          code:  2000 },
            { name: "0.4s",    ev: -4 - 2 / 3,  code:  2500 },
            { name: "1/3",     ev: -4 - 1 / 3,  code:  3200 },
            { name: "1/4",     ev: -4,          code:  4000 },
            { name: "1/5",     ev: -3 - 2 / 3,  code:  5000 },
            { name: "1/6",     ev: -3 - 1 / 3,  code:  6000 },
            { name: "1/8",     ev: -3,          code:  8000 },
            { name: "1/10",    ev: -2 - 2 / 3,  code:  10000 },
            { name: "1/13",    ev: -2 - 1 / 3,  code:  13000 },
            { name: "1/15",    ev: -2,          code:  15000 },
            { name: "1/20",    ev: -1 - 2 / 3,  code:  20000 },
            { name: "1/25",    ev: -1 - 1 / 3,  code:  25000 },
            { name: "1/30",    ev: -1,          code:  30000 },
            { name: "1/40",    ev: 0 - 2 / 3,   code:  40000 },
            { name: "1/50",    ev: 0 - 1 / 3,   code:  50000 },
            { name: "1/60",    ev: 0,           code:  60000 },
            { name: "1/80",    ev: 0 + 1 / 3,   code:  80000 },
            { name: "1/100",   ev: 0 + 2 / 3,   code:  100000 },
            { name: "1/125",   ev: 1,           code:  125000 },
            { name: "1/160",   ev: 1 + 1 / 3,   code:  160000 },
            { name: "1/200",   ev: 1 + 2 / 3,   code:  200000 },
            { name: "1/250",   ev: 2,           code:  250000 },
            { name: "1/320",   ev: 2 + 1 / 3,   code:  320000 },
            { name: "1/400",   ev: 2 + 2 / 3,   code:  400000 },
            { name: "1/500",   ev: 3,           code:  500000 },
            { name: "1/640",   ev: 3 + 1 / 3,   code:  640000 },
            { name: "1/800",   ev: 3 + 2 / 3,   code:  800000 },
            { name: "1/1000",  ev: 4,           code:  1000000 },
            { name: "1/1250",  ev: 4 + 1 / 3,   code:  1300000 },
            { name: "1/1600",  ev: 4 + 2 / 3,   code:  1600000 },
            { name: "1/2000",  ev: 5,           code:  2000000 },
            { name: "1/2500",  ev: 5 + 1 / 3,   code:  2500000 },
            { name: "1/3200",  ev: 5 + 2 / 3,   code:  3200000 },
            { name: "1/4000",  ev: 6,           code:  4000000 },
            { name: "1/5000",  ev: 6 + 1 / 3,   code:  5000000 },
            { name: "1/6400",  ev: 6 + 2 / 3,   code:  6400000 },
            { name: "1/8000",  ev: 7,           code:  8000000 },
            { name: "1/10000",  ev: 7 + 1 / 3,  code:  10000000 },
            { name: "1/13000",  ev: 7 + 2 / 3,  code:  13000000 },
            { name: "1/16000",  ev: 8,          code:  16000000 },
        ]
    },
    'aperture': {
        name: 'aperture',
        category: 'exposure',
        setFunction: setProperty,
        getFunction: getProperty,
        listFunction: listProperty,
        code: 0x2000040,
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
        setFunction: setProperty,
        getFunction: getProperty,
        listFunction: listProperty,
        code: 0x2000020,
        ev: true,
        values: [
            { name: "auto",     ev: null,        code: 4294967295 },
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
        setFunction: setProperty,
        getFunction: getProperty,
        listFunction: listProperty,
        code: 0x20000A2,
        filter: {
            by: 'type',
            fn: function(values) { return (values && values.length > 8) ? 1 : 0; }
        },
        ev: false,
        values: [
            { name: "RAW",               value: 'raw',      code: 255 },
            { name: "JPEG Normal",       value: 'jpeg',     code: 255 },
            { name: "JPEG Fine",         value: 'jpeg',     code: 255 },
            { name: "RAW + JPEG Normal", value: 'raw+jpeg', code: 255 },
            { name: "RAW + JPEG Fine",   value: 'raw+jpeg', code: 255 },

        ]
    },
    'destination': {
        name: 'destination',
        category: 'config',
        setFunction: setDestination,
        getFunction: null,
        listFunction: null,
        code: 0,
        ev: false,
        default: 0,
        values: [
            { name: "camera",            code: 0  },
            { name: "VIEW",              code: 1  },
        ]
    },
    //'focusPos': {
    //    name: 'focusPos',
    //    category: 'status',
    //    setFunction: null,
    //    getFunction: null,
    //    listFunction: null,
    //    code: null,
    //    ev: false,
    //    default: 0,
    //},
    //'battery': {
    //    name: 'battery',
    //    category: 'status',
    //    setFunction: null,
    //    getFunction: ptp.getPropU8,
    //    listFunction: null,
    //    code: 0x5001,
    //    ev: false,
    //},
    //'burst': {
    //    name: 'burst',
    //    category: 'config',
    //    setFunction: ptp.setPropU16,
    //    getFunction: ptp.getPropU16,
    //    listFunction: null,
    //    code: 0x5018,
    //    ev: false,
    //},
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
    ////'bracketingCount': {
    ////    name: 'bracketingCount',
    ////    category: 'config',
    ////    setFunction: ptp.setPropU8,
    ////    getFunction: ptp.getPropU8,
    ////    listFunction: ptp.listProp,
    ////    code: 0xD0C3,
    ////    ev: false,
    ////    values: [
    ////        { name: "UNKNOWN",  value: 0, code: 1 },
    ////    ]
    ////},
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
        setFunction: setProperty,
        getFunction: getProperty,
        listFunction: listProperty,
        code: 0x2000070,
        ev: false,
        values: [
            { name: "MF",         value: 'mf',       code: 0xFF },
            { name: "AFC",        value: 'af',       code: 0xFF },
            { name: "AFS/AFF",    value: null,       code: 0xFF },
        ]
    },
}

function propMapped(propCode) {
    for(name in properties) {
        if(properties.hasOwnProperty(name)) {
            if(propCode === properties[name].code) return true;
        }
    }
    return false;
}

function listProperty(_dev, propCode, callback) {
    getProperty(_dev, propCode, function(err, currentValue, valueSize) {
        ptp.transaction(_dev, PTP_OC_PANASONIC_ListProperty, [propCode], null, function(err, responseCode, data) {
            if(err || responseCode != 0x2001 || !data || data.length < 4 + 6 * 4) return callback && callback(err || responseCode);

            var cv = null;
            var list = [];
            var type = 0;

            var headerLength = data.readUInt32LE(4);
            if(data.length < headerLength * 4 + 2 * 4) return callback && callback("incomplete data");
            var propertyCode = data.readUInt32LE(4 + 6 * 4);
            if(valueSize == 1) {
                cv = data.readUInt8(headerLength * 4 + 2 * 4);
            } else if(valueSize == 2) {
                cv = data.readUInt16LE(headerLength * 4 + 2 * 4);
            } else if(valueSize == 4) {
                cv = data.readUInt32LE(headerLength * 4 + 2 * 4);
            } else {
                return callback && callback("invalid data length");
            }
            if(data.length < headerLength * 4 + 2 * 4 + valueSize) return callback && callback("incomplete data");
            var propertyValueListLength = data.readUInt32LE(headerLength * 4 + 2 * 4 + valueSize);
            if(data.length < headerLength * 4 + 3 * 4 + valueSize + (propertyValueListLength) * valueSize) return callback && callback("incomplete data");

            for(var i = 0; i < propertyValueListLength; i++) {
                if(valueSize == 1) {
                    list.push(data.readUInt8(headerLength * 4 + 3 * 4 + valueSize + i * valueSize));
                } else if(valueSize == 2) {
                    list.push(data.readUInt16LE(headerLength * 4 + 3 * 4 + valueSize + i * valueSize));
                } else if(valueSize == 4) {
                    list.push(data.readUInt32LE(headerLength * 4 + 3 * 4 + valueSize + i * valueSize));
                }
            }

            return callback && callback(null, currentValue, list, valueSize, 2);
        });
    });
}

function getProperty(_dev, propCode, callback) {
    ptp.transaction(_dev, PTP_OC_PANASONIC_GetProperty, [propCode], null, function(err, responseCode, data) {
        if(err || responseCode != 0x2001 || !data || data.length < 8) return callback && callback(err || responseCode);

        var valueSize = data.readUInt32LE(4);
        if(data.length < 8 + valueSize) return callback && callback("incomplete data");

        var currentValue = null;
        if(valueSize == 1) {
            currentValue = data.readUInt8(8);
        } else if(valueSize == 2) {
            currentValue = data.readUInt16LE(8);
        } else if(valueSize == 4) {
            currentValue = data.readUInt32LE(8);
        } else {
            return callback && callback("invalid data length");
        }

        callback && callback(null, currentValue, valueSize);
    });
}

function setProperty(_dev, propCode, newValue, valueSize, callback) {
    var buf = new Buffer(8 + valueSize);
    buf.writeUInt32LE(propCode, 0);
    buf.writeUInt32LE(valueSize, 4);
    if(valueSize == 1) {
        buf.writeUInt16LE(newValue, 8);
    } else if(valueSize == 2) {
        buf.writeUInt16LE(newValue, 8);
    } else if(valueSize == 4) {
        buf.writeUInt32LE(newValue, 8);
    }

    ptp.transaction(_dev, PTP_OC_PANASONIC_SetProperty, [propCode], buf, function(err, responseCode) {
        if(err || responseCode != 0x2001) return callback && callback(err || responseCode);
        callback && callback();
    });
}

function setDestination(_dev, propCode, newValue, valueSize, callback) {
    var buf = new Buffer(10);
    buf.writeUInt32LE(0x08000091, 0);
    buf.writeUInt32LE(0x00000002, 4);
    buf.writeUInt16LE(newValue,   8); //  1 == RAM, 0 == SD
    ptp.transaction(_dev, PTP_OC_PANASONIC_SetCaptureTarget, [0x00000000], buf, function(err, responseCode) {
        if(err || responseCode != 0x2001) return callback && callback(err || responseCode);
        callback && callback();
    });
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
        if(event == 0xC108) {
            _logD("object added:", ptp.hex(param1));
            camera._objectsAdded.push(param1);
        } else if(event == 0xC102) {
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
                    properties[param].setFunction(camera._dev, properties[param].code, cameraValue, properties[param].size, function(err) {
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
        function(cb){ // trigger capture
            ptp.transaction(camera._dev, PTP_OC_PANASONIC_InitiateCapture, [0x3000011], null, function(err, responseCode) {
                if(err) {
                    return cb(err);
                } else if(responseCode != 0x2001) {
                    return cb(responseCode);
                } else {
                    return cb();
                }
            });
        },
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
            ptp.transaction(camera._dev, PTP_OC_PANASONIC_Liveview, [0xD000010], null, function(err, responseCode) {
                if(responseCode == 0x2019) {
                    _tries++;
                    if(_tries < 15) {
                        return setTimeout(function(){
                            driver.liveviewMode(camera, enable, callback, _tries);
                        }, 50);
                    }
                }
                if(err || responseCode != 0x2001) {
                    _logD("error enabling liveview:", err, "code:", ptp.hex(responseCode));
                    return callback && callback(err || responseCode);
                }
                camera.status.liveview = true;
                _logD("LV enabled");
                return callback && callback();
            });
        } else {
            ptp.transaction(camera._dev, PTP_OC_PANASONIC_Liveview, [0xD000011], null, function(err, responseCode) {
                if(err || responseCode != 0x2001) return callback && callback(err || responseCode);
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

        ptp.transaction(camera._dev, PTP_OC_PANASONIC_LiveviewImage, [], null, function(err, responseCode, data) {
            if(err) return callback && callback(err);
            if(responseCode != 0x2001 && _tries > 10) return callback && callback(responseCode);
            if(responseCode == 0x2001) {
                var image = ptp.extractJpegSimple(data);
                if(image) {
                    return callback && callback(null, image);
                } else {
                    driver.liveviewImage(camera, callback, _tries + 1);
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
    var dir = 2;
    if(steps < 0) {
        dir = 1;
        steps = 0 - steps;
    }
    if(!steps) return callback && callback(null, camera.status.focusPos);
    if(!resolution) resolution = 1;
    steps *= resolution;


//    var buf = new Buffer(10);
//    buf.writeUInt32LE(0x08000091, 0);
//    buf.writeUInt32LE(0x00000002, 4);
//    buf.writeUInt16LE(newValue,   8); //  1 == RAM, 0 == SD
//    ptp.transaction(_dev, PTP_OC_PANASONIC_SetCaptureTarget, [0x00000000], buf, function(err, responseCode) {
//        if(err || responseCode != 0x2001) return callback && callback(err || responseCode);
//        callback && callback();
//    });



    ptp.transaction(camera._dev, 0x9204, [dir, resolution * 20], null, function(err, responseCode, data) {
        if(err) {
            return callback && callback(err, camera.status.focusPos);
        }
        if(responseCode == 0xA00C) { // reached end
            _logD("focus end reached, not updating pos");
            return callback && callback(err, camera.status.focusPos);
        } else if(responseCode == 0x2001) {
            camera.status.focusPos += (dir == 1) ? -1 : 1;
            steps--;
            if(steps > 0) {
                return setTimeout(function() {
                    driver.moveFocus(camera, steps, resolution, callback);
                }, 10);
            } else {
                return callback && callback(err, camera.status.focusPos);
            }
        } else {
            err = ptp.hex(responseCode);
            _logD("focus error:", err);
            callback && callback(err, camera.status.focusPos);
        }
    });

}


module.exports = driver;
