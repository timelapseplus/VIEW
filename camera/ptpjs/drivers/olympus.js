
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
            { name: "bulb",    ev: null,        code:  4294967295 },
            { name: "---",     ev: null,        code:  4294967293 },
            { name: "30s",     ev: -11,         code:  300000 },
            { name: "25s",     ev: -10 - 2 / 3, code:  250000 },
            { name: "20s",     ev: -10 - 1 / 3, code:  200000 },
            { name: "15s",     ev: -10,         code:  150000 },
            { name: "13s",     ev: -9 - 2 / 3,  code:  130000 },
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
            { name: "1/8000",  ev: 7,           code:  1 },
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
            { name: "3.5",      ev: -4 - 1 / 3,  code: 350  },
            { name: "3.6",      ev: -4 - 1 / 3,  code: 360  },
            { name: "4.0",      ev: -4,          code: 400  },
            { name: "4.5",      ev: -3 - 2 / 3,  code: 450  },
            { name: "5.0",      ev: -3 - 1 / 3,  code: 500  },
            { name: "5.6",      ev: -3,          code: 560  },
            { name: "6.3",      ev: -2 - 2 / 3,  code: 630  },
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
        code: 0x5007,
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
        code: 0x5004,
        filter: {
            by: 'type',
            fn: function(values) { return (values && values.length > 8) ? 1 : 0; }
        },
        ev: false,
        values: [
            { name: "RAW",               value: 'raw',      code: 4 , type: 0 },
            { name: "JPEG Normal",       value: 'jpeg',     code: 1 , type: 0 },
            { name: "JPEG Fine",         value: 'jpeg',     code: 2 , type: 0 },
            { name: "JPEG Basic",        value: 'jpeg',     code: 0 , type: 0 },
            { name: "RAW + JPEG Fine",   value: 'raw+jpeg', code: 7 , type: 0 },

            { name: "JPEG Basic",        value: 'jpeg',     code: 0 , type: 1 },
            { name: "JPEG Basic*",       value: 'jpeg',     code: 1 , type: 1 },
            { name: "JPEG Normal",       value: 'jpeg',     code: 2 , type: 1 },
            { name: "JPEG Normal*",      value: 'jpeg',     code: 3 , type: 1 },
            { name: "JPEG Fine",         value: 'jpeg',     code: 4 , type: 1 },
            { name: "JPEG Fine*",        value: 'jpeg',     code: 5 , type: 1 },
            { name: "TIFF",              value: 'tiff',     code: 6 , type: 1 },
            { name: "RAW",               value: 'raw',      code: 7 , type: 1 },
            { name: "RAW + JPEG Basic",  value: 'raw+jpeg', code: 8 , type: 1 },
            { name: "RAW + JPEG Basic*", value: 'raw+jpeg', code: 9 , type: 1 },
            { name: "RAW + JPEG Norm",   value: 'raw+jpeg', code: 10, type: 1 },
            { name: "RAW + JPEG Norm*",  value: 'raw+jpeg', code: 11, type: 1 },
            { name: "RAW + JPEG Fine",   value: 'raw+jpeg', code: 12, type: 1 },
            { name: "RAW + JPEG Fine*",  value: 'raw+jpeg', code: 13, type: 1 },
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
    'bracketing': {
        name: 'bracketing',
        category: 'config',
        setFunction: ptp.setPropU8,
        getFunction: ptp.getPropU8,
        listFunction: ptp.listProp,
        code: 0xD0C0,
        ev: false,
        values: [
            { name: "disabled",  value: 0, code: 0 },
            { name: "enabled",   value: 1, code: 1 },
        ]
    },
    'bracketingStops': {
        name: 'bracketingStops',
        category: 'config',
        setFunction: ptp.setPropU8,
        getFunction: ptp.getPropU8,
        listFunction: ptp.listProp,
        code: 0xD0C1,
        ev: false,
        values: [
            { name: "1/3 stop",  value: 1/3, code: 0 },
            { name: "2/3 stop",  value: 2/3, code: 1 },
            { name: "1 stop",    value: 1,   code: 2 },
            { name: "2 stop",    value: 2,   code: 3 },
            { name: "3 stop",    value: 3,   code: 4 },
        ]
    },
    'bracketingProgram': {
        name: 'bracketingProgram',
        category: 'config',
        setFunction: ptp.setPropU8,
        getFunction: ptp.getPropU8,
        listFunction: ptp.listProp,
        code: 0xD0C2,
        ev: false,
        values: [
            { name: "2, minus side",  value: -2,   code: 0 },
            { name: "2, plus side",   value: 2,    code: 1 },
            { name: "3, minus side",  value: -3,   code: 2 },
            { name: "3, plus side",   value: null, code: 3 },
            { name: "3, both sides",  value: 3,    code: 4 },
            { name: "5, both sides",  value: 5,    code: 5 },
            { name: "7, both sides",  value: 7,    code: 6 },
            { name: "9, both sides",  value: 9,    code: 7 },
        ]
    },
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
    'bracketingOrder': {
        name: 'bracketingOrder',
        category: 'config',
        setFunction: ptp.setPropU8,
        getFunction: ptp.getPropU8,
        listFunction: ptp.listProp,
        code: 0xD07A,
        ev: false,
        values: [
            { name: "Center first",  value: 'center', code: 0 },
            { name: "Under first",   value: 'under',  code: 1 },
        ]
    },
    'bracketingParams': {
        name: 'bracketingParams',
        category: 'config',
        setFunction: ptp.setPropU8,
        getFunction: ptp.getPropU8,
        listFunction: ptp.listProp,
        code: 0xD079,
        ev: false,
        values: [
            { name: "Shutter",            value: 's',   code: 0 },
            { name: "Shutter/Aperture",   value: 's+a', code: 1 },
            { name: "Aperture",           value: 'a',   code: 2 },
            { name: "Flash only",         value: 'f',   code: 3 },
        ]
    },
    'bracketingMode': {
        name: 'bracketingMode',
        category: 'config',
        setFunction: ptp.setPropU8,
        getFunction: ptp.getPropU8,
        listFunction: ptp.listProp,
        code: 0xD078,
        ev: false,
        values: [
            { name: "AE & Flash",         value: 'flash',   code: 0 },
            { name: "AE only",            value: 'default', code: 1 },
            { name: "Flash only",         value: null,      code: 2 },
            { name: "ADL Bracketing",     value: null,      code: 3 },
        ]
    },
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
}

