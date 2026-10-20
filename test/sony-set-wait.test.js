'use strict';

var assert = require('assert');
var ptp = require('../camera/ptpjs/common/ptp-functions.js');
var sony = require('../camera/ptpjs/drivers/sony.js');

var isoValues = sony.properties.iso.values;

function isoAt(index) {
    var v = isoValues[index];
    return {name: v.name, ev: v.ev, value: v.value, code: v.code};
}

function changeEvent() { // a PTP event container: DevicePropChanged (0xC203)
    var b = new Buffer(12);
    b.writeUInt32LE(12, 0);
    b.writeUInt16LE(4, 4);
    b.writeUInt16LE(0xC203, 6);
    b.writeUInt32LE(0, 8);
    return b;
}

// A fake A6600 for set('iso'): a shift (0x9207) moves its ISO one step, whatever the delta, lagMs later, the way the camera
// shows a new value ~0.75 s after the command, and sends 0xC203 then (doc §24); a dump read (refresh) reports the current
// ISO. dropFirst: the first shift is lost. Calls done(shifts, reads, ms) when set() calls back.
function setIso(fromIndex, toIndex, lagMs, dropFirst, done) {
    var camera = {supports: {newISO: false}, exposure: {iso: isoAt(fromIndex)}, _dev: {}};
    var current = fromIndex, shifts = [], reads = 0, t0 = Date.now();
    var transaction = ptp.transaction, refresh = sony.refresh, log = console.log;
    ptp.transaction = function (dev, opcode, params, data, cb) {
        assert.strictEqual(opcode, 0x9207);
        var delta = data.readInt8(0);
        shifts.push([delta, Date.now() - t0]);
        if (!(dropFirst && shifts.length == 1)) {
            setTimeout(function () {
                current += delta > 0 ? 1 : -1;
                sony._event(camera, changeEvent());
            }, lagMs);
        }
        setTimeout(function () { cb(null, 0x2001); }, 2);
    };
    sony.refresh = function (cam, cb) {
        reads++;
        cam.exposure.iso = isoAt(current);
        setTimeout(function () { cb(); }, 5);
    };
    console.log = function () {};
    sony.set(camera, 'iso', isoValues[toIndex].ev, function (err) {
        ptp.transaction = transaction;
        sony.refresh = refresh;
        console.log = log;
        assert.ifError(err);
        assert.strictEqual(camera.exposure.iso.code, isoValues[toIndex].code);
        done(shifts, reads, Date.now() - t0);
    });
}

describe('sony set() waits for a shifted value', function () {
    this.timeout(6000);

    var from = 10, to = 9; // one step, whichever direction the list runs

    it('takes the value when the camera reports it, ~0.75 s later, with one shift and a few reads', function (done) {
        setIso(from, to, 750, false, function (shifts, reads, ms) {
            assert.strictEqual(shifts.length, 1);
            assert.ok(ms >= 750 && ms < 950, 'done after ' + ms + ' ms');
            assert.ok(reads <= 5, reads + ' reads');
            done();
        });
    });

    it('does not shift again while a busy camera takes 1.2 s', function (done) {
        setIso(from, to, 1200, false, function (shifts, reads, ms) {
            assert.strictEqual(shifts.length, 1, 'shifts: ' + JSON.stringify(shifts));
            assert.ok(ms >= 1200 && ms < 1400, 'done after ' + ms + ' ms');
            done();
        });
    });

    it('shifts the rest at once after each step of a three-step change', function (done) {
        setIso(from, from + 3, 750, false, function (shifts, reads, ms) {
            assert.deepStrictEqual(shifts.map(function (s) { return s[0]; }), [3, 2, 1]);
            assert.ok(ms >= 3 * 750 && ms < 3 * 900, 'done after ' + ms + ' ms');
            done();
        });
    });

    it('shifts again once the first shift is lost', function (done) {
        setIso(from, to, 300, true, function (shifts, reads, ms) {
            assert.strictEqual(shifts.length, 2, 'shifts: ' + JSON.stringify(shifts));
            assert.ok(shifts[1][1] >= 1500, 'second shift at ' + shifts[1][1] + ' ms');
            assert.strictEqual(shifts[1][0], shifts[0][0]);
            done();
        });
    });
});
