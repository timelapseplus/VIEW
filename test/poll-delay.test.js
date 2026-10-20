'use strict';

var assert = require('assert');
var ptp = require('../camera/ptpjs/common/ptp-functions.js');
var sony = require('../camera/ptpjs/drivers/sony.js');

// ptp.pollDelay at a given time since the trigger, with Date.now() pinned
function delayAt(shutter, elapsedMs, fastMs) {
    var now = Date.now;
    var start = 1000000;
    Date.now = function () { return start + elapsedMs; };
    try {
        return ptp.pollDelay({exposure: {shutter: shutter}}, start, fastMs);
    } finally {
        Date.now = now;
    }
}

describe('poll delay while the shutter is open', function () {

    it('keeps 50 ms for short exposures and unknown shutters', function () {
        assert.strictEqual(delayAt({name: '1/60', ev: 0, duration_ms: 100}, 0), 50); // Sony table
        assert.strictEqual(delayAt({name: '1/2', ev: -5}, 0), 50);
        assert.strictEqual(delayAt({name: 'bulb', ev: null}, 0), 50);
        assert.strictEqual(ptp.pollDelay({exposure: {}}, Date.now()), 50);
        assert.strictEqual(ptp.pollDelay(null, Date.now()), 50);
    });

    it('polls once a second until 0.5 s before the exposure ends, from the EV', function () {
        var s4 = {name: '4s', ev: -8}; // 2^8 / 64 = 4 s, as lists.bulb
        assert.strictEqual(delayAt(s4, 0), 1000);
        assert.strictEqual(delayAt(s4, 3200), 300);
        assert.strictEqual(delayAt(s4, 3460), 50);
        assert.strictEqual(delayAt(s4, 5000), 50);
    });

    it('uses duration_ms where the driver has it', function () {
        var s20 = {name: '20s', ev: -10 - 1 / 3, duration_ms: 21500}; // Sony table
        assert.strictEqual(delayAt(s20, 0), 1000);
        assert.strictEqual(delayAt(s20, 20900), 100);
        assert.strictEqual(delayAt(s20, 21000), 50);
    });

    it('polls at the given fast delay after the exposure (Sony: 250 ms, its event ends the wait)', function () {
        var s20 = {name: '20s', ev: -10 - 1 / 3, duration_ms: 21500};
        assert.strictEqual(delayAt(s20, 0, 250), 1000);
        assert.strictEqual(delayAt(s20, 20800, 250), 250);
        assert.strictEqual(delayAt(s20, 22000, 250), 250);
        assert.strictEqual(delayAt({name: '1/50', ev: -1 / 3, duration_ms: 100}, 0, 250), 250);
    });
});

describe('sony shot-ready event', function () {

    function event(code) {
        var b = new Buffer(16);
        b.fill(0);
        b.writeUInt32LE(16, 0);
        b.writeUInt16LE(4, 4);        // event container
        b.writeUInt16LE(code, 6);
        b.writeInt32LE(-16383, 12);   // 0xFFFFC001, the shot
        return b;
    }

    it('wakes the waiting getImage on SDIE_ObjectAdded (0xC201) and only then', function () {
        var log = console.log, woken = 0;
        console.log = function () {};
        try {
            var camera = {_shotReady: function () { woken++; }};
            sony._event(camera, event(0xC202));
            assert.strictEqual(woken, 0);
            sony._event(camera, event(0xC201));
            assert.strictEqual(woken, 1);
            camera._shotReady = null;
            sony._event(camera, event(0xC201)); // no capture waiting: nothing to do
            assert.strictEqual(woken, 1);
        } finally {
            console.log = log;
        }
    });
});