driver.properties = properties;

function propMapped(propCode) {
    for(name in properties) {
        if(properties.hasOwnProperty(name)) {
            if(propCode === (properties[name].code & 0xFFFFFFF0)) return true;
        }
    }
    return false;
}

function listProperty(_dev, propCode, callback) {
    getProperty(_dev, propCode, function(err, currentValue, valueSize) {
        if(err) console.log(ptp.hex(propCode), "propcode get error", ptp.hex(err));
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
                cv = new Buffer(valueSize);
                data.copy(cv, 0, headerLength * 4 + 2 * 4, headerLength * 4 + 2 * 4 + valueSize);
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
                } else {
                    var buf = new Buffer(valueSize);
                    data.copy(buf, 0, headerLength * 4 + 3 * 4 + valueSize + i * valueSize, headerLength * 4 + 3 * 4 + valueSize + i * valueSize + valueSize)
                    list.push(buf);
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
            currentValue = new Buffer(valueSize);
            data.copy(currentValue, 0, 8, 8 + valueSize);
        }

        callback && callback(null, currentValue, valueSize);
    });
}

function setProperty(_dev, propCode, newValue, valueSize, callback) {
    var buf = new Buffer(8 + valueSize);
    buf.writeUInt32LE(propCode+1, 0);
    buf.writeUInt32LE(valueSize, 4);
    if(valueSize == 1) {
        buf.writeUInt8(newValue, 8);
    } else if(valueSize == 2) {
        buf.writeUInt16LE(newValue, 8);
    } else if(valueSize == 4) {
        buf.writeUInt32LE(newValue, 8);
    }

    ptp.transaction(_dev, PTP_OC_PANASONIC_SetProperty, [propCode+1], buf, function(err, responseCode) {
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

function parseFocusPoint(data) {
    if(!data || data.length < 10) return data;
    return {
        x: data.readInt16LE(0) / 1000,
        y: data.readInt16LE(2) / 1000,
        s: data.readUInt16LE(4) / 1000,
        mode: data.readUInt16LE(8),
        _buf: data
    }
}

function setFocusPoint(_dev, propCode, newValue, valueSize, callback) {
    if(!newValue || !newValue._buf) return callback && callback("value must be read first");

    var buf = new Buffer(12);
    buf.writeUInt32LE(0x03000053, 0);
    buf.writeUInt32LE(0x00000004, 4);
    buf.writeUInt16LE(Math.round(newValue.x * 1000), 8);
    buf.writeUInt16LE(Math.round(newValue.y * 1000), 10);

    ptp.transaction(_dev, PTP_OC_PANASONIC_ManualFocusDrive, [0x03000053], buf, callback);
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
                    properties[param].setFunction(camera._dev, properties[param].code, cameraValue, properties[param].size, function(err) {
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
    if(!steps) return callback && callback();

    var dir = steps < 0 ? -1 : 1;
    resolution = Math.round(Math.abs(resolution));
    if(resolution > 2) resolution = 2;
    if(resolution < 1) resolution = 1;
    steps = Math.abs(steps);

    if(dir < 0) {
        if(resolution == 1) {
            mode = 0x02;
        } else {
            mode = 0x01;
        }
    } else {
        if(resolution == 1) {
            mode = 0x03;
        } else {
            mode = 0x04;
        }
    }

    var buf = new Buffer(10);
    buf.writeUInt32LE(0x03010011, 0);
    buf.writeUInt32LE(0x00000002, 4);
    buf.writeUInt16LE(mode,       8);

    var doStep = function() {
        ptp.transaction(camera._dev, PTP_OC_PANASONIC_ManualFocusDrive, [0x03010011], buf, function(err, responseCode) {
            if(err) return callback && callback(err);
            steps--;
            camera.status.focusPos += dir;
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

    ptp.transaction(camera._dev, PTP_OC_PANASONIC_ManualFocusDrive, [0x03000055], buf, callback);
}



module.exports = driver;
