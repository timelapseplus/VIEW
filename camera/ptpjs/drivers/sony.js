
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

driver.name = "Sony Alpha";

function _logD() {
    if(arguments.length > 0) {
        arguments[0] = "PTP-SONY: " + arguments[0];
    }
    console.log.apply(console, arguments);
}

function _logE() {
    if(arguments.length > 0) {
        arguments[0] = "PTP-SONY: " + arguments[0];
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
    '054c:02e7': { name: "Sony DSC-A900", supports: { shutter: true, aperture: true, iso: true, liveview: false, destination: false, focus: false, _bufTime: 3500, newISO: false } },
    '054c:0737': { name: "Sony A58",      supports: { shutter: true, aperture: true, iso: true, liveview: false, destination: false, focus: false, _bufTime: 3500, newISO: false } },
    '054c:079c': { name: "Sony A6300",    supports: { shutter: true, aperture: true, iso: true, liveview: true,  destination: false, focus: false, _bufTime: 3500, newISO: false } },
    '054c:079d': { name: "Sony RX10 III", supports: { shutter: true, aperture: true, iso: true, liveview: true,  destination: false, focus: false, _bufTime: 3500, newISO: false } },
    '054c:079e': { name: "Sony A99 II",   supports: { shutter: true, aperture: true, iso: true, liveview: true,  destination: false, focus: false, _bufTime: 3500, newISO: false } },
    '054c:07a3': { name: "Sony RX100 V",  supports: { shutter: true, aperture: true, iso: true, liveview: false, destination: false, focus: false, _bufTime: 3500, newISO: false } },
    '054c:07a4': { name: "Sony A6500",    supports: { shutter: true, aperture: true, iso: true, liveview: true,  destination: true,  focus: true,  _bufTime: 3000, newISO: false } },
    '054c:07c6': { name: "Sony A5000",    supports: { shutter: true, aperture: true, iso: true, liveview: false, destination: false, focus: false, _bufTime: 3500, newISO: false } },
    '054c:094c': { name: "Sony A7",       supports: { shutter: true, aperture: true, iso: true, liveview: false, destination: false, focus: false, _bufTime: 3500, newISO: false } },
    '054c:094d': { name: "Sony A7R",      supports: { shutter: true, aperture: true, iso: true, liveview: false, destination: false, focus: false, _bufTime: 4500, newISO: false } }, 
    '054c:094e': { name: "Sony A6000",    supports: { shutter: true, aperture: true, iso: true, liveview: false, destination: false, focus: false, _bufTime: 3500, newISO: false } },
    '054c:0953': { name: "Sony A77 II",   supports: { shutter: true, aperture: true, iso: true, liveview: true,  destination: false, focus: false, _bufTime: 3500, newISO: false } },
    '054c:0954': { name: "Sony A7S",      supports: { shutter: true, aperture: true, iso: true, liveview: false, destination: false, focus: false, _bufTime: 3500, newISO: false } },
    '054c:0957': { name: "Sony A5100",    supports: { shutter: true, aperture: true, iso: true, liveview: true,  destination: false, focus: false, _bufTime: 3500, newISO: false } },
    '054c:0a6a': { name: "Sony A7 II",    supports: { shutter: true, aperture: true, iso: true, liveview: true,  destination: false, focus: false, _bufTime: 3500, newISO: false } },
    '054c:0a6b': { name: "Sony A7R II",   supports: { shutter: true, aperture: true, iso: true, liveview: true,  destination: false, focus: false, _bufTime: 4500, newISO: false } },
    '054c:0a71': { name: "Sony A7S II",   supports: { shutter: true, aperture: true, iso: true, liveview: true,  destination: false, focus: false, _bufTime: 3500, newISO: false } },
    '054c:0c2a': { name: "Sony A9",       supports: { shutter: true, aperture: true, iso: true, liveview: true,  destination: true,  focus: true,  _bufTime: 2500, newISO: false } },
    '054c:0c33': { name: "Sony A7R III",  supports: { shutter: true, aperture: true, iso: true, liveview: true,  destination: true,  focus: true,  _bufTime: 2500, newISO: false } },
    '054c:0c34': { name: "Sony A7 III",   supports: { shutter: true, aperture: true, iso: true, liveview: true,  destination: true,  focus: true,  _bufTime: 2500, newISO: false } },
    '054c:0caa': { name: "Sony A6400",    supports: { shutter: true, aperture: true, iso: true, liveview: true,  destination: true,  focus: true,  _bufTime: 3000, newISO: false } },
    '054c:0ccc': { name: "Sony A7R IV",   supports: { shutter: true, aperture: true, iso: true, liveview: true,  destination: true,  focus: true,  _bufTime: 2500, newISO: true  } },
    '054c:0d10': { name: "Sony A6600",    supports: { shutter: true, aperture: true, iso: true, liveview: true,  destination: true,  focus: true,  _bufTime: 3000, newISO: true  } },
    '054c:0d18': { name: "Sony A7S III",  supports: { shutter: true, aperture: true, iso: true, liveview: true,  destination: true,  focus: true,  _bufTime: 2500, newISO: true  } },
    '054c:0d2b': { name: "Sony A7C",      supports: { shutter: true, aperture: true, iso: true, liveview: true,  destination: true,  focus: true,  _bufTime: 2500, newISO: true  } },
    '054c:0d9f': { name: "Sony A7R IV A", supports: { shutter: true, aperture: true, iso: true, liveview: true,  destination: true,  focus: true,  _bufTime: 2500, newISO: true  } },
    '054c:0da3': { name: "Sony FX3",      supports: { shutter: true, aperture: true, iso: true, liveview: true,  destination: true,  focus: true,  _bufTime: 2500, newISO: true  } },
    '054c:0da7': { name: "Sony A7 IV",    supports: { shutter: true, aperture: true, iso: true, liveview: true,  destination: true,  focus: true,  _bufTime: 2500, newISO: true  } },
}

var properties = {
    'shutter': {
        name: 'shutter',
        category: 'exposure',
        getSetFunction: function(camera) { return shiftProperty; },
        getFunction: null,
        listFunction: null,
        sonyShift: function(camera){return true;},
        listWorks: false,
        code: 0xD20D,
        typeCode: 6,
        ev: true,
        values: [
            { name: "30s",     ev: -11,         code:  19660810, duration_ms: 32000},
            { name: "25s",     ev: -10 - 2 / 3, code:  16384010, duration_ms: 27000 },
            { name: "20s",     ev: -10 - 1 / 3, code:  13107210, duration_ms: 21500 },
            { name: "15s",     ev: -10,         code:  9830410, duration_ms: 16000 },
            { name: "13s",     ev: -9 - 2 / 3,  code:  8519690, duration_ms: 13800 },
            { name: "10s",     ev: -9 - 1 / 3,  code:  6553610, duration_ms: 10600},
            { name: "8s",      ev: -9,          code:  5242890, duration_ms: 8000 },
            { name: "6s",      ev: -8 - 2 / 3,  code:  3932170, duration_ms: 6000 },
            { name: "5s",      ev: -8 - 1 / 3,  code:  3276810, duration_ms: 5000 },
            { name: "4s",      ev: -8,          code:  2621450, duration_ms: 4000 },
            { name: "3s",      ev: -7 - 2 / 3,  code:  2097162, duration_ms: 3000 },
            { name: "2.5s",    ev: -7 - 1 / 3,  code:  1638410, duration_ms: 2500 },
            { name: "2s",      ev: -7,          code:  1310730, duration_ms: 2000 },
            { name: "1.6s",    ev: -6 - 2 / 3,  code:  1048586, duration_ms: 1600 },
            { name: "1.3s",    ev: -6 - 1 / 3,  code:  851978, duration_ms: 1300 },
            { name: "1s",      ev: -6,          code:  655370, duration_ms: 1000 },
            { name: "0.8s",    ev: -5 - 2 / 3,  code:  524298, duration_ms: 800 },
            { name: "0.6s",    ev: -5 - 1 / 3,  code:  393226, duration_ms: 600 },
            { name: "1/2",     ev: -5,          code:  327690, duration_ms: 500 },
            { name: "0.4s",    ev: -4 - 2 / 3,  code:  262154, duration_ms: 400 },
            { name: "1/3",     ev: -4 - 1 / 3,  code:  65539, duration_ms: 333 },
            { name: "1/4",     ev: -4,          code:  65540, duration_ms: 250 },
            { name: "1/5",     ev: -3 - 2 / 3,  code:  65541, duration_ms: 200 },
            { name: "1/6",     ev: -3 - 1 / 3,  code:  65542, duration_ms: 150 },
            { name: "1/8",     ev: -3,          code:  65544, duration_ms: 125 },
            { name: "1/10",    ev: -2 - 2 / 3,  code:  65546, duration_ms: 100 },
            { name: "1/13",    ev: -2 - 1 / 3,  code:  65549, duration_ms: 100 },
            { name: "1/15",    ev: -2,          code:  65551, duration_ms: 100 },
            { name: "1/20",    ev: -1 - 2 / 3,  code:  65556, duration_ms: 100 },
            { name: "1/25",    ev: -1 - 1 / 3,  code:  65561, duration_ms: 100 },
            { name: "1/30",    ev: -1,          code:  65566, duration_ms: 100 },
            { name: "1/40",    ev: 0 - 2 / 3,   code:  65576, duration_ms: 100 },
            { name: "1/50",    ev: 0 - 1 / 3,   code:  65586, duration_ms: 100 },
            { name: "1/60",    ev: 0,           code:  65596, duration_ms: 100 },
            { name: "1/80",    ev: 0 + 1 / 3,   code:  65616, duration_ms: 100 },
            { name: "1/100",   ev: 0 + 2 / 3,   code:  65636, duration_ms: 100 },
            { name: "1/125",   ev: 1,           code:  65661, duration_ms: 100 },
            { name: "1/160",   ev: 1 + 1 / 3,   code:  65696, duration_ms: 100 },
            { name: "1/200",   ev: 1 + 2 / 3,   code:  65736, duration_ms: 100 },
            { name: "1/250",   ev: 2,           code:  65786, duration_ms: 100 },
            { name: "1/320",   ev: 2 + 1 / 3,   code:  65856, duration_ms: 100 },
            { name: "1/400",   ev: 2 + 2 / 3,   code:  65936, duration_ms: 100 },
            { name: "1/500",   ev: 3,           code:  66036, duration_ms: 100 },
            { name: "1/640",   ev: 3 + 1 / 3,   code:  66176, duration_ms: 100 },
            { name: "1/800",   ev: 3 + 2 / 3,   code:  66336, duration_ms: 100 },
            { name: "1/1000",  ev: 4,           code:  66536, duration_ms: 100 },
            { name: "1/1250",  ev: 4 + 1 / 3,   code:  66786, duration_ms: 100 },
            { name: "1/1600",  ev: 4 + 2 / 3,   code:  67136, duration_ms: 100 },
            { name: "1/2000",  ev: 5,           code:  67536, duration_ms: 100 },
            { name: "1/2500",  ev: 5 + 1 / 3,   code:  68036, duration_ms: 100 },
            { name: "1/3200",  ev: 5 + 2 / 3,   code:  68736, duration_ms: 100 },
            { name: "1/4000",  ev: 6,           code:  69536, duration_ms: 100 },
            { name: "1/5000",  ev: 6 + 1 / 3,   code:  70536, duration_ms: 100 },
            { name: "1/6400",  ev: 6 + 2 / 3,   code:  71936, duration_ms: 100 },
            { name: "1/8000",  ev: 7,           code:  73536, duration_ms: 100 }
        ]
    },
    'aperture': {
        name: 'aperture',
        category: 'exposure',
        getSetFunction: function(camera) { return shiftProperty; },
        getFunction: null,
        listFunction: null,
        listWorks: false,
        sonyShift: function(camera){return true;},
        code: 0x5007,
        typeCode: 4,
        ev: true,
        values: [
            { name: "1.0",      ev: -8,          code: 100  },
            { name: "1.1",      ev: -7 - 2 / 3,  code: 110  },
            { name: "1.2",      ev: -7 - 1 / 3,  code: 120  },
            { name: "1.4",      ev: -7,          code: 140  },
            { name: "1.6",      ev: -6 - 2 / 3,  code: 160  },
            { name: "1.7",      ev: -6 - 1 / 2,  code: 170  },
            { name: "1.8",      ev: -6 - 1 / 3,  code: 180  },
            { name: "2.0",      ev: -6,          code: 200  },
            { name: "2.2",      ev: -5 - 2 / 3,  code: 220  },
            { name: "2.5",      ev: -5 - 1 / 3,  code: 250  },
            { name: "2.8",      ev: -5,          code: 280  },
            { name: "3.2",      ev: -4 - 2 / 3,  code: 320  },
            { name: "3.5",      ev: -4 - 1 / 3,  code: 350  },
            { name: "4.0",      ev: -4,          code: 400  },
            { name: "4.5",      ev: -3 - 2 / 3,  code: 450  },
            { name: "5.0",      ev: -3 - 1 / 3,  code: 500  },
            { name: "5.6",      ev: -3,          code: 560  },
            { name: "6.3",      ev: -2 - 2 / 3,  code: 630  },
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
        getSetFunction: function(camera) { 
            if(camera.supports.newISO) {
                return function(dev, propcode, value, callback) {
                    setDeviceControlValueA (dev, propcode, value, 6, callback);
                }
            } else {
                return shiftProperty;
            }
        },
        getFunction: null,
        listFunction: null,
        listWorks: true,
        sonyShift: function(camera){ return !camera.supports.newISO; },
        typeCode: 6,
        code: function(camera) { 
            if(camera.supports.newISO) return 0xD226; else return 0xD21E
        },
        ev: true,
        values: [
            { name: "AUTO",     ev: null,        code: 16777215 },
            //{ name: "25",       ev:  2,          code: 25 },
            //{ name: "50",       ev:  1,          code: 50 },
            //{ name: "64",       ev:  0 + 2 / 3,  code: 64 },
            //{ name: "80",       ev:  0 + 1 / 3,  code: 80 },
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
            //{ name: "256000",   ev: -11 - 1 / 3, code: 256000 },
            //{ name: "320000",   ev: -11 - 2 / 3, code: 320000 },
            //{ name: "409600",   ev: -12,         code: 409600 }
        ]
    },
    'format': {
        name: 'format',
        category: 'config',
        getSetFunction: function(camera) { return ptp.setPropU8; },
        getFunction: null,
        listFunction: null,
        listWorks: true,
        code: 0x5004,
        typeCode: 2,
        ev: false,
        values: [
            { name: "JPEG Standard",       value: null,        code: 2  },
            { name: "JPEG Fine",           value: null,        code: 3  },
            { name: "JPEG Extra Fine",     value: null,        code: 4  },
            { name: "RAW",                 value: 'raw',       code: 16  },
            { name: "RAW+JPEG Standard",   value: 'raw+jpeg',  code: 18  },
            { name: "RAW+JPEG Fine",       value: null,        code: 19  },
            { name: "RAW+JPEG Extra Fine", value: null,        code: 20  }
        ]
    },
    'objectsAvailable': {
        name: 'objectsAvailable',
        category: 'status',
        getSetFunction: null,
        getFunction: null,
        listFunction: null,
        listWorks: false,
        code: 0xD215,
        typeCode: 4,
        ev: false,
        values: [
            { name: "none",       value: 0,        code: 0x0000  },
            { name: "folder",     value: 0,        code: 0x0001  },
            { name: "1",          value: 1,        code: 0x8001  },
            { name: "2",          value: 2,        code: 0x8002  },
            { name: "3",          value: 3,        code: 0x8003  },
            { name: "4",          value: 4,        code: 0x8004  },
            { name: "5",          value: 5,        code: 0x8005  },
            { name: "6",          value: 6,        code: 0x8006  },
            { name: "7",          value: 7,        code: 0x8007  },
            { name: "8",          value: 8,        code: 0x8008  },
            { name: "9",          value: 9,        code: 0x8009  },
            { name: "10",         value: 10,       code: 0x8010  },
        ]
    },
    'focusMode': {
        name: 'focusMode',
        category: 'config',
        getSetFunction: function(camera) { return function(dev, propcode, value, callback) {
            setDeviceControlValueA (dev, propcode, value, 4, callback);
        } },
        getFunction: null,
        listFunction: null,
        listWorks: false,
        code: 0x500A,
        typeCode: 4,
        ev: false,
        values: [
            { name: "AF-S",       value: 'af',        code: 2  },
            { name: "AF-A",       value: null,        code: 32773  },
            { name: "AF-C",       value: null,        code: 32772  },
            { name: "DMF",        value: null,        code: 32774  },
            { name: "MF",         value: 'mf',        code: 1  },
        ]
    },
    'driveMode': {
        name: 'driveMode',
        category: 'config',
        getSetFunction: function(camera) { return function(dev, propcode, value, callback) {
            setDeviceControlValueA (dev, propcode, value, 4, callback);
        } },
        getFunction: null,
        listFunction: null,
        listWorks: false,
        code: 0x5013,
        typeCode: 4,
        ev: false,
        values: [
            { name: "Single",           value: 'single', code: 1  },
            { name: "High Speed",       value: 'high',   code: 2  },
            { name: "10s Timer",        value: null,     code: 32772  },
            { name: "10s Timer 3 img",  value: null,     code: 32776  },
            { name: "Cont. BRK0.3EV3",  value: null,     code: 33591  },
            { name: "Single BRK0.3EV3", value: null,     code: 33590  },
            { name: "BRK WB LO",        value: null,     code: 32792  },
            { name: "BRK DRO LO",       value: null,     code: 32793  },
        ]
    },
    'shutterMode': {
        name: 'shutterMode',
        category: 'config',
        getSetFunction: function(camera) { return function(dev, propcode, value, callback) {
            setDeviceControlValueA (dev, propcode, value, 4, callback);
        } },
        getFunction: null,
        listFunction: null,
        listWorks: false,
        code: 0x500C,
        typeCode: 4,
        ev: false,
        values: [
            { name: "Electronic (Silent)", value: 'e-shutter', code: 2  },
            { name: "Mechanical",         value: 'mechanical', code: 3  },
        ]
    },
    'absFocusPos': {
        name: 'absFocusPos',
        category: 'status',
        getSetFunction: null,
        getFunction: null,
        listFunction: null,
        listWorks: false,
        noList: true,
        code: 0xD24C,
        typeCode: 3,
        onChange: function(camera, newValue) {
            _logD("absFocusPos: onChange =", newValue);
            camera.status.focusPos = newValue;
            driver.emit('settings', camera);
        },
        ev: false,
    },
    'battery': {
        name: 'battery',
        category: 'status',
        getSetFunction: null,
        getFunction: null,
        listFunction: null,
        listWorks: false,
        noList: true,
        code: 0xD218,
        typeCode: 2,
        ev: false,
    },
    'framesRemaining': {
        name: 'framesRemaining',
        category: 'status',
        getSetFunction: null,
        getFunction: null,
        listFunction: null,
        listWorks: false,
        noList: true,
        code: 0xD249,
        typeCode: 2,
        ev: false,
    },
    'priorityMode': {
        name: 'priorityMode',
        category: 'config',
        getSetFunction: function(camera) { return function(dev, propcode, value, callback) {
            setDeviceControlValueA (dev, propcode, value, 1, callback);
        } },
        getFunction: null,
        listFunction: null,
        listWorks: false,
        code: 0xD25A,
        typeCode: 1,
        ev: false,
        values: [
            { name: "Application",    value: 'app', code: 1  },
            { name: "Camera",         value: 'cam', code: 0  },
        ]
    },
    'storageMode': {
        name: 'storageMode',
        category: 'config',
        getSetFunction: function(camera) { return function(dev, propcode, value, callback) {
            setDeviceControlValueA (dev, propcode, value, 2, callback);
        } },
        getFunction: null,
        listFunction: null,
        listWorks: false,
        code: 0xD222,
        typeCode: 2,
        ev: false,
        values: [
            { name: "Camera Only",    value: 'cam', code: 1  },
            { name: "Camera + PC",    value: 'campc', code: 17  },
            { name: "PC Only",        value: 'pc', code: 16  },
        ]
    }
}

//20200108-221512 PTP-SONY: UNKNOWN CODE: 53805 = 2 // zoom mode 2=true, 0=false
//20200108-221512 PTP-SONY: UNKNOWN CODE: 53807 = 59 // zoom amount
//20200108-221530 PTP-SONY: UNKNOWN CODE: 53808 = 25297107 // zoom position

driver.properties = properties;

driver._error = function(camera, error) { // events received
    _logD("ERROR:", error);
};

var SONY_EVENT_CAPTURE = 0xC201
var SONY_EVENT_OBJECT_CREATED = 0xC202
var SONY_EVENT_CHANGE = 0xC203

driver._event = function(camera, data) { // events received
    //_logD("EVENT:", data);
    ptp.parseEvent(data, function(type, event, param1, param2, param3) {
        if(event == SONY_EVENT_OBJECT_CREATED) {
            _logD("object added:", param1);
        } else if(event == SONY_EVENT_CHANGE) {
            var check = function() {
                if(camera._eventTimer) clearTimeout(camera._eventTimer);            
                camera._eventTimer = setTimeout(function() {
                    camera._eventTimer = null;
                    if(!camera._blockEvents) {
                        driver.refresh(camera);
                    } else {
                        camera._eventTimer = setTimeout(check, 500);
                    }
                }, 800);
            }
            check();
        } else {
            _logD("UNKNOWN EVENT:", event, "=", param1, param2, param3);
        }
    });
};

var DATA8 = 0x0001;
var DATAU8 = 0x0002;
var DATA16 = 0x0003;
var DATAU16 = 0x0004;
var DATA32 = 0x0005;
var DATAU32 = 0x0006;

var RANGE = 1;
var LIST = 2;

var unknownProps = {};

function getCode(camera, code) {
    if(typeof code == 'function') {
        return code(camera);
    } else {
        return code;
    }
}

driver.refresh = function(camera, callback, noEvent) {
    ptp.transaction(camera._dev, 0x9209, [], null, function(err, responseCode, data) {
        //_logD("0x9209 data.length", data.length,  "err", err);
        var i = 8;
        var data_current;//, data_default;

        var property_code;
        var data_type;
        var step_size;
        var count;
        var list_type;

        var data_size;

        if(err || !data) return callback && callback(err || "no data received");

        while(i < data.length) {
            var list = [];
            property_code = data.readUInt16LE(i);
            i += 2;
            data_type = data.readUInt16LE(i);
            i += 2;
            step_size = data.readUInt16LE(i);
            i += 2; // skip an unknown uint16
            //_logD("data type", data_type);
            switch(data_type)
            {
                case DATA8:
                case DATAU8:
                    data_size = 1;
                    break;
                case DATA16:
                case DATAU16:
                    data_size = 2;
                    break;
                case DATA32:
                case DATAU32:
                    data_size = 4;
                    break;
                default:
                    //error invalid data type
                    return callback && callback("invalid data (1)");
            }
            i += data_size;
            switch(data_type)
            {
                case DATA8:
                    data_current = data.readInt8(i);
                    break;
                case DATAU8:
                    data_current = data.readUInt8(i);
                    break;
                case DATA16:
                    data_current = data.readInt16LE(i);
                    break;
                case DATAU16:
                    data_current = data.readUInt16LE(i);
                    break;
                case DATA32:
                    data_current = data.readInt32LE(i);
                    break;
                case DATAU32:
                    data_current = data.readUInt32LE(i);
                    break;
                default:
                    //error invalid data type
                    return callback && callback("invalid data (4)");
            }
            i += data_size;
    
            list_type = data.readUInt8(i);
            i++;
            switch(list_type)
            {
                case RANGE:
                    count = 3;
                    break;
                case LIST:
                    count = data.readUInt8(i);
                    i += 2;
                    if(count > 128) return callback && callback("invalid data (2)");
                    break;
                default:
                    // error invalid data mode
                    return callback && callback("invalid list type", list_type);
                    break;
            }
            var data_list_item;
            while(count > 0) // walk through data list
            {
                data_list_item = 0;
                switch(data_type)
                {
                    case DATA8:
                        data_list_item = data.readInt8(i);
                        break;
                    case DATAU8:
                        data_list_item = data.readUInt8(i);
                        break;
                    case DATA16:
                        data_list_item = data.readInt16LE(i);
                        break;
                    case DATAU16:
                        data_list_item = data.readUInt16LE(i);
                        break;
                    case DATA32:
                        data_list_item = data.readInt32LE(i);
                        break;
                    case DATAU32:
                        data_list_item = data.readUInt32LE(i);
                        break;
                    default:
                        //error invalid data type
                        return callback && callback("invalid data (4)");
                }
                i += data_size;
        
                list.push(data_list_item);
                count--;
            }
            var found = false;
            for(var prop in properties) {
                if(getCode(camera, properties[prop].code) == property_code) {
                    found = true;
                    var p = properties[prop];
                    if(p.noList) {
                        if(!camera[p.category]) camera[p.category] = {};
                        camera[p.category][p.name] = data_current;
                        if(unknownProps[property_code] === undefined || unknownProps[property_code] != data_current) {
                            unknownProps[property_code] = data_current;
                            _logD(prop, "=", data_current);
                            if(properties[prop].onChange) {
                                properties[prop].onChange(camera, data_current);
                            }
                        }
                    } else {
                        var current = mapPropertyItem(data_current, p.values);
                        if(!current) {
                            _logD(prop, "item not found:", data_current);
                            current = {
                                name: "UNKNOWN",
                                ev: null,
                                value: null,
                                code: data_current
                            }
                        }
                        if(!camera[p.category]) camera[p.category] = {};
                        camera[p.category][p.name] = ptp.objCopy(current, {});
                        if(p.listWorks) {
                            camera[p.category][p.name].list = [];
                            for(var x = 0; x < list.length; x++) {
                                var item =  mapPropertyItem(list[x], p.values);
                                if(item) {
                                    camera[p.category][p.name].list.push(item);
                                } else if(list[x] != null) {
                                    camera[p.category][p.name].list.push({
                                        name: "UNKNOWN (" + list[x] + ")",
                                        ev: null,
                                        value: null,
                                        code: list[x]
                                    });
                                }
                            }
                        } else {
                            camera[p.category][p.name].list = p.values;
                        }
                        if(unknownProps[property_code] === undefined || unknownProps[property_code] != data_current) {
                            unknownProps[property_code] = data_current;
                            _logD(prop, "=", current.name, "count", camera[p.category][p.name].list.length);
                        }
                        //_logD(prop, "=", data_current, "type", data_type, list_type == LIST ? "list" : "range", "count", list.length);
                    }
                }
            }
            if(!found) {
                if(unknownProps[property_code] === undefined || unknownProps[property_code] != data_current) {
                    unknownProps[property_code] = data_current;
                    _logD("UNKNOWN CODE:", property_code, "=", data_current);
                }
            }
        }
        callback && callback();
        if(!noEvent) exposureEvent(camera);
    });
}

// connect:
// C_PTP (ptp_sony_9280(params, 0x4, 2,2,0,0, 0x01,0x01));
// C_PTP (ptp_sony_9281(params, 0x4));

// disconnect:
// C_PTP (ptp_sony_9280(params, 0x4,0,5,0,0,0,0));

function ptp_sony_9280 (camera, param1, additional, data2, data3, data4, x, y, callback)
{
    if(additional != 2) additional = 0;

    var buf = new Buffer(16 + additional);

    buf.writeUInt32LE(additional, 0);
    buf.writeUInt32LE(data2, 4);
    buf.writeUInt32LE(data3, 8);
    buf.writeUInt32LE(data4, 12);

    /* only sent in the case where additional is 2 */
    if(additional == 2) {
        buf.writeUInt8(x, 16);
        buf.writeUInt8(y, 17);
    }

    return ptp.transaction(camera._dev, 0x9280, [param1], buf, callback);
}

function ptp_sony_9281 (camera, param1, callback) {
    return ptp.transaction(camera._dev, 0x9281, [param1], buf, callback);
}


driver.init = function(camera, callback) {
    camera.supportsNativeHDR = driver.supportsNativeHDR;

    camera.status = {};
    camera.status.focusPos = 0;
    ptp.init(camera._dev, function(err, di) {
        async.series([
            function(cb){ptp.transaction(camera._dev, 0x9201, [0x1, 0x0, 0x0], null, cb);}, // PC mode
            function(cb){ptp.transaction(camera._dev, 0x9201, [0x2, 0x0, 0x0], null, cb);}, // PC mode
            function(cb){ptp.transaction(camera._dev, 0x9202, [0xC8], null, cb);}, // Receive events
            function(cb){ptp.transaction(camera._dev, 0x9201, [0x3, 0x0, 0x0], null, cb);}, // PC mode
            function(cb){setDeviceControlValueA(camera._dev, 0xD25A, 1, 1, cb);},
        ], function(err) {
            return callback && callback(err);
        });
    });
}

function findLimits(camera, callback) {
    async.series([
        function(cb){driver.refresh(camera, cb);}, // update settings
        function(cb){shiftProperty(camera._dev, 0xD20D, 127, cb);}, // get max shutter
        function(cb){shiftProperty(camera._dev, 0x5007, 127, cb);}, // get max aperture
        function(cb){shiftProperty(camera._dev, 0xD21E, 127, cb);}, // get max iso
     
        function(cb2){
            async.parallel([
                function(cb){waitValueChange(camera, 'shutter', 2000, function(err, val) {
                    _logD("shutter max:", val.name);
                    cb();
                });},
                function(cb){waitValueChange(camera, 'aperture', 2000, function(err, val) {
                    _logD("aperture max:", val.name);
                    cb();
                });},
                function(cb){waitValueChange(camera, 'iso', 2000, function(err, val) {
                    _logD("iso max:", val.name);
                    cb();
                });},
            ], cb2);
        },
     
        function(cb){shiftProperty(camera._dev, 0xD20D, -127, cb);}, // get min shutter
        function(cb){shiftProperty(camera._dev, 0x5007, -127, cb);}, // get min aperture
        function(cb){shiftProperty(camera._dev, 0xD21E, -127, cb);}, // get max iso
     
        function(cb2){
            async.parallel([
                function(cb){waitValueChange(camera, 'shutter', 2000, function(err, val) {
                    _logD("shutter min:", val.name);
                    cb();
                });},
                function(cb){waitValueChange(camera, 'aperture', 2000, function(err, val) {
                    _logD("aperture min:", val.name);
                    cb();
                });},
                function(cb){waitValueChange(camera, 'iso', 2000, function(err, val) {
                    _logD("iso min:", val.name);
                    cb();
                });},
            ], cb2);
        },

    ], function(err) {
        return callback && callback(err);
    });
}

function waitValueChange(camera, param, timeout, callback) {
    var firstValue = null;
    var startTime = Date.now();
    var update = function() {
        if(Date.now() - startTime > timeout) {
            return callback && callback("timeout");
        }
        driver.get(camera, 'param', function(err, val) {
            if(err || val == null) {
                _logD("error reading values!", err)
                return callback && callback(err);
            } else if(firstValue == null) {
                firstValue = val.code;
                setTimeout(update, 50);
            } else if(firstValue != val.code) {
                return callback && callback(null, val);
            } else {
                setTimeout(update, 50);
            }
        });
    }
}


function mapPropertyItem(cameraValue, list) {
    for(var i = 0; i < list.length; i++) {
        if(cameraValue == list[i].code) return list[i];
    }
    return null;
}

function setDeviceControlValueA (_dev, propcode, value, datatype, callback) {
    var typeInfo = ptp.getTypeInfo(datatype);
    var buf = new Buffer(typeInfo.size);
    buf[typeInfo.writeFunction](value, 0);
    return ptp.transaction(_dev, 0x9205, [propcode], buf, callback);
}

function setDeviceControlValueB (_dev, propcode, value, datatype, callback) {
    var typeInfo = ptp.getTypeInfo(datatype);
    var buf = new Buffer(typeInfo.size);
    buf[typeInfo.writeFunction](value, 0);
    return ptp.transaction(_dev, 0x9207, [propcode], buf, callback);
}

function shiftProperty(_dev, propcode, move, callback) {
    if(move > 127) move = 127;
    if(move < -127) move = -127;
    setDeviceControlValueB (_dev, propcode, move, 1, callback);
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
            if(camera[properties[param].category][param] && camera[properties[param].category][param].code != null) { // first make sure we already have the current value for comparison
                cb();
            } else {
                driver.get(camera, param, function(err, val) {
                    cb();
                });
            }
        },
        function(cb){
            if(properties[param] && properties[param].getSetFunction && camera[properties[param].category][param] && camera[properties[param].category][param].code != null) {
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
                        if(properties[param].values[i].name == value) {
                            cameraValue = properties[param].values[i].code;
                            targetIndex = i;
                            break;
                        }
                    }
                }
                if(cameraValue !== null && currentIndex !== null && targetIndex !== null) {
                    if(!properties[param].getSetFunction) return cb("unable to write");
                    _logD("setting", ptp.hex(getCode(camera, properties[param].code)), "to", cameraValue, " (currentIndex:", currentIndex,", targetIndex:", targetIndex, ", delta:", targetIndex - currentIndex, ")");
                    if(properties[param].sonyShift && properties[param].sonyShift(camera)) {
                        var delta = targetIndex - currentIndex;
                        //var abs = Math.abs(delta);
                        //var sign = delta < 0 ? -1 : 1;
                        //if(abs > 4) {
                        //    delta += ((abs - 4) * 2) * sign;
                        //}
                        properties[param].getSetFunction(camera)(camera._dev, getCode(camera, properties[param].code), delta, function(err) {
                            if(!err) {
                                //if(delta > 1 || tries > 1) {
                                    var refreshTries = 8 + Math.abs(delta) * 2;
                                    var refresh = function() {
                                        if(camera._eventTimer) {
                                            clearTimeout(camera._eventTimer);
                                            camera._eventTimer = null;
                                        }
                                        driver.refresh(camera, function(){
                                            _logD("read settings...");
                                            if(camera[properties[param].category][param].code == cameraValue) {
                                                return cb();
                                            } else if(tries > 5) {
                                                return cb("failed to reach target value");
                                            } else {
                                                if(refreshTries <= 0) {
                                                    return setTimeout(function(){
                                                        driver.refresh(camera, function(){
                                                            driver.set(camera, param, value, callback, tries);
                                                        }, true);
                                                    }, 300);
                                                } else {
                                                    refreshTries--;
                                                    return setTimeout(refresh, 50);
                                                }
                                            }
                                        });
                                    }
                                    setTimeout(refresh, 50);
                                //} else {
                                //    var newItem = mapPropertyItem(cameraValue, properties[param].values);
                                //    for(var k in newItem) {
                                //        if(newItem.hasOwnProperty(k)) camera[properties[param].category][param][k] = newItem[k];
                                //    }
                                //    return cb(err);
                                //}
                            } else {
                                _logE("error setting (shift) " + ptp.hex(getCode(camera, properties[param].code)) + ": " + err);
                                return cb(err);
                            }
                        });
                    } else {
                        _logD("setFunction:", ptp.hex(getCode(camera, properties[param].code)), "=>", cameraValue);
                        properties[param].getSetFunction(camera)(camera._dev, getCode(camera, properties[param].code), cameraValue, function(err) {
                            if(!err) {
                                if(properties[param].ev) {
                                    var refreshTries = 8;
                                    var refresh = function() {
                                        if(camera._eventTimer) {
                                            clearTimeout(camera._eventTimer);
                                            camera._eventTimer = null;
                                        }
                                        driver.refresh(camera, function(){
                                            _logD("read settings...");
                                            if(camera[properties[param].category][param].code == cameraValue) {
                                                return cb();
                                            } else if(tries > 3) {
                                                return cb("failed to set", param);
                                            } else {
                                                if(refreshTries <= 0) {
                                                    return setTimeout(function(){
                                                        driver.refresh(camera, function(){
                                                            driver.set(camera, param, value, callback, tries);
                                                        }, true);
                                                    }, 300);
                                                } else {
                                                    refreshTries--;
                                                    return setTimeout(refresh, 50);
                                                }
                                            }
                                        });
                                    }
                                    setTimeout(refresh, 50);
                                } else {
                                    var newItem =  mapPropertyItem(cameraValue, properties[param].values);
                                    for(var k in newItem) {
                                        if(newItem.hasOwnProperty(k)) camera[properties[param].category][param][k] = newItem[k];
                                    }
                                    return cb(err);
                                }
                            } else {
                                _logE("error setting " + ptp.hex(getCode(camera, properties[param].code)) + ":". err);
                                return cb(err);
                            }
                        });
                    }
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
        if(camera._eventTimer !== true) clearTimeout(camera._eventTimer);
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

    async.series([
        function(cb){
            var check = function() {
                if(Date.now() - startTime > timeout) {
                    _logD("getImage: timed out");
                    return cb && cb("timeout");
                }
                if(camera._eventTimer) {
                    clearTimeout(camera._eventTimer);
                    camera._eventTimer = null;
                }
                driver.refresh(camera, function() {
                    if(camera[properties['objectsAvailable'].category] && camera[properties['objectsAvailable'].category]['objectsAvailable'] && camera[properties['objectsAvailable'].category]['objectsAvailable'].value > 0) {
                        _logD("OBJECTS AVAILABLE:", camera[properties['objectsAvailable'].category]['objectsAvailable'].value);
                        camera[properties['objectsAvailable'].category]['objectsAvailable'] = properties['objectsAvailable'].values[0]; // reset to 0 in case it's not updated before the next frame
                        results.indexNumber = 1;
                        return cb();
                    } else {
                        return setTimeout(check, 50);
                    }
                });
            }
            check();
        },
        function(cb){
            camera._blockEvents = true;
            //_logD("getting object info");
            ptp.getObjectInfo(camera._dev, 0xffffc001, function(err, oi) {
                if(!err && oi) {
                    results.filename = oi.filename;
                    _logD("filename =", oi.filename);
                }
                cb(err);
            });
        },
        function(cb){
            //_logD("getting object");
            ptp.getObject(camera._dev, 0xffffc001, function(err, image) {
                //ptp.deleteObject(camera._dev, 0xffffc001, function() {
                    if(results.filename && results.filename.slice(-3).toLowerCase() == 'jpg') {
                        results.thumb = image;
                    } else {
                        results.thumb = ptp.extractJpeg(image);
                        results.rawImage = image;
                    }
                    cb(err);
                //});
            });
        },
    ], function(err) {
        camera._blockEvents = false;
        callback && callback(err, results.thumb, results.filename, results.rawImage);
    });
}

driver.capture = function(camera, target, options, callback, tries) {
    if(camera.busyCapture) {
        return setTimeout(function(){
            driver.capture(camera, target, options, callback, tries);
        }, 100);
    }
    _logD("triggering capture...");
    var targetValue = (!target || target == "camera") ? 2 : 4;
    camera.thumbnail = true;
    var thumb = null;
    var filename = null;
    var rawImage = null;
    camera.busyCapture = true;
    async.series([
        function(cb){ // make sure focus is set to MF
            if(!camera.config || !camera.config.focusMode || camera.config.focusMode.value == 'mf' || camera.config.focusMode.name == 'UNKNOWN') {
                cb();
            } else {
                driver.set(camera, 'focusMode', 'MF', cb);
            }
        },
        function(cb){ // make sure drive mode is single shot
            if(!camera.config || !camera.config.driveMode || camera.config.driveMode.value == 'single' || camera.config.driveMode.name == 'UNKNOWN') {
                cb();
            } else {
                driver.set(camera, 'driveMode', 'single', cb);
            }
        },
        function(cb){setDeviceControlValueB(camera._dev, 0xD2C1, 2, 4, cb);}, // activate half-press
        function(cb){ setTimeout(cb, 20); },
        function(cb){setDeviceControlValueB(camera._dev, 0xD2C2, 2, 4, cb);}, // activate full-press
        function(cb){ setTimeout(cb, 100); },
        function(cb){setDeviceControlValueB(camera._dev, 0xD2C2, 1, 4, cb);}, // release full-press
        function(cb){ setTimeout(cb, 20); },
        function(cb){setDeviceControlValueB(camera._dev, 0xD2C1, 1, 4, cb);}, // release half-press
        function(cb){ setTimeout(cb, 20); },
        function(cb){
            getImage(camera, camera.exposure.shutter.duration_ms + camera.supports._bufTime + 1, function(err, th, fn, rw) {
                thumb = th;
                filename = fn;
                rawImage = rw;
                cb(err);
            });
        },
    ], function(err) {
        if(err) {
            _logE("error during capture:", err);
        } else {
            _logD("capture complete:", filename);
        }
        camera.busyCapture = false;
        callback && callback(err, thumb, filename, rawImage);
    });
}

driver.captureHDR = function(camera, target, options, frames, stops, darkerOnly, callback) {
    return driver.capture(camera, target, options, callback); // needs implemenation
}

driver.liveviewMode = function(camera, enable, callback) {
    camera.status.liveview = enable;
    callback && callback();
}

driver.liveviewImage = function(camera, callback) {
    if(camera.status.liveview) {
        ptp.getObject(camera._dev, 0xffffc002, function(err, image) {
            if(!err && image) image = ptp.extractJpegSimple(image);
            callback && callback(err, image);
        });
    } else {
        callback && callback("not enabled");
    }
}

//driver.moveFocus = function(camera, steps, resolution, callback) {
//    if(!steps) return callback && callback();
//
//    camera.status.focusPos += steps;
//
//    var dir = steps < 0 ? -1 : 1;
//    resolution = Math.round(Math.abs(resolution) * 2);
//    if(resolution > 7) resolution = 7;
//    resolution *= dir;
//    steps = Math.abs(steps);
//
//    var doStep = function() {
//        setDeviceControlValueB(camera._dev, 0xD2D1, resolution, 3, function(err){
//            if(err) return callback && callback(err);
//            steps--;
//            if(steps > 0) {
//                setTimeout(doStep, 50);
//            } else {
//                driver.emit('settings', camera);
//                callback && callback(err, camera.status.focusPos);
//            }
//        });
//    }
//    doStep();
//}

driver.moveFocus = function(camera, steps, resolution, callback) {
    if(!steps) return callback && callback();

    var targetPos = camera.status.focusPos + steps;
    var dir = steps < 0 ? -1 : 1;
    resolution = Math.round(Math.abs(resolution) * 2);
    if(resolution > 7) resolution = 7;
    resolution *= dir;

    var tries = 0;
    var startPos = null;

    if(camera[properties['absFocusPos'].category] && camera[properties['absFocusPos'].category]['absFocusPos'] != null) {
        startPos = camera[properties['absFocusPos'].category]['absFocusPos'];
        targetPos = camera[properties['absFocusPos'].category]['absFocusPos'] + steps;
        if(targetPos < 0) targetPos = 0;
        if(targetPos > 100) targetPos = 100;
        _logD("Focus: start:", startPos, " target:", targetPos);
    } else {
        camera.status.focusPos = targetPos;
    }

    steps = Math.abs(steps);

    var absStep = function() {
        if(camera._eventTimer) {
            clearTimeout(camera._eventTimer);
            camera._eventTimer = null;
        }

        driver.refresh(camera, function() {
            if(camera[properties['absFocusPos'].category]['absFocusPos'] != startPos) {
                startPos = camera[properties['absFocusPos'].category]['absFocusPos'];
                tries = 0;
            }
            tries++;
            var diff = Math.abs(camera[properties['absFocusPos'].category]['absFocusPos'] - targetPos);
            var move = dir;
            if(diff > 2) {
                move = dir * 2;
            }
            if(diff > 5) {
                move = dir * 3;
            }
            if(diff > 10) {
                move = dir * 4;
            }
            if(diff > 20) {
                move = dir * 5;
            }
            if(diff > 30) {
                move = dir * 6;
            }
            if(diff > 40) {
                move = dir * 7;
            }

            if(camera[properties['absFocusPos'].category]['absFocusPos'] == targetPos) {
                camera.status.focusPos = camera[properties['absFocusPos'].category]['absFocusPos'];
                return callback(null, camera[properties['absFocusPos'].category]['absFocusPos']);
            } else if(tries > 20) {
                return callback("timeout", camera[properties['absFocusPos'].category]['absFocusPos']);
            } else if(camera[properties['absFocusPos'].category]['absFocusPos'] > targetPos) {
                setDeviceControlValueB(camera._dev, 0xD2D1, move, 3, function(err){
                    return setTimeout(absStep, 50);
                });
            } else if(camera[properties['absFocusPos'].category]['absFocusPos'] < targetPos) {
                setDeviceControlValueB(camera._dev, 0xD2D1, move, 3, function(err){
                    return setTimeout(absStep, 50);
                });
            }
        });
    }

    var doStep = function() {
        setDeviceControlValueB(camera._dev, 0xD2D1, resolution, 3, function(err){
            if(err) return callback && callback(err);
            steps--;
            if(steps > 0) {
                setTimeout(doStep, 50);
            } else {
                driver.emit('settings', camera);
                callback && callback(err, camera.status.focusPos);
            }
        });
    }

    if(startPos === null) {
        doStep();
    } else {
        absStep();
    }
}




module.exports = driver;
