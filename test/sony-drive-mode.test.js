'use strict';

var assert = require('assert');
var ptp = require('../camera/ptpjs/common/ptp-functions.js');
var sony = require('../camera/ptpjs/drivers/sony.js');

var values = sony.properties.driveMode.values;

function mode(code) {
    for (var i = 0; i < values.length; i++) {
        if (values[i].code == code) return values[i];
    }
    return {name: 'UNKNOWN', value: null, code: code}; // what the driver stores for a code it lacks
}

// Runs capture() up to the half-press, the first PTP transaction after the drive-mode step, and stops there.
// Returns the driver.set calls and whether the shutter was pressed.
function captureUntilPress(driveMode, setResult, done) {
    var sets = [];
    var pressed = false;
    var set = sony.set;
    var transaction = ptp.transaction;
    var log = console.log;
    sony.set = function (camera, param, value, cb) {
        sets.push(param + '=' + value);
        cb(setResult);
    };
    ptp.transaction = function (dev, opcode, params, data, cb) {
        pressed = true;
        cb('stopped by the test');
    };
    console.log = function () {};
    var camera = {config: {focusMode: {name: 'MF', value: 'mf', code: 1}, driveMode: driveMode}, exposure: {}, _dev: {}};
    sony.capture(camera, 'camera', {}, function () {
        sony.set = set;
        ptp.transaction = transaction;
        console.log = log;
        done(sets, pressed);
    });
}

describe('sony drive mode', function () {

    it('names every Still Capture Mode value of the PTP 2 reference once', function () {
        assert.strictEqual(values.length, 153);
        var seen = {};
        values.forEach(function (v) {
            assert.ok(!seen[v.code], 'duplicate ' + v.code.toString(16));
            seen[v.code] = true;
        });
        // the A6600 reported 32786 on 2026-10-18 and it read as UNKNOWN
        assert.strictEqual(mode(32786).name, 'Continuous Shooting Lo');
        assert.strictEqual(mode(0x0001).value, 'single');
    });

    it('keeps the codes the driver knew before', function () {
        [1, 2, 32772, 32776, 33591, 33590, 32792, 32793].forEach(function (code) {
            assert.notStrictEqual(mode(code).name, 'UNKNOWN', 'code ' + code);
        });
    });

    it('switches a continuous drive mode to Single before the shot', function (done) {
        captureUntilPress(mode(0x8012), null, function (sets, pressed) {
            assert.deepStrictEqual(sets, ['driveMode=Single']); // by name: set() never matched 'single'
            assert.ok(pressed);
            done();
        });
    });

    it('still takes the shot when the switch fails', function (done) {
        captureUntilPress(mode(0x8012), 'unknown value', function (sets, pressed) {
            assert.deepStrictEqual(sets, ['driveMode=Single']);
            assert.ok(pressed);
            done();
        });
    });

    it('leaves Single and unknown drive modes alone', function (done) {
        captureUntilPress(mode(0x0001), null, function (sets) {
            assert.deepStrictEqual(sets, []);
            captureUntilPress(mode(0x7777), null, function (sets2) {
                assert.deepStrictEqual(sets2, []);
                done();
            });
        });
    });
});
