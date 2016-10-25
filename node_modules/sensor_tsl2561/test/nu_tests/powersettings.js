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

exports.settingPowerMode_cb = {
    setUp: function(callback) {
        this.oldCtrlReg = sens.wire.ctrlReg;
        sens.init(function(err, val) {
            sens.wire.ctrlReg = 0x00; // powerDown
            callback();
        });
    },
    tearDown: function(callback) {
        sens.wire.ctrlReg = this.oldCtrlReg;
        callback();
    },
    'set powermode to "powerUp" should call cb with no error and new value': function(test) {
        test.expect(2);
        sens.setPowerMode('powerUp', function(err, val) {
            test.ifError(err);
            test.strictEqual(val, 'powerUp', 'powermode not set to "powerUp"');
            test.done();
        });
    },
    'set gainmode to "powerDown" should call cb with no error and new value': function(test) {
        test.expect(2);
        sens.setPowerMode('powerDown', function(err, val) {
            test.ifError(err);
            test.strictEqual(val, 'powerDown', 'powermode not set to "powerDown"');
            test.done();
        });
    },
    'set gainmode to "powerDown" should not change other bits in the control register': function(test) {
        test.expect(1);
        sens.wire.ctrlReg = 0xFF;
        sens.setPowerMode('powerDown', function(err, val) {
            sens.readCtrlRegister(function(err, val) {
                test.strictEqual(val, (0xFF & 0xFC), "set powermode powerDown changed other bits in timing register");
            });
            test.done();
        });
    },
    'set gainmode to "powerUp" should not change other bits in the control register': function(test) {
        test.expect(1);
        sens.wire.ctrlReg = 0x00;
        sens.setPowerMode('powerUp', function(err, val) {
            sens.readCtrlRegister(function(err, val) {
                test.strictEqual(val, 0x03, "set powermode powerUp changed other bits in timing register");
            });
            test.done();
        });
    }
};

exports.wrongSettingPowerMode_cb = {
    setUp: function(callback) {
        this.oldCtrlReg = sens.wire.ctrlReg;
        sens.init(function(err, val) {
            sens.wire.ctrlReg = 0x00; // powerDown
            callback();
        });
    },
    tearDown: function(callback) {
        sens.wire.ctrlReg = this.oldCtrlReg;
        callback();
    },
    'set wrong powermodemode should call cb with an error and null': function(test) {
        test.expect(2);
        sens.setPowerMode('powerup', function(err, val) {
            test.strictEqual(err.message, 'wrong powermode value in set powermode command', 'wrong error message');
            test.strictEqual(val, null, 'value is not null');
            test.done();
        });
    },
    'set wrong powermode should not change the powermode': function(test) {
        test.expect(1);
        sens.setPowerMode('powerup', function(err, val) {
            sens.getPowerMode(function(err, val) {
                test.strictEqual(val, 'powerDown', "wrong powermode changed the powermode");
            });
            test.done();
        });
    },
    'set wrong powermode should not change the control register': function(test) {
        test.expect(1);
        sens.setPowerMode('powerup', function(err, val) {
            sens.readCtrlRegister(function(err, val) {
                test.strictEqual(val, 0x00, "wrong powermode changed the control register");
            });
            test.done();
        });
    }
};
