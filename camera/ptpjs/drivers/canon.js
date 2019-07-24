
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

driver.name = "Canon EOS";

function _logD() {
    if(arguments.length > 0) {
        arguments[0] = "PTP-CANON: " + arguments[0];
    }
    console.log.apply(console, arguments);
}

function _logE() {
    if(arguments.length > 0) {
        arguments[0] = "PTP-CANON: " + arguments[0];
    }
    console.log.apply(console, arguments);
}

function objCopy(sourceObj, destObj) {
    if(!destObj) destObj = {};
    if(!sourceObj) return destObj;
    for(var k in sourceObj) {
        if(sourceObj.hasOwnProperty(k)) destObj[k] = sourceObj[k];
    }
    return destObj;
}

driver.supportsNativeHDR = false;

driver.supportedCameras = {
    '04a9:3145': {name: "Canon EOS 450D",           status: 'unknown', supports: { shutter: true, aperture: true, iso: true, liveview: true, destination: true, focus: true, }, usb: 'Mini-B' },
    '04a9:3145': {name: "Canon EOS Rebel XSi",      status: 'unknown', supports: { shutter: true, aperture: true, iso: true, liveview: true, destination: true, focus: true, }, usb: 'Mini-B' },
    '04a9:3145': {name: "Canon EOS Kiss X2",        status: 'unknown', supports: { shutter: true, aperture: true, iso: true, liveview: true, destination: true, focus: true, }, usb: 'Mini-B' },
    '04a9:3146': {name: "Canon EOS 40D",            status: 'unknown', supports: { shutter: true, aperture: true, iso: true, liveview: true, destination: true, focus: true, }, usb: 'Mini-B' },
    '04a9:317b': {name: "Canon EOS 1000D",          status: 'unknown', supports: { shutter: true, aperture: true, iso: true, liveview: true, destination: true, focus: true, }, usb: 'Mini-B' },
    '04a9:3199': {name: "Canon EOS 5D Mark II",     status: 'unknown', supports: { shutter: true, aperture: true, iso: true, liveview: true, destination: true, focus: true, }, usb: 'Mini-B' },
    '04a9:319a': {name: "Canon EOS 7D",             status: 'tested',  supports: { shutter: true, aperture: true, iso: true, liveview: true, destination: true, focus: true, }, usb: 'Mini-B' },
    '04a9:319b': {name: "Canon EOS 50D",            status: 'unknown', supports: { shutter: true, aperture: true, iso: true, liveview: true, destination: true, focus: true, }, usb: 'Mini-B' },
    '04a9:31cf': {name: "Canon EOS 500D",           status: 'unknown', supports: { shutter: true, aperture: true, iso: true, liveview: true, destination: true, focus: true, }, usb: 'Mini-B' },
    '04a9:31cf': {name: "Canon EOS Rebel T1i",      status: 'unknown', supports: { shutter: true, aperture: true, iso: true, liveview: true, destination: true, focus: true, }, usb: 'Mini-B' },
    '04a9:31cf': {name: "Canon EOS Kiss X3",        status: 'unknown', supports: { shutter: true, aperture: true, iso: true, liveview: true, destination: true, focus: true, }, usb: 'Mini-B' },
    '04a9:31d0': {name: "Canon EOS 1D Mark IV",     status: 'unknown', supports: { shutter: true, aperture: true, iso: true, liveview: true, destination: true, focus: true, }, usb: 'Mini-B' },
    '04a9:31ea': {name: "Canon EOS 550D",           status: 'unknown', supports: { shutter: true, aperture: true, iso: true, liveview: true, destination: true, focus: true, }, usb: 'Mini-B' },
    '04a9:3215': {name: "Canon EOS 60D",            status: 'unknown', supports: { shutter: true, aperture: true, iso: true, liveview: true, destination: true, focus: true, }, usb: 'Mini-B' },
    '04a9:3217': {name: "Canon EOS 1100D",          status: 'unknown', supports: { shutter: true, aperture: true, iso: true, liveview: true, destination: true, focus: true, }, usb: 'Mini-B' },
    '04a9:3217': {name: "Canon Rebel T3",           status: 'unknown', supports: { shutter: true, aperture: true, iso: true, liveview: true, destination: true, focus: true, }, usb: 'Mini-B' },
    '04a9:3218': {name: "Canon EOS 600D",           status: 'unknown', supports: { shutter: true, aperture: true, iso: true, liveview: true, destination: true, focus: true, }, usb: 'Mini-B' },
    '04a9:3218': {name: "Canon Rebel T3i",          status: 'unknown', supports: { shutter: true, aperture: true, iso: true, liveview: true, destination: true, focus: true, }, usb: 'Mini-B' },
    '04a9:3219': {name: "Canon EOS 1D X",           status: 'unknown', supports: { shutter: true, aperture: true, iso: true, liveview: true, destination: true, focus: true, }, usb: 'Mini-B' },
    '04a9:323a': {name: "Canon EOS 5D Mark III",    status: 'unknown', supports: { shutter: true, aperture: true, iso: true, liveview: true, destination: true, focus: true, }, usb: 'Mini-B' },
    '04a9:323b': {name: "Canon EOS 650D",           status: 'unknown', supports: { shutter: true, aperture: true, iso: true, liveview: true, destination: true, focus: true, }, usb: 'Mini-B' },
    '04a9:323b': {name: "Canon Rebel T4i",          status: 'unknown', supports: { shutter: true, aperture: true, iso: true, liveview: true, destination: true, focus: true, }, usb: 'Mini-B' },
    '04a9:3250': {name: "Canon EOS 6D",             status: 'unknown', supports: { shutter: true, aperture: true, iso: true, liveview: true, destination: true, focus: true, }, usb: 'Mini-B' },
    '04a9:3252': {name: "Canon EOS 1D C",           status: 'unknown', supports: { shutter: true, aperture: true, iso: true, liveview: true, destination: true, focus: true, }, usb: 'Mini-B' },
    '04a9:3253': {name: "Canon EOS 70D",            status: 'unknown', supports: { shutter: true, aperture: true, iso: true, liveview: true, destination: true, focus: true, }, usb: 'Mini-B' },
    '04a9:32ca': {name: "Canon EOS 6d Mark II",     status: 'unknown', supports: { shutter: true, aperture: true, iso: true, liveview: true, destination: true, focus: true, }, usb: 'Mini-B' },
    '04a9:326f': {name: "Canon EOS 7D MarkII",      status: 'unknown', supports: { shutter: true, aperture: true, iso: true, liveview: true, destination: true, focus: true, }, usb: 'USB 3.0' },
    '04a9:3270': {name: "Canon EOS 100D",           status: 'unknown', supports: { shutter: true, aperture: true, iso: true, liveview: true, destination: true, focus: true, }, usb: 'Mini-B' },
    '04a9:3272': {name: "Canon EOS 700D",           status: 'unknown', supports: { shutter: true, aperture: true, iso: true, liveview: true, destination: true, focus: true, }, usb: 'Mini-B' },
    '04a9:327f': {name: "Canon EOS 1200D",          status: 'unknown', supports: { shutter: true, aperture: true, iso: true, liveview: true, destination: true, focus: true, }, usb: 'Mini-B' },
    '04a9:3280': {name: "Canon EOS 760D",           status: 'unknown', supports: { shutter: true, aperture: true, iso: true, liveview: true, destination: true, focus: true, }, usb: 'Mini-B' },
    '04a9:3281': {name: "Canon EOS 5D Mark IV",     status: 'unknown', supports: { shutter: true, aperture: true, iso: true, liveview: true, destination: true, focus: true, }, usb: 'USB 3.0' },
    '04a9:32da': {name: "Canon EOS R",              status: 'unknown', supports: { shutter: true, aperture: true, iso: true, liveview: true, destination: true, focus: true, }, usb: 'USB C' },
    '04a9:3292': {name: "Canon EOS 1D X MarkII",    status: 'unknown', supports: { shutter: true, aperture: true, iso: true, liveview: true, destination: true, focus: true, }, usb: 'USB 3.0' },
    '04a9:3294': {name: "Canon EOS 80D",            status: 'unknown', supports: { shutter: true, aperture: true, iso: true, liveview: true, destination: true, focus: true, }, usb: 'Mini-B' },
    '04a9:3295': {name: "Canon EOS 5DS",            status: 'unknown', supports: { shutter: true, aperture: true, iso: true, liveview: true, destination: true, focus: true, }, usb: 'USB 3.0' },
    '04a9:3299': {name: "Canon EOS M3",             status: 'unknown', supports: { shutter: true, aperture: true, iso: true, liveview: true, destination: true, focus: true, }, usb: 'Micro-B' },
    '04a9:32a0': {name: "Canon EOS M10",            status: 'unknown', supports: { shutter: true, aperture: true, iso: true, liveview: true, destination: true, focus: true, }, usb: 'Micro-B' },
    '04a9:32a1': {name: "Canon EOS 750D",           status: 'unknown', supports: { shutter: true, aperture: true, iso: true, liveview: true, destination: true, focus: true, }, usb: 'Mini-B' },
    '04a9:32af': {name: "Canon EOS 5DS R",          status: 'unknown', supports: { shutter: true, aperture: true, iso: true, liveview: true, destination: true, focus: true, }, usb: 'USB 3.0' },
    '04a9:32b4': {name: "Canon EOS 1300D",          status: 'unknown', supports: { shutter: true, aperture: true, iso: true, liveview: true, destination: true, focus: true, }, usb: 'Mini-B' },
    '04a9:32bb': {name: "Canon EOS M5",             status: 'unknown', supports: { shutter: true, aperture: true, iso: true, liveview: true, destination: true, focus: true, }, usb: 'Micro-B' },
    '04a9:32c9': {name: "Canon EOS Rebel T7i",      status: 'unknown', supports: { shutter: true, aperture: true, iso: true, liveview: true, destination: true, focus: true, }, usb: 'Mini-B' },
    '04a9:32cb': {name: "Canon EOS 77D",            status: 'unknown', supports: { shutter: true, aperture: true, iso: true, liveview: true, destination: true, focus: true, }, usb: 'Mini-B' },
    '04a9:32cc': {name: "Canon EOS 200D",           status: 'unknown', supports: { shutter: true, aperture: true, iso: true, liveview: true, destination: true, focus: true, }, usb: 'Mini-B' },
}

