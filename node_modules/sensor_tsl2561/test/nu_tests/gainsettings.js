/*
 * This file is part of sensorTSL2561 for node.
 *
 * Copyright (C) Thomas Schneider, imwebgefunden@gmail.com
 *
 * sensorTSL2561 for node is free software: you can redistribute it
 * and/or modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation, either version 3 of
 * the License, or (at your option) any later version.
 *
 * sensorTSL2561 for node is distributed in the hope that it will be
 * useful, but WITHOUT ANY WARRANTY; without even the implied warranty
 * of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with sensorTSL2561 for node.  If not, see
 * <http://www.gnu.org/licenses/>.
 */

/* jslint node: true */
"use strict";

var async = require('async');
var i2cFakeDev = require('../fakedevice/fake_i2c_tsl2561_dev.js');
var proxyquire = require('proxyquire').noCallThru();

var TSL2561 = proxyquire('./../../tsl2561', {
    'i2c': i2cFakeDev
});

var sens = new TSL2561();

exports.settingGainMode_cb = {
    setUp: function(callback) {
        this.oldTimingReg = sens.wire.timingReg;
        sens.init(function(err, val) {
            sens.wire.timingReg = 0x02; // gain bit low
            callback();
        });
    },
    tearDown: function(callback) {
        sens.wire.timingReg = this.oldTimingReg;
        callback();
    },
    'set gainmode to "1" should call cb with no error and new value': function(test) {
        test.expect(2);
        sens.setGainMode('1', function(err, val) {
            test.ifError(err);
            test.strictEqual(val, '1', 'gainmode not set to "1"');
            test.done();
        });
    },
    'set gainmode to "16" should call cb with no error and new value': function(test) {
        test.expect(2);
        sens.setGainMode('16', function(err, val) {
            test.ifError(err);
            test.strictEqual(val, '16', 'gainmode not set to "16"');
            test.done();
        });
    },
    'set gainmode to "1" should not change other bits in the timing register': function(test) {
        test.expect(1);
        sens.wire.timingReg = 0xFF;
        sens.setGainMode('1', function(err, val) {
            sens.readTimingRegister(function(err, val) {
                test.strictEqual(val, (0xFF & 0xEF), "set gainmode 1 changed other bits in timing register");
            });
            test.done();
        });
    },
    'set gainmode to "16" should not change other bits in the timing register': function(test) {
        test.expect(1);
        sens.wire.timingReg = 0x00;
        sens.setGainMode('16', function(err, val) {
            sens.readTimingRegister(function(err, val) {
                test.strictEqual(val, 0x10, "set gainmode 16 changed other bits in timing register");
            });
            test.done();
        });
    }
};

exports.wrongSettingGainMode_cb = {
    setUp: function(callback) {
        this.oldTimingReg = sens.wire.timingReg;
        sens.init(function(err, val) {
            sens.wire.timingReg = 0x12; // gain bit high
            callback();
        });
    },
    tearDown: function(callback) {
        sens.wire.timingReg = this.oldTimingReg;
        callback();
    },
    'set wrong gainmode should call cb with an error and null': function(test) {
        test.expect(2);
        sens.setGainMode('144', function(err, val) {
            test.strictEqual(err.message, 'wrong gainmode value in set gainmode command', 'wrong error message');
            test.strictEqual(val, null, 'value is not null');
            test.done();
        });
    },
    'set wrong gainmode should not change the gainmode': function(test) {
        test.expect(1);
        sens.setGainMode('144', function(err, val) {
            sens.getGainMode(function(err, val) {
                test.strictEqual(val, '16', "wrong gainmode changed the gainmode");
            });
            test.done();
        });
    },
    'set wrong gainmode should not change the timing register': function(test) {
        test.expect(1);
        sens.setGainMode('144', function(err, val) {
            sens.readTimingRegister(function(err, val) {
                test.strictEqual(val, 0x12, "wrong gainmode changed the timing register");
            });
            test.done();
        });
    }
};
