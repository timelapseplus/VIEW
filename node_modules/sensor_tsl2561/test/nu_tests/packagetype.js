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

exports.autoPackageType = {
    setUp: function(callback) {
        this.sens = new TSL2561({
            'packageType': 'auto'
        });
        this.sens.init(function(err, val) {
            callback();
        });
    },
    tearDown: function(callback) {
        callback();
    },
    'idReg "0x00" with packageType "auto" is a TSL2560CS': function(test) {
        test.expect(2);
        this.sens.wire.idReg = 0x00;
        this.sens.getSensorId(function(err, val) {
            test.ifError(err);
            test.deepEqual(val, {
                'type': 'TSL2560CS',
                'revision': 0
            }, 'id "0x00" is not a TSL2560CS');
            test.done();
        });
    },
    'idReg "0x10" with packageType "auto" is a TSL2561CS': function(test) {
        test.expect(2);
        this.sens.wire.idReg = 0x10;
        this.sens.getSensorId(function(err, val) {
            test.ifError(err);
            test.deepEqual(val, {
                'type': 'TSL2561CS',
                'revision': 0
            }, 'id "0x10" is not a TSL2561CS');
            test.done();
        });
    },
    'idReg "0x40" with packageType "auto" is a TSL2560T/FN/CL': function(test) {
        test.expect(2);
        this.sens.wire.idReg = 0x40;
        this.sens.getSensorId(function(err, val) {
            test.ifError(err);
            test.deepEqual(val, {
                'type': 'TSL2560T/FN/CL',
                'revision': 0
            }, 'id "0x40" is not a TSL2560T/FN/CL');
            test.done();
        });
    },
    'idReg "0x50" with packageType "auto" is a TSL2561T/FN/CL': function(test) {
        test.expect(2);
        this.sens.wire.idReg = 0x50;
        this.sens.getSensorId(function(err, val) {
            test.ifError(err);
            test.deepEqual(val, {
                'type': 'TSL2561T/FN/CL',
                'revision': 0
            }, 'id "0x50" is not a TSL2561T/FN/CL');
            test.done();
        });
    },
};

exports.csPackageType = {
    setUp: function(callback) {
        this.sens = new TSL2561({
            'packageType': 'CS'
        });
        this.sens.init(function(err, val) {
            callback();
        });
    },
    tearDown: function(callback) {
        callback();
    },
    'set packageType to "CS" is a TSL2561CS': function(test) {
        test.expect(2);
        this.sens.getSensorId(function(err, val) {
            test.ifError(err);
            test.deepEqual(val, {
                'type': 'TSL2561CS',
                'revision': 0
            }, 'id "0x10" is not a TSL2561CS');
            test.done();
        });
    },
};

exports.tfnclPackageType = {
    setUp: function(callback) {
        this.sens = new TSL2561({
            'packageType': 'T/FN/CL'
        });
        this.sens.init(function(err, val) {
            callback();
        });
    },
    tearDown: function(callback) {
        callback();
    },
    'set packageType to "T/FN/CL" is a TSL2561T/FN/CL': function(test) {
        test.expect(2);
        this.sens.getSensorId(function(err, val) {
            test.ifError(err);
            test.deepEqual(val, {
                'type': 'TSL2561T/FN/CL',
                'revision': 0
            }, 'id "0x10" is not a TSL2561CS');
            test.done();
        });
    },
};

exports.wrongPackageType = {
    setUp: function(callback) {
        callback();
    },
    tearDown: function(callback) {
        callback();
    },
    'set packageType to a wrong value should raise an error ': function(test) {
        test.expect(1);
        var sens = new TSL2561({
            'packageType': 'wrongType'
        });
        test.throws(
            function() {
                sens.init();
            }, /wrong packagetype set/);
        test.done();
    },
};