var properties = {
    'shutter': {
        name: 'shutter',
        category: 'exposure',
        setFunction: setProperty,
        getFunction: null,
        listFunction: null,
        code: 0xD102,
        typeCode: 6,
        ev: true,
        values: [
            { name: "30s",     ev: -11,         code:  0x0010 },
            { name: "25s",     ev: -10 - 2 / 3, code:  0x0013 },
            { name: "20s",     ev: -10 - 1 / 3, code:  0x0015 },
            { name: "15s",     ev: -10,         code:  0x0018 },
            { name: "13s",     ev: -9 - 2 / 3,  code:  0x001b },
            { name: "10s",     ev: -9 - 1 / 3,  code:  0x001d },
            { name: "8s",      ev: -9,          code:  0x0020 },
            { name: "6s",      ev: -8 - 2 / 3,  code:  0x0023 },
            { name: "5s",      ev: -8 - 1 / 3,  code:  0x0025 },
            { name: "4s",      ev: -8,          code:  0x0028 },
            { name: "3s",      ev: -7 - 2 / 3,  code:  0x002b },
            { name: "2.5s",    ev: -7 - 1 / 3,  code:  0x002d },
            { name: "2s",      ev: -7,          code:  0x0030 },
            { name: "1.6s",    ev: -6 - 2 / 3,  code:  0x0033 },
            { name: "1.3s",    ev: -6 - 1 / 3,  code:  0x0035 },
            { name: "1s",      ev: -6,          code:  0x0038 },
            { name: "0.8s",    ev: -5 - 2 / 3,  code:  0x003b },
            { name: "0.6s",    ev: -5 - 1 / 3,  code:  0x003d },
            { name: "1/2",     ev: -5,          code:  0x0040 },
            { name: "0.4s",    ev: -4 - 2 / 3,  code:  0x0043 },
            { name: "1/3",     ev: -4 - 1 / 3,  code:  0x0045 },
            { name: "1/4",     ev: -4,          code:  0x0048 },
            { name: "1/5",     ev: -3 - 2 / 3,  code:  0x004b },
            { name: "1/6",     ev: -3 - 1 / 3,  code:  0x004d },
            { name: "1/8",     ev: -3,          code:  0x0050 },
            { name: "1/10",    ev: -2 - 2 / 3,  code:  0x0053 },
            { name: "1/13",    ev: -2 - 1 / 3,  code:  0x0055 },
            { name: "1/15",    ev: -2,          code:  0x0058 },
            { name: "1/20",    ev: -1 - 2 / 3,  code:  0x005b },
            { name: "1/25",    ev: -1 - 1 / 3,  code:  0x005d },
            { name: "1/30",    ev: -1,          code:  0x0060 },
            { name: "1/40",    ev: 0 - 2 / 3,   code:  0x0063 },
            { name: "1/50",    ev: 0 - 1 / 3,   code:  0x0065 },
            { name: "1/60",    ev: 0,           code:  0x0068 },
            { name: "1/80",    ev: 0 + 1 / 3,   code:  0x006b },
            { name: "1/100",   ev: 0 + 2 / 3,   code:  0x006d },
            { name: "1/125",   ev: 1,           code:  0x0070 },
            { name: "1/160",   ev: 1 + 1 / 3,   code:  0x0073 },
            { name: "1/200",   ev: 1 + 2 / 3,   code:  0x0075 },
            { name: "1/250",   ev: 2,           code:  0x0078 },
            { name: "1/320",   ev: 2 + 1 / 3,   code:  0x007b },
            { name: "1/400",   ev: 2 + 2 / 3,   code:  0x007d },
            { name: "1/500",   ev: 3,           code:  0x0080 },
            { name: "1/640",   ev: 3 + 1 / 3,   code:  0x0083 },
            { name: "1/800",   ev: 3 + 2 / 3,   code:  0x0085 },
            { name: "1/1000",  ev: 4,           code:  0x0088 },
            { name: "1/1250",  ev: 4 + 1 / 3,   code:  0x008b },
            { name: "1/1600",  ev: 4 + 2 / 3,   code:  0x008d },
            { name: "1/2000",  ev: 5,           code:  0x0090 },
            { name: "1/2500",  ev: 5 + 1 / 3,   code:  0x0093 },
            { name: "1/3200",  ev: 5 + 2 / 3,   code:  0x0095 },
            { name: "1/4000",  ev: 6,           code:  0x0098 },
            { name: "1/5000",  ev: 6 + 1 / 3,   code:  0x009b },
            { name: "1/6400",  ev: 6 + 2 / 3,   code:  0x009d },
            { name: "1/8000",  ev: 7,           code:  0x00a0 }
        ]
    },
    'aperture': {
        name: 'aperture',
        category: 'exposure',
        setFunction: setProperty,
        getFunction: null,
        listFunction: null,
        code: 0xD101,
        typeCode: 4,
        ev: true,
        values: [
            { name: "1.0",      ev: -8,          code: 0x0008  },
            { name: "1.1",      ev: -7 - 2 / 3,  code: 0x000B  },
            { name: "1.2",      ev: -7 - 1 / 3,  code: 0x000d  },
            { name: "1.4",      ev: -7,          code: 0x0010  },
            { name: "1.6",      ev: -6 - 2 / 3,  code: 0x0013  },
            { name: "1.8",      ev: -6 - 1 / 3,  code: 0x0015  },
            { name: "2.0",      ev: -6,          code: 0x0018  },
            { name: "2.2",      ev: -5 - 2 / 3,  code: 0x001b  },
            { name: "2.5",      ev: -5 - 1 / 3,  code: 0x001d  },
            { name: "2.8",      ev: -5,          code: 0x0020  },
            { name: "3.2",      ev: -4 - 2 / 3,  code: 0x0023  },
            { name: "3.5",      ev: -4 - 1 / 3,  code: 0x0025  },
            { name: "4.0",      ev: -4,          code: 0x0028  },
            { name: "4.5",      ev: -3 - 2 / 3,  code: 0x002b  },
            { name: "5.0",      ev: -3 - 1 / 3,  code: 0x002d  },
            { name: "5.6",      ev: -3,          code: 0x0030  },
            { name: "6.3",      ev: -2 - 2 / 3,  code: 0x0033  },
            { name: "7.1",      ev: -2 - 1 / 3,  code: 0x0035  },
            { name: "8",        ev: -2,          code: 0x0038  },
            { name: "9",        ev: -1 - 2 / 3,  code: 0x003b  },
            { name: "10",       ev: -1 - 1 / 3,  code: 0x003d  },
            { name: "11",       ev: -1,          code: 0x0040  },
            { name: "13",       ev: -0 - 2 / 3,  code: 0x0043  },
            { name: "14",       ev: -0 - 1 / 3,  code: 0x0045  },
            { name: "16",       ev:  0,          code: 0x0048  },
            { name: "18",       ev:  0 + 1 / 3,  code: 0x004b  },
            { name: "20",       ev:  0 + 2 / 3,  code: 0x004d  },
            { name: "22",       ev:  1,          code: 0x0050  },
            { name: "25",       ev:  2 + 1 / 3,  code: 0x0053  },
            { name: "29",       ev:  2 + 2 / 3,  code: 0x0055  },
            { name: "32",       ev:  3,          code: 0x0058  },
            { name: "36",       ev:  3 + 1 / 3,  code: 0x005b  },
            { name: "42",       ev:  3 + 2 / 3,  code: 0x005d  },
            { name: "45",       ev:  4,          code: 0x0060  },
            { name: "50",       ev:  4 + 1 / 3,  code: 0x0063  },
            { name: "57",       ev:  4 + 2 / 3,  code: 0x0065  },
            { name: "64",       ev:  5,          code: 0x0068  }
        ]
    },
    'iso': {
        name: 'iso',
        category: 'exposure',
        setFunction: setProperty,
        getFunction: null,
        listFunction: null,
        typeCode: 6,
        code: 0xD103,
        ev: true,
        values: [
            { name: "AUTO",     ev: null,        code: 0x0000   },
            { name: "25",       ev:  2,          code: 0x0038   },
            { name: "32",       ev:  1 + 2 / 3,  code: 0x003b   },
            { name: "40",       ev:  1 + 1 / 3,  code: 0x003d   },
            { name: "50",       ev:  1,          code: 0x0040   },
            { name: "64",       ev:  0 + 2 / 3,  code: 0x0043   },
            { name: "80",       ev:  0 + 1 / 3,  code: 0x0045   },
            { name: "100",      ev:  0,          code: 0x0048   },
            { name: "125",      ev: -0 - 1 / 3,  code: 0x004b   },
            { name: "160",      ev: -0 - 2 / 3,  code: 0x004d   },
            { name: "200",      ev: -1,          code: 0x0050   },
            { name: "250",      ev: -1 - 1 / 3,  code: 0x0053   },
            { name: "320",      ev: -1 - 2 / 3,  code: 0x0055   },
            { name: "400",      ev: -2,          code: 0x0058   },
            { name: "500",      ev: -2 - 1 / 3,  code: 0x005b   },
            { name: "640",      ev: -2 - 2 / 3,  code: 0x005d   },
            { name: "800",      ev: -3,          code: 0x0060   },
            { name: "1000",     ev: -3 - 1 / 3,  code: 0x0063   },
            { name: "1250",     ev: -3 - 2 / 3,  code: 0x0065   },
            { name: "1600",     ev: -4,          code: 0x0068   },
            { name: "2000",     ev: -4 - 1 / 3,  code: 0x006B   },
            { name: "2500",     ev: -4 - 2 / 3,  code: 0x006D   },
            { name: "3200",     ev: -5,          code: 0x0070   },
            { name: "4000",     ev: -5 - 1 / 3,  code: 0x0073   },
            { name: "5000",     ev: -5 - 2 / 3,  code: 0x0075   },
            { name: "6400",     ev: -6,          code: 0x0078   },
            { name: "8000",     ev: -6 - 1 / 3,  code: 0x007B   },
            { name: "10000",    ev: -6 - 2 / 3,  code: 0x007D   },
            { name: "12800",    ev: -7,          code: 0x0080   },
            { name: "16000",    ev: -7 - 1 / 3,  code: 0x0083   },
            { name: "20000",    ev: -7 - 2 / 3,  code: 0x0085   },
            { name: "25600",    ev: -8,          code: 0x0088   },
            { name: "32000",    ev: -8 - 1 / 3,  code: 0x008B   },
            { name: "40000",    ev: -8 - 2 / 3,  code: 0x008D   },
            { name: "51200",    ev: -9,          code: 0x0090   },
            { name: "64000",    ev: -9 - 1 / 3,  code: 0x0093   },
            { name: "80000",    ev: -9 - 2 / 3,  code: 0x0095   },
            { name: "102400",   ev: -10,         code: 0x0098   },
            { name: "128000",   ev: -10 - 1 / 3, code: 0x009B   },
            { name: "160000",   ev: -10 - 2 / 3, code: 0x009D   },
            { name: "204800",   ev: -11,         code: 0x00A0   },
            //{ name: "256000",   ev: -11 - 1 / 3, code: 256000 },
            //{ name: "320000",   ev: -11 - 2 / 3, code: 320000 },
            //{ name: "409600",   ev: -12,         code: 409600 }
        ]
    },
    'format': {
        name: 'format',
        category: 'config',
        setFunction: setFormat,
        getFunction: null,
        listFunction: null,
        code: 0xD120,
        typeCode: 6,
        valueParser: parseFormatValue,
        listParser: parseFormatList,
        ev: false,
        values: [
            { name: "--",                   value: null,        code: 0x01  },
            { name: "JPEG Large Fine",      value: null,        code: 0x02  },
            { name: "JPEG Large",           value: null,        code: 0x03  },
            { name: "JPEG Medium Fine",     value: null,        code: 0x04  },
            { name: "JPEG Medium",          value: null,        code: 0x05  },
            { name: "JPEG Small Fine",      value: null,        code: 0x06  },
            { name: "JPEG Small",           value: null,        code: 0x07  },
        ]
    },
    'framesRemaining': {
        name: 'framesRemaining',
        category: 'status',
        setFunction: null,
        getFunction: null,
        listFunction: null,
        code: 0xD11B,
        typeCode: 2,
        ev: false,
        values: null
    },
    'destination': {
        name: 'destination',
        category: 'config',
        setFunction: ptp.setPropU16,
        getFunction: dummyGet,
        listFunction: null,
        code: 0xD029,
        ev: false,
        default: 13,
        values: [
            { name: "camera",            code: 13  },
            { name: "VIEW",              code: 3  },
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
        getFunction: null,
        listFunction: null,
        code: 0x5001,
        ev: false,
    },
    'evf': {
        name: 'evf',
        category: 'status',
        setFunction: setProperty,
        getFunction: null,
        listFunction: null,
        code: 0xD1B1,
        values: [
            { name: "disabled",    value: "off",        code: 0  },
            { name: "enabled",     value: "on",         code: 1  },
        ],
        ev: false,
    },
    'evfout': {
        name: 'evfout',
        category: 'status',
        setFunction: setProperty,
        getFunction: null,
        listFunction: null,
        code: 0xD1B0,
        values: [
            { name: "Unknown",   value: "tft",         code: 0  },
            { name: "TFT",       value: null,          code: 1  },
            { name: "PC",        value: "pc",          code: 2  },
            { name: "Off",       value: null,          code: 3  },
        ],
        ev: false,
    },
}

driver.properties = properties;

driver._error = function(camera, error) { // events received
    _logD("ERROR:", error);
};


driver._event = function(camera, data) { // events received
    _logD("EVENT:", data);
    //ptp.parseEvent(data, function(type, event, param1, param2, param3) {
    //});
};

var EOS_EC_PROPERTY_CHANGE = 0xC189;
var EOS_EC_PROPERTY_VALUES = 0xC18A;
var EOS_EC_OBJECT_CREATED = 0xC181;
var EOS_EC_WillShutdownSoon = 0xC18D;

var EOS_DPC_APERTURE = 0xD101;
var EOS_DPC_SHUTTER = 0xD102;
var EOS_DPC_ISO = 0xD103;
var EOS_DPC_MODE = 0xD105;
var EOS_DPC_AFMode = 0xD108;
var EOS_DPC_LiveView = 0xD1B0;
var EOS_DPC_VideoMode = 0xD1C2;
var EOS_DPC_LiveViewShow = 0xD1B3;
var EOS_DPC_Video = 0xD1B8;
//4=video start record
//3=live view show / stop record
//0=video stop / live view stop showing
var EOS_DPC_PhotosRemaining = 0xD11B;

function hexByte(b) {
    if(!b) b = 0;
    b &= 0xFF;
    var s = b.toString(16);
    if(s.length < 2) s = '0' + s;
    return s;
}

function parseFormatValue(data, offset) {
    var value = '';
    if(data && data.length > 4 * 5) {
        for(var i = 0; i < 5; i++) {
            value += hexByte(data.readUInt32LE(offset + i * 4));
        }
    }
    return value;
}

function parseFormatList(cameraList) {
    if(!cameraList) return [];
    var newList = [];
    for(var i = 0; i < cameraList.length; i += 5) {
        if(cameraList.length - i - 5 < 0) break;
        newList = hexByte(cameraList[i + 0]) + hexByte(cameraList[i + 1]) + hexByte(cameraList[i + 2]) + hexByte(cameraList[i + 3]) + hexByte(cameraList[i + 4]);
    }
    return newList;
}

function dummyGet(camera, propcode, callback) {
    for(var key in properties) {
        if(properties[key].code == propcode) {
            if(camera[properties[key].category] && camera[properties[key].category][key]) {
                if(camera[properties[key].category][key].code) {
                    return callback && callback(null, camera[properties[key].category][key].code);
                } else {
                    return callback && callback(null, camera[properties[key].category][key]);
                }
            } else {
                if(properties[key].default == null) {
                    return callback && callback("no default set", null);
                } else {
                    return callback && callback(null, properties[key].default);
                }
            }
        }
    }
    return callback && callback("no parameter found", null);
}

driver.refresh = function(camera, callback, noEvent) {
    var keys = [];
    for(var key in properties) {
        keys.push(key);
    }
    var lvMode = camera.status.liveview;
    async.series([
        function(cb){
            var fetchNextProperty = function() {
                var key = keys.pop();
                if(!key) return cb();
                if(properties[key].listFunction) {
                    properties[key].listFunction(camera._dev, properties[key].code, function(err, current, list, type) {
                        if(err) {
                            _logE("failed to list", key, ", err:", ptp.hex(err));
                        } else {
                            _logD(key, "type is", type);
                            if(!camera[properties[key].category]) camera[properties[key].category] = {};
                            if(!camera[properties[key].category][key]) camera[properties[key].category][key] = {};
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
                        fetchNextProperty();
                    });
                } else if(properties[key].getFunction) {
                    properties[key].getFunction(camera._dev, properties[key].code, function(err, current) {
                        if(err) {
                            _logE("failed to get", key, ", err:", ptp.hex(err));
                        } else {
                            if(!camera[properties[key].category]) camera[properties[key].category] = {};
                            if(!camera[properties[key].category][key]) camera[properties[key].category][key] = {};
                            if(properties[key].values) {
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
                                for(var i = 0; i < properties[key].values.length; i++) {
                                    var mappedItem = {
                                        name: properties[key].values[i].name,
                                        code: properties[key].values[i].code,
                                        value: properties[key].values[i].value || properties[key].values[i].name
                                    }
                                    mappedList.push(mappedItem);
                                }
                                camera[properties[key].category][key].list = mappedList;
                            } else {
                                camera[properties[key].category][key] = value;
                                _logD(key, "=", value);
                            }
                        }
                        fetchNextProperty();
                    });
                } else {
                    fetchNextProperty();
                }
            }
            fetchNextProperty();
        },
        function(cb){
            pollEvents(camera, cb);
        },
    ], function(err) {
        if(!noEvent) exposureEvent(camera);
        return callback && callback(err);
    });
}

function pollEvents(camera, callback) {
    ptp.transaction(camera._dev, 0x9116, [], null, function(err, responseCode, data) {
        if(!data || err) return callback && callback(err);
        var i = 0;

        while(i < data.length)
        {
            if(i + 8 > data.length)
            {
                _logE("incomplete data for event parsing: length =", data.length, " i =", i, "response code:", ptp.hex(responseCode));
                return callback && callback("incomplete data for event parsing");
            }
            var event_size = data.readUInt32LE(i);
            if(event_size == 0)
            {
                _logE("zero-length event");
                return callback && callback("incomplete data for event parsing");
            }

            var event_type = data.readUInt32LE(i + 4 * 1);

            if(i + 4 * 4 > data.length) {
                return callback && callback();
            }

            var event_item = data.readUInt32LE(i + 4 * 2);
            var event_value = data.readUInt32LE(i + 4 * 3);


            //_logD("event", ptp.hex(event_type), "size", ptp.hex(event_size), "code", ptp.hex(event_item), "value", ptp.hex(event_value));

            if(event_type == EOS_EC_PROPERTY_CHANGE)
            {
                var found = false;
                for(var param in properties) {
                    if(properties[param].code == event_item) {
                        if(properties[param].valueParser) {
                            event_value = properties[param].valueParser(data, i + 4 * 3);
                        }
                        if(!camera[properties[param].category]) camera[properties[param].category] = {};
                        var newItem = {};
                        if(properties[param].values) {
                            var newItem = mapPropertyItem(event_value, properties[param].values);
                            if(!newItem) {
                                _logE(param, "current value", ptp.hex(event_value), "not found");
                                break;
                            }
                        } else {
                            newItem = {
                                name: event_value.toString(),
                                value: event_value
                            }
                        }
                        if(!camera[properties[param].category][param]) {
                            newItem.list = [];
                            camera[properties[param].category][param] = {};
                        }
                        for(var k in newItem) {
                            if(newItem.hasOwnProperty(k)) camera[properties[param].category][param][k] = newItem[k];
                        }
                        _logD(param, "=", newItem.name);
                        found = true;
                        break;
                    }
                }
                if(!found) {
                    _logD("unknown event change", ptp.hex(event_item), " = ", ptp.hex(event_value));
                }
            }
            else if(event_type == EOS_EC_PROPERTY_VALUES)
            {
                var x;
                var found = false;
                for(var param in properties) {
                    if(properties[param].code == event_item) {
                        if(!camera[properties[param].category]) camera[properties[param].category] = {};
                        if(!camera[properties[param].category][param]) {
                            camera[properties[param].category][param] = {
                                name: param,
                                value: null,
                                ev: null,
                                list: []
                            }
                        }
                        camera[properties[param].category][param].list = [];
                        for(x = 0; x < event_size / 4 - 5; x++)
                        {
                            var cameraValue = data.readUInt32LE(i + (x + 5) * 4);
                            var newItem = mapPropertyItem(cameraValue, properties[param].values);
                            if(!newItem) {
                                _logE(param, "list item", ptp.hex(cameraValue), "not found");
                            } else {
                                camera[properties[param].category][param].list.push(newItem);
                            }
                        }
                        if(properties[param].listParser) camera[properties[param].category][param].list = properties[param].listParser(camera[properties[param].category][param].list);
                        found = true;
                        break;
                    }
                }
                if(!found) {
                    _logD("unknown event list", ptp.hex(event_item));
                }
            }
            else if(event_type == EOS_EC_OBJECT_CREATED)
            {
                camera._busy = false;
                var newObject = data.readUInt32LE(i + 4 * 2);
                camera._objectsAdded.push(newObject);
                _logD("object added:", ptp.hex(newObject));
            }
            else if(event_type == EOS_EC_WillShutdownSoon)
            {
                //DEBUG(PSTR("Keeping camera on\r\n"));
                //PTP_Transaction(EOS_OC_KeepDeviceOn, 0, 0, NULL);
            }
            else if(event_type > 0)
            {
                //DEBUG(PSTR("\r\n Unknown: "));
                //sendHex((char *)&event_type);
                //DEBUG(PSTR("\r\n    Size: "));
                //DEBUG(event_size);
                //DEBUG_NL();
                //DEBUG(PSTR("\r\n  Value1: "));
                //sendHex((char *)&event_value);
                //DEBUG(PSTR("\r\n  Value2: "));
                //sendHex((char *)(&event_value+4));
                //DEBUG(PSTR("\r\n  Value3: "));
                //sendHex((char *)(&event_value+8));
            }
            i += event_size;
        }

        //series = [];
        //for(var param in properties) {
        //    if(properties[param].listFunction) {
        //        series.push(function(cb){
        //            properties[param].listFunction();
        //        });
        //    } else if(properties[param].getFunction) {
//
        //    }
        //}

        callback && callback();
    });
}

driver.init = function(camera, callback) {
    camera.supportsNativeHDR = driver.supportsNativeHDR;
    camera._objectsAdded = [];
    ptp.init(camera._dev, function(err, di) {
        async.series([
            function(cb){ptp.transaction(camera._dev, 0x9114, [1], null, cb);},   // pc mode
            function(cb){ptp.transaction(camera._dev, 0x9115, [1], null, cb);},  // event mode
            function(cb){setTimeout(cb, 500);},          // wait
            function(cb){driver.refresh(camera, cb);},  // get settings
            function(cb){driver.refresh(camera, cb);}  // get settings
        ], function(err) {
            var setupPoll = function() {
                setTimeout(function() {
                    if(camera && camera._dev && camera._dev.connected) {
                        if(camera.busy) {
                            setupPoll();
                        } else {
                            pollEvents(camera, setupPoll);
                        }
                    }
                }, 1000);
            }
            setupPoll();
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

function setProperty(_dev, propcode, value, callback) {
    var size = 12;
    var buf = new Buffer(size);
    buf.writeUInt32LE(size, 0);
    buf.writeUInt32LE(propcode, 4);
    buf.writeUInt32LE(value, 8);
    return ptp.transaction(_dev, 0x9110, [], buf, callback);
}
function equalEv(ev1, ev2) {
    if(ev1 == null || ev2 == null) {
        return ev1 == ev2;
    }
    return Math.abs(ev1 - ev2) < 0.15;
}
driver.set = function(camera, param, value, callback, tries) {
    if(!tries) tries = 0;
    tries++;
    async.series([
        function(cb){
            if(properties[param] && properties[param].setFunction) {
                var cameraValue = null;
                var currentValueCode = camera[properties[param].category][param].code;
                var currentIndex = null;
                var targetIndex = null;
                for(var i = 0; i < properties[param].values.length; i++) {
                    if(properties[param].values[i].code == currentValueCode) {
                        currentIndex = i;
                        break;
                    }
                }
                if(properties[param].ev && typeof value == "number") {
                    for(var i = 0; i < properties[param].values.length; i++) {
                        if(equalEv(properties[param].values[i].ev, value)) {
                            cameraValue = properties[param].values[i].code;
                            targetIndex = i;
                            break;
                        }
                    }
                } else {
                    for(var i = 0; i < properties[param].values.length; i++) {
                        if(properties[param].values[i].value == value || properties[param].values[i].name == value) {
                            cameraValue = properties[param].values[i].code;
                            targetIndex = i;
                            break;
                        }
                    }
                }
                if(cameraValue !== null && currentIndex !== null && targetIndex !== null) {
                    if(!properties[param].setFunction) return cb("unable to write");
                    _logD("setting", ptp.hex(properties[param].code), "to", cameraValue);
                    properties[param].setFunction(camera._dev, properties[param].code, cameraValue, function(err) {
                        if(!err) {
                            var newItem =  mapPropertyItem(cameraValue, properties[param].values);
                            for(var k in newItem) {
                                if(newItem.hasOwnProperty(k)) camera[properties[param].category][param][k] = newItem[k];
                            }
                            return cb(err);
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
    var get = function() {
        if(properties[param] && camera[properties[param].category][param]) {
            return callback && callback(null, camera[properties[param].category][param]);
        } else {
            return callback && callback("unknown param", null);
        }
    }

    if(camera._eventTimer) {
        clearTimeout(camera._eventTimer);
        camera._eventTimer = null;
        driver.refresh(camera, function() {
            get();
        });
        return true; // updating
    } else {
        get();
        return false; // not updated
    }

}

function exposureEvent(camera) {
    if(!camera._expCache) camera._expCache = {};
    var update = false;
    for(var k in camera.exposure) {
        if((camera.exposure[k] && camera.exposure[k].ev) != camera._expCache[k]) {
           camera._expCache[k] = camera.exposure[k] && camera.exposure[k].ev;
           update = true; 
        }
    }
    if(update) {
        driver.emit('settings', camera);
    }
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
        driver.refresh(camera, function(err) { // check events
            if(camera._objectsAdded.length == 0) {
                return setTimeout(check, 50);
            }
            //console.log("data:", data);
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
                        if(err) {
                            _logE("error fetching thumbnail:", ptp.hex(err));
                        }
                        //fs.writeFile("thm.jpg", jpeg);
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
                        if(err) {
                            _logE("error fetching image:", ptp.hex(err));
                        }
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
        });
    }
    check();
}


driver.capture = function(camera, target, options, callback, tries) {
    var targetValue = (!target || target == "camera") ? 2 : 4;
    camera.thumbnail = true;
    var thumb = null;
    var filename = null;
    var rawImage = null;
    camera.busy = true;
    async.series([
        function(cb){ptp.transaction(camera._dev, 0x910F, [], null, cb);},
        function(cb){
            getImage(camera, 60000, function(err, results) {
                thumb = results.thumb;
                filename = results.filename;
                rawImage = results.rawImage;
                cb(err);
            });
        },
    ], function(err) {
        camera.busy = false;
        callback && callback(err, thumb, filename, rawImage);
    });
}

driver.captureHDR = function(camera, target, options, frames, stops, darkerOnly, callback) {

}

driver.liveviewMode = function(camera, enable, callback) {
    if(camera.status.liveview != enable) {
        async.series([
            function(cb){
                driver.set(camera, "evf", enable ? "on" : "off", function(err) {
                    cb(err);
                });
            },
            function(cb){
                driver.set(camera, "evfout", enable ? "pc" : "tft", function(err) {
                    cb(err);
                });
            },
        ], function(err) {
            if(!err) {
                camera.status.liveview = !!enable;
            }
            callback && callback(err);
        });
    } else {
        callback && callback();
    }
}

driver.liveviewImage = function(camera, callback, _tries) {
    if(!_tries) _tries = 0;
    if(camera.status.liveview) {
        ptp.transaction(camera._dev, 0x9153, [0x00100000], null, function(err, responseCode, data) {
            if(!err && data) {
                var index = 0;
                while (index < data.length) {
                    var len  = data.readUInt32LE(index);
                    var type = data.readUInt32LE(index + 4);

                    switch (type) {
                    default:
                        if (len > (data.length-index)) {
                            len = data.length;
                            _logE("len =", len, "larger than rest data.length", (data.length - index));
                        }
                        index += len;
                        continue;
                    case 9:
                    case 1:
                    case 11:
                        if (len > (data.length-index)) {
                            len = data.length;
                            _logE("len =", len, "larger than rest data.length", (data.length - index));
                            break;
                        }
                        var image = new Buffer(len-8);
                        data.copy(image, 0, index+8, index+8 + len-8);
                        return callback && callback(err, image);
                    }
                }
                if(_tries < 30) {
                    setTimeout(function() {
                        driver.liveviewImage(camera, callback, _tries + 1);
                    }, 100);
                } else {
                    callback && callback("timeout (2)", err ? ptp.hex(err) : "");
                }

            } else if((responseCode == 0x2019 || responseCode == 0xA102 || (!err && !data)) && _tries < 30) {
                setTimeout(function() {
                    driver.liveviewImage(camera, callback, _tries + 1);
                }, 100);
            } else {
                callback && callback(err || "timeout (1)", err ? ptp.hex(err) : "");
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
    if(resolution > 3) resolution = 3;
    if(resolution < 1) resolution = 1;
    steps = Math.abs(steps);

    var param1 = resolution;
    if(dir < 0) param1 |= 0x8000;

    var doStep = function() {
        ptp.transaction(camera._dev, 0x9155, [param1], null, function(err, responseCode) {
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


module.exports = driver;
