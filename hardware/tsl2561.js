'use strict';

// The TSL2561 light sensor on the VIEW board: I2C bus 2, address 0x29, ID 0x50 (T/FN/CL package). The firmware left it
// alone since 99439a43: the upstream driver (hardware/light.js on sensor_tsl2561) cost 6 s of boot, because its i2c
// module compiles CoffeeScript on require (2.8 s alone at 432 MHz), and it threw away every reading with an empty IR
// channel, that is every night one. This one goes through i2c-bus, which power.js already loads (0.23 s, 0.6 ms a word
// read). The sensor is powered only between start() and stop(); it integrates by itself, 402 ms at a time, and read()
// returns the last finished integration. Why it is read at all: docs/2026-10-23-cable-release-auto-ramp.md §8.

var CMD = 0x80;             // command bit of the register address byte
var WORD = 0x20;            // two-register (word) transaction
var CONTROL = 0x00;
var TIMING = 0x01;
var ID = 0x0A;
var DATA0 = 0x0C;           // CH0: visible + IR
var DATA1 = 0x0E;           // CH1: IR
var POWER_UP = 0x03;
var POWER_DOWN = 0x00;
var INTEG_402MS = 0x02;
var GAIN_16X = 0x10;
var INTEGRATION_MS = 402;
var FULL_SCALE = 65535;     // a channel stops counting here at 402 ms
var GAIN_DOWN_AT = 50000;   // CH0 at 16x above this: the next readings are taken at 1x
var GAIN_UP_AT = 2000;      // CH0 at 1x below this: the next readings are taken at 16x (≈32000 there)

// Lux from the two channels, the datasheet's formula for the T/FN/CL package. Its coefficients are for 402 ms at 16x,
// so a 1x reading is scaled up by the nominal 16.
function lux(ch0, ch1, gain) {
    if (gain == 1) {
        ch0 *= 16;
        ch1 *= 16;
    }
    if (!(ch0 > 0)) return 0;
    var r = ch1 / ch0;
    if (r <= 0.50) return 0.0304 * ch0 - 0.062 * ch0 * Math.pow(r, 1.4);
    if (r <= 0.61) return 0.0224 * ch0 - 0.031 * ch1;
    if (r <= 0.80) return 0.0128 * ch0 - 0.0153 * ch1;
    if (r <= 1.30) return 0.00146 * ch0 - 0.00112 * ch1;
    return 0;
}

// opts (for the tests): open(busNumber, cb) -> bus with readByte/readWord/writeByte/close, now() ms, bus, address
function create(opts) {
    opts = opts || {};
    var open = opts.open || function (busNumber, cb) {
        return require('apds-gesture/node_modules/i2c-bus').open(busNumber, cb);
    };
    var now = opts.now || Date.now;
    var busNumber = opts.bus != null ? opts.bus : 2;
    var addr = opts.address || 0x29;

    var state = 'off';      // 'starting', 'on'
    var bus = null;
    var gain = 16;
    var settledAt = 0;      // readings before this mix two settings (power-up, gain change)
    var stopWaiting = null; // stop() called while starting: power down once the start is through

    function timing(g) {
        return INTEG_402MS | (g == 16 ? GAIN_16X : 0);
    }

    function powerDown(cb) {
        var b = bus;
        bus = null;
        state = 'off';
        if (!b) return cb(null);
        b.writeByte(addr, CMD | CONTROL, POWER_DOWN, function (err) {
            b.close(function () {
                cb(err || null);
            });
        });
    }

    var sensor = {};

    // cb(err, id)
    sensor.start = function (cb) {
        cb = cb || function () {};
        if (state != 'off') return cb('already ' + state);
        state = 'starting';
        var done = function (err, id) {
            var waiting = stopWaiting;
            stopWaiting = null;
            if (err) {
                powerDown(function () {
                    cb(err);
                    if (waiting) waiting(null);
                });
                return;
            }
            if (waiting) {
                powerDown(function (e) {
                    cb('stopped');
                    waiting(e);
                });
                return;
            }
            state = 'on';
            cb(null, id);
        };
        var b;
        try {
            b = bus = open(busNumber, function (err) {
                if (err) return done(err);
                b.readByte(addr, CMD | ID, function (err, id) {
                    if (err) return done(err);
                    if (!(id & 0x40)) { // not ours to write to: just let go of the bus
                        var waiting = stopWaiting;
                        stopWaiting = null;
                        bus = null;
                        state = 'off';
                        return b.close(function () {
                            cb('no TSL2561 T/FN/CL at 0x' + addr.toString(16) + ' (ID 0x' + id.toString(16) + ')');
                            if (waiting) waiting(null);
                        });
                    }
                    b.writeByte(addr, CMD | CONTROL, POWER_UP, function (err) {
                        if (err) return done(err);
                        b.writeByte(addr, CMD | TIMING, timing(16), function (err) {
                            if (err) return done(err);
                            gain = 16;
                            settledAt = now() + INTEGRATION_MS + 20;
                            done(null, id);
                        });
                    });
                });
            });
        } catch (e) {
            bus = null;
            state = 'off';
            cb(e);
        }
    };

    // cb(err, {ch0, ch1, gain, lux, saturated, settling}); lux is null while settling or saturated
    sensor.read = function (cb) {
        if (state != 'on') return cb('not started');
        var b = bus;
        b.readWord(addr, CMD | WORD | DATA0, function (err, ch0) {
            if (err) return cb(err);
            b.readWord(addr, CMD | WORD | DATA1, function (err, ch1) {
                if (err) return cb(err);
                var r = {
                    ch0: ch0,
                    ch1: ch1,
                    gain: gain,
                    saturated: ch0 >= FULL_SCALE || ch1 >= FULL_SCALE,
                    settling: now() < settledAt
                };
                r.lux = (r.saturated || r.settling) ? null : lux(ch0, ch1, gain);
                var next = gain;
                if (!r.settling) {
                    if (gain == 16 && (r.saturated || ch0 > GAIN_DOWN_AT)) next = 1;
                    else if (gain == 1 && ch0 < GAIN_UP_AT) next = 16;
                }
                if (next == gain || state != 'on') return cb(null, r);
                b.writeByte(addr, CMD | TIMING, timing(next), function (err) {
                    if (!err) {
                        gain = next;
                        settledAt = now() + 2 * INTEGRATION_MS + 20; // the integration under way mixes both gains
                    }
                    cb(err || null, r);
                });
            });
        });
    };

    sensor.stop = function (cb) {
        cb = cb || function () {};
        if (state == 'starting') {
            stopWaiting = cb;
            return;
        }
        powerDown(cb);
    };

    sensor.state = function () {
        return state;
    };

    return sensor;
}

module.exports = create();
module.exports.create = create;
module.exports.lux = lux;
