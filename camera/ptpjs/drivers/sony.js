
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

driver.supportedCameras = {
    '054c:0994': {
            name: "Sony A7III",
            supports: {
                shutter: true,
                aperture: true,
                iso: true,
                liveview: true,
                destination: true,
                focus: true,
            }
        },
    '054c:0c34': {
            name: "Sony A7III",
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
        setFunction: setDeviceControlValueB,
        getFunction: null,
        listFunction: null,
        listWorks: false,
        code: 0xD20D,
        typeCode: 6,
        ev: true,
        values: [
            { name: "30s",     ev: -11,         code:  19660810 },
            { name: "25s",     ev: -10 - 2 / 3, code:  16384010 },
            { name: "20s",     ev: -10 - 1 / 3, code:  13107210 },
            { name: "15s",     ev: -10,         code:  9830410 },
            { name: "13s",     ev: -9 - 3 / 3,  code:  8519690 },
            { name: "10s",     ev: -9 - 1 / 3,  code:  6553610 },
            { name: "8s",      ev: -9,          code:  5242890 },
            { name: "6s",      ev: -8 - 2 / 3,  code:  3932170 },
            { name: "5s",      ev: -8 - 1 / 3,  code:  3276810 },
            { name: "4s",      ev: -8,          code:  2621450 },
            { name: "3s",      ev: -7 - 2 / 3,  code:  2097162 },
            { name: "2.5s",    ev: -7 - 1 / 3,  code:  1638410 },
            { name: "2s",      ev: -7,          code:  1310730 },
            { name: "1.6s",    ev: -6 - 2 / 3,  code:  1048586 },
            { name: "1.3s",    ev: -6 - 1 / 3,  code:  851978 },
            { name: "1s",      ev: -6,          code:  655370 },
            { name: "0.8s",    ev: -5 - 2 / 3,  code:  524298 },
            { name: "0.6s",    ev: -5 - 1 / 3,  code:  393226 },
            { name: "1/2",     ev: -5,          code:  327690 },
            { name: "0.4s",    ev: -4 - 2 / 3,  code:  262154 },
            { name: "1/3",     ev: -4 - 1 / 3,  code:  65539 },
            { name: "1/4",     ev: -4,          code:  65540 },
            { name: "1/5",     ev: -3 - 2 / 3,  code:  65541 },
            { name: "1/6",     ev: -3 - 1 / 3,  code:  65542 },
            { name: "1/8",     ev: -3,          code:  65544 },
            { name: "1/10",    ev: -2 - 2 / 3,  code:  65546 },
            { name: "1/13",    ev: -2 - 1 / 3,  code:  65549 },
            { name: "1/15",    ev: -2,          code:  65551 },
            { name: "1/20",    ev: -1 - 2 / 3,  code:  65556 },
            { name: "1/25",    ev: -1 - 1 / 3,  code:  65561 },
            { name: "1/30",    ev: -1,          code:  65566 },
            { name: "1/40",    ev: 0 - 2 / 3,   code:  65576 },
            { name: "1/50",    ev: 0 - 1 / 3,   code:  65586 },
            { name: "1/60",    ev: 0,           code:  65596 },
            { name: "1/80",    ev: 0 + 1 / 3,   code:  65616 },
            { name: "1/100",   ev: 0 + 2 / 3,   code:  65636 },
            { name: "1/125",   ev: 1,           code:  65661 },
            { name: "1/160",   ev: 1 + 1 / 3,   code:  65696 },
            { name: "1/200",   ev: 1 + 2 / 3,   code:  65736 },
            { name: "1/250",   ev: 2,           code:  65786 },
            { name: "1/320",   ev: 2 + 1 / 3,   code:  65856 },
            { name: "1/400",   ev: 2 + 2 / 3,   code:  65936 },
            { name: "1/500",   ev: 3,           code:  66036 },
            { name: "1/640",   ev: 3 + 1 / 3,   code:  66176 },
            { name: "1/800",   ev: 3 + 2 / 3,   code:  66336 },
            { name: "1/1000",  ev: 4,           code:  66536 },
            { name: "1/1250",  ev: 4 + 1 / 3,   code:  66786 },
            { name: "1/1600",  ev: 4 + 2 / 3,   code:  67136 },
            { name: "1/2000",  ev: 5,           code:  67536 },
            { name: "1/2500",  ev: 5 + 1 / 3,   code:  68036 },
            { name: "1/3200",  ev: 5 + 2 / 3,   code:  68736 },
            { name: "1/4000",  ev: 6,           code:  69536 },
            { name: "1/5000",  ev: 6 + 1 / 3,   code:  70536 },
            { name: "1/6400",  ev: 6 + 2 / 3,   code:  71936 },
            { name: "1/8000",  ev: 7,           code:  73536 }
        ]
    },
    'aperture': {
        name: 'aperture',
        category: 'exposure',
        setFunction: setDeviceControlValueB,
        getFunction: null,
        listFunction: null,
        listWorks: false,
        code: 0x5007,
        typeCode: 4,
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
            { name: "13",       ev:  0 - 2 / 3,  code: 1300  },
            { name: "14",       ev:  0 - 1 / 3,  code: 1400  },
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
        setFunction: setDeviceControlValueB,
        getFunction: null,
        listFunction: null,
        listWorks: true,
        typeCode: 6,
        code: 0xD21E,
        ev: true,
        values: [
            { name: "AUTO",     ev: null,        code: 16777215 },
            { name: "25",       ev: -2 / 3,      code: 25 },
            { name: "50",       ev: -2 / 3,      code: 50 },
            { name: "64",       ev: -2 / 3,      code: 64 },
            { name: "80",       ev: -2 / 3,      code: 80 },
            { name: "100",      ev: -2 / 3,      code: 100 },
            { name: "125",      ev: -2 / 3,      code: 125 },
            { name: "160",      ev: -2 / 3,      code: 160 },
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
            { name: "256000",   ev: -11 - 1 / 3, code: 256000 },
            { name: "320000",   ev: -11 - 2 / 3, code: 320000 },
            { name: "409600",   ev: -12,         code: 409600 }
        ]
    },
    'format': {
        name: 'format',
        category: 'config',
        setFunction: ptp.setPropU8,
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
        setFunction: null,
        getFunction: null,
        listFunction: null,
        listWorks: false,
        code: 0xD215,
        typeCode: 2,
        ev: false,
        values: [
            { name: "none",       value: 0,        code: 0x0000  },
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
    }
}

driver._error = function(camera, error) { // events received
    _logD("ERROR:", error);
};

var SONY_EVENT_CAPTURE = 0xC201
var SONY_EVENT_OBJECT_CREATED = 0xC202
var SONY_EVENT_CHANGE = 0xC203

driver._event = function(camera, data) { // events received
    _logD("EVENT:", data);
    ptp.parseEvent(data, function(type, event, param1, param2, param3) {
        if(event == SONY_EVENT_OBJECT_CREATED) {
            _logD("object added:", param1);
        }
        if(event == SONY_EVENT_CHANGE) {
            if(camera._eventTimer) clearTimeout(camera._eventTimer);
            camera._eventTimer = setTimeout(function() {
                camera._eventTimer = null;
                driver.refresh(camera);
            }, 500);
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

driver.refresh = function(camera, callback) {
    ptp.transaction(camera._dev, 0x9209, [], null, function(err, responseCode, data) {
        //console.log("0x9209 data.length", data.length,  "err", err);
        var i = 8;
        var data_current;//, data_default;

        var property_code;
        var data_type;
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
            i += 2; // skip an unknown uint16
            //console.log("SONY: data type", data_type);
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
            for(var prop in properties) {
                if(properties[prop].code == property_code) {
                    var p = properties[prop];
                    var current = mapPropertyItem(data_current, p.values);
                    if(current) {
                        if(!camera[p.category]) camera[p.category] = {};
                        camera[p.category][p.name] = ptp.objCopy(current, {});
                        if(p.listWorks) {
                            camera[p.category][p.name].list = [];
                            for(var x = 0; x < list.length; x++) {
                                var item =  mapPropertyItem(list[x], p.values);
                                if(item) camera[p.category][p.name].list.push(item);
                            }
                        } else {
                            camera[p.category][p.name].list = p.values;
                        }
                        console.log("SONY:", prop, "=", current.name, "count", camera[p.category][p.name].list.length);
                        //console.log("SONY:", prop, "=", data_current, "type", data_type, list_type == LIST ? "list" : "range", "count", list.length);
                    } else {
                        console.log("SONY:", prop, "item not found:", data_current);
                    }
                }
            }
        }
        callback && callback();
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
    ptp.init(camera._dev, function(err, di) {
        async.series([
            function(cb){ptp.transaction(camera._dev, 0x9201, [0x1, 0x0, 0x0], null, cb);}, // PC mode
            function(cb){ptp.transaction(camera._dev, 0x9201, [0x2, 0x0, 0x0], null, cb);}, // PC mode
            function(cb){ptp.transaction(camera._dev, 0x9202, [0xC8], null, cb);}, // Receive events
            function(cb){ptp.transaction(camera._dev, 0x9201, [0x3, 0x0, 0x0], null, cb);}, // PC mode
        ], function(err) {
            if(err) return callback && callback(err);
            driver.refresh(camera, function(err){
                if(err) console.log("driver.refresh err", err);
                callback && callback(err);
            });
        });
    });
}

function mapPropertyItem(cameraValue, list) {
    for(var i = 0; i < list.length; i++) {
        if(cameraValue == list[i].code) return list[i];
    }
    return null;
}

function setDeviceControlValueA (camera, propcode, value, datatype, callback) {
    var typeInfo = ptp.getTypeInfo(datatype);
    var buf = new Array(typeInfo.size);
    buf[typeInfo.writeFunction](value, 0);
    return ptp.transaction(camera._dev, 0x9205, [propcode], buf, callback);
}

function setDeviceControlValueB (camera, propcode, value, datatype, callback) {
    var typeInfo = ptp.getTypeInfo(datatype);
    var buf = new Array(typeInfo.size);
    buf[typeInfo.writeFunction](value, 0);
    return ptp.transaction(camera._dev, 0x9207, [propcode], buf, callback);
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
                    properties[param].setFunction(camera._dev, properties[param].code, cameraValue, properties[param].typeCode, function(err) {
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
    } else {
        get();
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
                    return cb && cb("timeout");
                }
                driver.get(camera, 'objectsAvailable', function(err, res) { // check for new objects
                    if(err || data > 0) {
                        results.indexNumber = res;
                        return cb(err);
                    } else {
                        return setTimeout(check, 50);
                    }
                });
            }
            check();
        },
        function(cb){
            ptp.getObjectInfo(camera._dev, 0xffffc001, function(err, oi) {
                results.filename = oi.filename;
                cb(err);
            });
        },
        function(cb){
            ptp.getObject(camera._dev, 0xffffc001, function(err, image) {
                ptp.deleteObject(camera._dev, 0xffffc001, function() {
                    results.thumb = ptp.extractJpeg(image);
                    results.rawImage = image;
                    cb(err);
                });
            });
        },
    ], function(err) {
        callback && callback(err, results.thumb, results.filename, results.rawImage);
    });
}

driver.capture = function(camera, target, options, callback, tries) {
    var targetValue = (!target || target == "camera") ? 2 : 4;
    camera.thumbnail = true;
    var results = {};
    async.series([
        function(cb){setDeviceControlValueB(camera, 0xD2C1, 2, 4, cb);}, // activate half-press
        function(cb){setDeviceControlValueB(camera, 0xD2C2, 2, 4, cb);}, // activate full-press
        function(cb){ setTimeout(cb, 10); },
        function(cb){setDeviceControlValueB(camera, 0xD2C2, 1, 4, cb);}, // release full-press
        function(cb){setDeviceControlValueB(camera, 0xD2C1, 1, 4, cb);}, // release half-press
        function(cb){
            var check = function() {
                driver.get(camera, 'objectsAvailable', function(err, res) { // check for new objects
                    if(err || data > 0) {
                        cb(err);
                    } else {
                        setTimeout(check, 50);
                    }
                });
            }
            check();
        },
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
