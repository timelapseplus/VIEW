'use strict';

var assert = require('assert');
var Module = require('module');
var EventEmitter = require('events').EventEmitter;

// camera/ptpjs/api.js with the native usb module replaced and the Sony driver's init() held until a test
// finishes it, so a camera can be attached, detached and replugged while it is still connecting.

var usb = new EventEmitter();
var bootDevices = [];
usb.getDeviceList = function () {
    usb.scanned = true;
    return bootDevices;
};

var sony = require('../camera/ptpjs/drivers/sony.js');
var pendingInits = [];
sony.init = function (camera, callback) {
    pendingInits.push(callback);
};

// api.js and the drivers log every connect and their self-tests
function quietly(fn) {
    var log = console.log;
    console.log = function () {};
    try {
        fn();
    } finally {
        console.log = log;
    }
}

function finishInits() {
    var callbacks = pendingInits;
    pendingInits = [];
    quietly(function () {
        callbacks.forEach(function (callback) {
            callback();
        });
    });
}

// An A6600 as node-usb reports it: a bulk in/out pair and an interrupt endpoint for events.
function a6600(address) {
    var evt = new EventEmitter();
    evt.transferType = 3;
    evt.direction = 'in';
    evt.startPoll = function () {};
    evt.stopPoll = function () {};
    return {
        busNumber: 1,
        deviceAddress: address,
        deviceDescriptor: {idVendor: 0x054c, idProduct: 0x0d10},
        open: function () {},
        close: function () {},
        interfaces: [{
            claim: function () {},
            release: function () {},
            endpoints: [{transferType: 2, direction: 'in'}, {transferType: 2, direction: 'out'}, evt]
        }]
    };
}

function attach(address) {
    quietly(function () {
        usb.emit('attach', a6600(address));
    });
}

function detach(address) {
    quietly(function () {
        usb.emit('detach', a6600(address));
    });
}

function ports(api) {
    return api.cameras.map(function (c) {
        return c.camera._port;
    });
}

describe('camera api', function () {
    var api;

    before(function (done) {
        var log = console.log;
        console.log = function () {};
        bootDevices = [a6600(2)]; // the camera is on while the VIEW boots
        var load = Module._load;
        Module._load = function (request) {
            return request === 'usb' ? usb : load.apply(this, arguments);
        };
        try {
            api = require('../camera/ptpjs/api.js');
        } finally {
            Module._load = load;
        }
        (function waitForScan() { // the drivers load asynchronously, then the scan runs
            if (!usb.scanned) return setTimeout(waitForScan, 5);
            console.log = log;
            done();
        })();
    });

    it('connects a camera once when the boot scan and an attach event both report it', function () {
        // 2026-10-18: both came before the first init() ended and two cameras were added on port 1:2
        assert.strictEqual(pendingInits.length, 1);
        attach(2);
        assert.strictEqual(pendingInits.length, 1);
        finishInits();
        assert.deepStrictEqual(ports(api), ['1:2']);
        assert.strictEqual(api.cameras[0].primary, true);
    });

    it('makes the replugged camera primary once the old one is unplugged', function () {
        detach(2);
        assert.deepStrictEqual(ports(api), []);
        assert.strictEqual(api.available, false);
        attach(3);
        finishInits();
        assert.deepStrictEqual(ports(api), ['1:3']);
        assert.strictEqual(api.getPrimary().camera._port, '1:3');
    });

    it('drops a camera unplugged while it was connecting', function () {
        detach(3);
        attach(4);
        detach(4);
        finishInits();
        assert.deepStrictEqual(ports(api), []);
        attach(5);
        finishInits();
        assert.deepStrictEqual(ports(api), ['1:5']);
    });
});
