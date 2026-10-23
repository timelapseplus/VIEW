'use strict';

var assert = require('assert');
var tsl = require('../hardware/tsl2561.js');

// An i2c-bus stand-in: answers the ID and the two channel words, records the register writes.
function fakeBus() {
    var b = {
        id: 0x50,
        words: {0xAC: 0, 0xAE: 0},
        writes: [],
        closed: false,
        readError: null,
        readByte: function (addr, cmd, cb) {
            setImmediate(cb, null, b.id);
        },
        readWord: function (addr, cmd, cb) {
            setImmediate(cb, b.readError, b.words[cmd]);
        },
        writeByte: function (addr, cmd, byte, cb) {
            b.writes.push([cmd, byte]);
            setImmediate(cb, null);
        },
        close: function (cb) {
            b.closed = true;
            setImmediate(cb, null);
        }
    };
    return b;
}

function setup() {
    var t = {now: 1000, bus: fakeBus()};
    t.sensor = tsl.create({
        open: function (n, cb) {
            t.busNumber = n;
            setImmediate(cb, null);
            return t.bus;
        },
        now: function () {
            return t.now;
        }
    });
    return t;
}

describe('TSL2561', function () {
    describe('lux', function () {
        it('follows the T/FN/CL formula at 16x', function () {
            // the one reading taken on the unit (2026-10-22): 88 / 15 at 16x
            var expected = 0.0304 * 88 - 0.062 * 88 * Math.pow(15 / 88, 1.4);
            assert.ok(Math.abs(tsl.lux(88, 15, 16) - expected) < 1e-9);
            assert.ok(Math.abs(tsl.lux(88, 15, 16) - 2.22) < 0.01);
        });
        it('scales a 1x reading by 16', function () {
            assert.strictEqual(tsl.lux(6, 1, 1), tsl.lux(96, 16, 16));
        });
        it('keeps a reading with an empty IR channel (night)', function () {
            assert.ok(Math.abs(tsl.lux(10, 0, 16) - 0.304) < 1e-9);
        });
        it('gives 0 for no light and for IR only', function () {
            assert.strictEqual(tsl.lux(0, 0, 16), 0);
            assert.strictEqual(tsl.lux(100, 140, 16), 0);
        });
    });

    it('powers up at 402 ms / 16x on bus 2 and down on stop', function (done) {
        var t = setup();
        t.sensor.start(function (err, id) {
            assert.ifError(err);
            assert.strictEqual(id, 0x50);
            assert.strictEqual(t.busNumber, 2);
            assert.deepStrictEqual(t.bus.writes, [[0x80, 0x03], [0x81, 0x12]]);
            t.sensor.stop(function (err) {
                assert.ifError(err);
                assert.deepStrictEqual(t.bus.writes[2], [0x80, 0x00]);
                assert.ok(t.bus.closed);
                assert.strictEqual(t.sensor.state(), 'off');
                done();
            });
        });
    });

    it('does not write to a chip that is not a TSL2561 T/FN/CL', function (done) {
        var t = setup();
        t.bus.id = 0x10; // CS package
        t.sensor.start(function (err) {
            assert.ok(err);
            assert.deepStrictEqual(t.bus.writes, []);
            assert.ok(t.bus.closed);
            done();
        });
    });

    it('reports no lux until the first integration is through', function (done) {
        var t = setup();
        t.bus.words = {0xAC: 88, 0xAE: 15};
        t.sensor.start(function () {
            t.sensor.read(function (err, r) {
                assert.ifError(err);
                assert.strictEqual(r.settling, true);
                assert.strictEqual(r.lux, null);
                t.now += 500;
                t.sensor.read(function (err, r) {
                    assert.ifError(err);
                    assert.strictEqual(r.settling, false);
                    assert.strictEqual(r.gain, 16);
                    assert.ok(Math.abs(r.lux - 2.22) < 0.01);
                    done();
                });
            });
        });
    });

    it('drops to 1x in bright light and goes back to 16x when it gets dark', function (done) {
        var t = setup();
        t.sensor.start(function () {
            t.now += 500;
            t.bus.words = {0xAC: 65535, 0xAE: 20000};
            t.sensor.read(function (err, r) {
                assert.ifError(err);
                assert.strictEqual(r.saturated, true);
                assert.strictEqual(r.lux, null);
                assert.deepStrictEqual(t.bus.writes[2], [0x81, 0x02]);
                t.now += 500; // the integration under way mixes both gains
                t.bus.words = {0xAC: 30000, 0xAE: 9000};
                t.sensor.read(function (err, r) {
                    assert.strictEqual(r.gain, 1);
                    assert.strictEqual(r.settling, true);
                    t.now += 400;
                    t.sensor.read(function (err, r) {
                        assert.strictEqual(r.settling, false);
                        assert.ok(Math.abs(r.lux - tsl.lux(30000, 9000, 1)) < 1e-9);
                        t.bus.words = {0xAC: 100, 0xAE: 10};
                        t.sensor.read(function (err, r) {
                            assert.strictEqual(r.gain, 1);
                            assert.deepStrictEqual(t.bus.writes[3], [0x81, 0x12]);
                            t.now += 900;
                            t.sensor.read(function (err, r) {
                                assert.strictEqual(r.gain, 16);
                                assert.strictEqual(r.settling, false);
                                done();
                            });
                        });
                    });
                });
            });
        });
    });

    it('refuses a read before start and passes I2C errors on', function (done) {
        var t = setup();
        t.sensor.read(function (err) {
            assert.strictEqual(err, 'not started');
            t.sensor.start(function () {
                t.bus.readError = new Error('EIO');
                t.sensor.read(function (err) {
                    assert.strictEqual(err.message, 'EIO');
                    done();
                });
            });
        });
    });

    it('powers down after the start when stopped while starting', function (done) {
        var t = setup();
        var started = null;
        t.sensor.start(function (err) {
            started = err;
        });
        t.sensor.stop(function (err) {
            assert.ifError(err);
            assert.strictEqual(started, 'stopped');
            assert.deepStrictEqual(t.bus.writes[t.bus.writes.length - 1], [0x80, 0x00]);
            assert.strictEqual(t.sensor.state(), 'off');
            done();
        });
    });
});
