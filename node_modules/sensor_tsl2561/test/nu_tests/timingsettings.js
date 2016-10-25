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

exports.settingTimingMode_cb = {
    setUp: function(callback) {
        this.oldTimingReg = sens.wire.timingReg;
        sens.init(function(err, val) {
            sens.wire.timingReg = 0x03; // 'n/a'
            callback();
        });
    },
    tearDown: function(callback) {
        sens.wire.timingReg = this.oldTimingReg;
        callback();
    },
    'set timingmode to "402ms" should call cb with no error and new value': function(test) {
        test.expect(2);
        sens.setTimingMode('402ms', function(err, val) {
            test.ifError(err);
            test.strictEqual(val, '402ms', 'timingmode not set to "402"');
            test.done();
        });
    },
    'set timingmode to "101ms" should call cb with no error and new value': function(test) {
        test.expect(2);
        sens.setTimingMode('101ms', function(err, val) {
            test.ifError(err);
            test.strictEqual(val, '101ms', 'timingmode not set to "101ms"');
            test.done();
        });
    },
    'set timingmode to "13.7ms" should call cb with no error and new value': function(test) {
        test.expect(2);
        sens.setTimingMode('13.7ms', function(err, val) {
            test.ifError(err);
            test.strictEqual(val, '13.7ms', 'timingmode not set to "13.7ms"');
            test.done();
        });
    },
    'set timingmode to "402ms" should not change other bits in the timing register': function(test) {
        test.expect(1);
        sens.wire.timingReg = 0xFF;
        sens.setTimingMode('402ms', function(err, val) {
            sens.readTimingRegister(function(err, val) {
                test.strictEqual(val, (0xFF & 0xFE), "set timingmode 402ms changed other bits in timing register");
            });
            test.done();
        });
    },
    'set timingmode to "101ms" should not change other bits in the timing register': function(test) {
        test.expect(1);
        sens.wire.timingReg = 0xFF;
        sens.setTimingMode('101ms', function(err, val) {
            sens.readTimingRegister(function(err, val) {
                test.strictEqual(val, (0xFF & 0xFD), "set timingmode 101ms changed other bits in timing register");
            });
            test.done();
        });
    },
    'set timingmode to "13.7ms" should not change other bits in the timing register': function(test) {
        test.expect(1);
        sens.wire.timingReg = 0xFF;
        sens.setTimingMode('13.7ms', function(err, val) {
            sens.readTimingRegister(function(err, val) {
                test.strictEqual(val, (0xFF & 0xFC), "set timingmode 13.7ms changed other bits in timing register");
            });
            test.done();
        });
    },
};

exports.wrongSettingTimingMode_cb = {
    setUp: function(callback) {
        this.oldTimingReg = sens.wire.timingReg;
        sens.init(function(err, val) {
            sens.wire.timingReg = 0x13; // gain: 16, 'n/a'
            callback();
        });
    },
    tearDown: function(callback) {
        sens.wire.timingReg = this.oldTimingReg;
        callback();
    },
    'set wrong timingmode should call cb with an error and null': function(test) {
        test.expect(2);
        sens.setTimingMode('144', function(err, val) {
            test.strictEqual(err.message, 'wrong timingmode value in set timingmode command', 'wrong error message');
            test.strictEqual(val, null, 'value is not null');
            test.done();
        });
    },
    'set wrong timingmode should not change the gainmode': function(test) {
        test.expect(1);
        sens.setTimingMode('144', function(err, val) {
            sens.getGainMode(function(err, val) {
                test.strictEqual(val, '16', "wrong timingmode changed the timingmode");
            });
            test.done();
        });
    },
    'set wrong timingmode should not change the timing register': function(test) {
        test.expect(1);
        sens.setTimingMode('144', function(err, val) {
            sens.readTimingRegister(function(err, val) {
                test.strictEqual(val, 0x13, "wrong timingmode changed the timing register");
            });
            test.done();
        });
    }
};
