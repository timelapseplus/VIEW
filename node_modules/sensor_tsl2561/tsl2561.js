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

var util = require('util');
var Wire = require('i2c');
var events = require('events');
var _ = require('underscore');
var async = require('async');
var debug;
var defaultOptions = {
    'debug': false,
    'address': 0x39,
    'device': '/dev/i2c-1',
    'powerMode': 'powerUp',
    'timingMode': '402ms',
    'gainMode': '1',
    'packageType': 'auto',
};

var TSL2561 = function(opts) {
    var self = this;

    events.EventEmitter.call(this);
    self.options = _.extend({}, defaultOptions, opts);
    self.wire = new Wire(this.options.address, {
        device: this.options.device,
        debug: this.options.debug
    });

};

util.inherits(TSL2561, events.EventEmitter);

TSL2561.prototype.timingModes = {
    '13.7ms': 0x00,
    '101ms': 0x01,
    '402ms': 0x02,
    'n/a': 0x03,
};

TSL2561.prototype.powerModes = {
    'powerDown': 0x00,
    'powerUp': 0x03
};

TSL2561.prototype.gainModes = {
    '1': 0x00,
    '16': 0x10
};

TSL2561.prototype.packageTypes = {
    'CS': 0x00,
    'T/FN/CL': 0x80,
    'auto': 0xFF
};

TSL2561.prototype.registers = {
    'control': {
        'location': 0x00,
    },
    'timing': {
        'location': 0x01,
    },
    'interruptCtrl': {
        'location': 0x06,
    },
    'id': {
        'location': 0x0A,
    },
    'lightData0': {
        'location': 0x0C,
        'type': 'uint16'
    },
    'lightData1': {
        'location': 0x0E,
        'type': 'uint16'
    },
};

TSL2561.prototype.init = function(callback) {
    var self = this;

    async.series([

            function(cB) {
                self.getSensorId(cB);
            },
            function(cB) {
                self.setPowerMode(self.options.powerMode, cB);
            },
            function(cB) {
                self.setTimingMode(self.options.timingMode, cB);
            },
            function(cB) {
                self.setGainMode(self.options.gainMode, cB);
            }
        ],
        function(err, res) {
            var ts = Math.round(+new Date() / 1000);
            var evData = {
                'addr': self.options.address,
                'type': 'TSL2561',
                'ts': ts,
                'error': err
            };
            if (err) {
                self.emit('sensorInitFailed', evData);
                if (callback) callback(err, null);
            } else {
                self.emit('sensorInitCompleted', evData);
                if (callback) callback(null, true);
            }
        });
};

TSL2561.prototype.readRegister = function(register, callback) {
    var self = this;
    var readCmd = 0x80 | register.location;

    self.wire.readBytes(readCmd, 1, function(err, bytes) {
        callback(err, bytes.readUInt8(0));
    });
};

TSL2561.prototype.readCtrlRegister = function(callback) {
    var self = this;

    self.readRegister(self.registers.control, function(err, val) {
        callback(err, val);
    });
};

TSL2561.prototype.readTimingRegister = function(callback) {
    var self = this;

    self.readRegister(self.registers.timing, function(err, val) {
        callback(err, val);
    });
};

TSL2561.prototype.readIdRegister = function(callback) {
    var self = this;

    self.readRegister(self.registers.id, function(err, val) {
        callback(err, val);
    });
};

TSL2561.prototype.getPowerMode = function(callback) {
    var self = this;
    var modeArr = Object.keys(self.powerModes);

    self.readCtrlRegister(function(err, val) {
        if (err) {
            if (callback) callback(new Error('read powermode failed'), null);
            return;
        }

        var mode = (val & 0x03);
        if (mode === 3) {
            mode = 1; // we have only two modes
        }
        self.options.powerMode = modeArr[mode];
        callback(null, modeArr[mode]);
    });
};

TSL2561.prototype.setPowerMode = function(newMode, callback) {
    var self = this;
    var writeCmd = 0x80 | self.registers.control.location;

    if (_.has(self.powerModes, newMode) === false) {
        var err = new Error('wrong powermode value in set powermode command');
        var ts = Math.round(+new Date() / 1000);
        var evData = {
            'addr': self.options.address,
            'type': 'TSL2561',
            'setting': 'powerMode',
            'newValue': newMode,
            'ts': ts,
            'error': err
        };
        self.emit('sensorSettingFailed', evData);
        if (callback) callback(err, null);
        return;
    }

    async.waterfall([

            function(cB) {
                self.readCtrlRegister(function(err, val) {
                    if (err) {
                        cB(new Error('powermode not set'), 'read');
                    } else {
                        cB(null, val);
                    }
                });
            },
            function(oldReg, cB) {
                var writeVal = oldReg & 0xFC; // clear the original power bits
                writeVal |= self.powerModes[newMode];
                self.wire.writeBytes(writeCmd, [writeVal], function(err) {
                    if (err) {
                        cB(new Error('powermode not set on write'), 'write');
                    } else {
                        cB(null, 'write');
                    }
                });
            },
            function(arg1, cB) {
                self.getPowerMode(function(err, val) {
                    if (err) {
                        cB(new Error('powermode not set'), 'read');
                    } else {
                        if (val === newMode) {
                            cB(null, 'read');
                        } else {
                            cB(new Error('powermode not set'), 'read');
                        }
                    }
                });
            }
        ],
        function(err, results) {
            var ts = Math.round(+new Date() / 1000);
            var evData = {
                'addr': self.options.address,
                'type': 'TSL2561',
                'setting': 'powerMode',
                'newValue': newMode,
                'ts': ts,
                'error': err
            };
            if (err) {
                self.emit('sensorSettingFailed', evData);
                if (callback) callback(err, null);
            } else {
                self.options.powerMode = newMode;
                self.emit('sensorSettingChanged', evData);
                if (callback) callback(null, newMode);
            }
        });
};

TSL2561.prototype.getTimingMode = function(callback) {
    var self = this;
    var modeArr = Object.keys(self.timingModes);

    self.readTimingRegister(function(err, val) {
        if (err) {
            if (callback) callback(new Error('read timingmode failed'), null);
            return;
        }

        var mode = (val & 0x03);
        self.options.timingMode = modeArr[mode];
        callback(null, modeArr[mode]);
    });
};

TSL2561.prototype.setTimingMode = function(newMode, callback) {
    var self = this;
    var writeCmd = 0x80 | self.registers.timing.location;

    if (_.has(self.timingModes, newMode) === false) {
        var err = new Error('wrong timingmode value in set timingmode command');
        var ts = Math.round(+new Date() / 1000);
        var evData = {
            'addr': self.options.address,
            'type': 'TSL2561',
            'setting': 'timingMode',
            'newValue': newMode,
            'ts': ts,
            'error': err
        };
        self.emit('sensorSettingFailed', evData);
        if (callback) callback(err, null);
        return;
    }

    async.waterfall([

            function(cB) {
                self.readTimingRegister(function(err, val) {
                    if (err) {
                        cB(new Error('timingmode not set'), 'read');
                    } else {
                        cB(null, val);
                    }
                });
            },
            function(oldReg, cB) {
                var writeVal = oldReg & 0xFC; // clear the original timing bits
                writeVal |= self.timingModes[newMode];
                self.wire.writeBytes(writeCmd, [writeVal], function(err) {
                    if (err) {
                        cB(new Error('timingmode not set on write'), 'write');
                    } else {
                        cB(null, 'write');
                    }
                });
            },
            function(arg1, cB) {
                self.getTimingMode(function(err, val) {
                    if (err) {
                        cB(new Error('timingmode not set'), 'read');
                    } else {
                        if (val === newMode) {
                            cB(null, 'read');
                        } else {
                            cB(new Error('timingmode not set'), 'read');
                        }
                    }
                });
            }
        ],
        function(err, results) {
            var ts = Math.round(+new Date() / 1000);
            var evData = {
                'addr': self.options.address,
                'type': 'TSL2561',
                'setting': 'timingMode',
                'newValue': newMode,
                'ts': ts,
                'error': err
            };
            if (err) {
                self.emit('sensorSettingFailed', evData);
                if (callback) callback(err, null);
            } else {
                self.options.timingMode = newMode;
                self.emit('sensorSettingChanged', evData);
                if (callback) callback(null, newMode);
            }
        });
};

TSL2561.prototype.getGainMode = function(callback) {
    var self = this;
    var modeArr = Object.keys(self.gainModes);

    self.readTimingRegister(function(err, val) {
        if (err) {
            if (callback) callback(new Error('read gainmode failed'), null);
            return;
        }

        var mode = (val & 0x10) >> 4;
        self.options.gainMode = modeArr[mode];
        callback(null, modeArr[mode]);
    });
};

TSL2561.prototype.setGainMode = function(newMode, callback) {
    var self = this;
    var writeCmd = 0x80 | self.registers.timing.location;

    if (_.has(self.gainModes, newMode) === false) {
        var err = new Error('wrong gainmode value in set gainmode command');
        var ts = Math.round(+new Date() / 1000);
        var evData = {
            'addr': self.options.address,
            'type': 'TSL2561',
            'setting': 'gainMode',
            'newValue': newMode,
            'ts': ts,
            'error': err
        };
        self.emit('sensorSettingFailed', evData);
        if (callback) callback(err, null);
        return;
    }

    async.waterfall([

            function(cB) {
                self.readTimingRegister(function(err, val) {
                    if (err) {
                        cB(new Error('gain mode not set'), 'read');
                    } else {
                        cB(null, val);
                    }
                });
            },
            function(oldReg, cB) {
                var writeVal = oldReg & 0xEF; // clear the original gain bit
                writeVal |= self.gainModes[newMode];
                self.wire.writeBytes(writeCmd, [writeVal], function(err) {
                    if (err) {
                        cB(new Error('gain mode not set on write'), 'write');
                    } else {
                        cB(null, 'write');
                    }
                });
            },
            function(arg1, cB) {
                self.getGainMode(function(err, val) {
                    if (err) {
                        cB(new Error('gain mode not set'), 'read');
                    } else {
                        if (val === newMode) {
                            cB(null, 'read');
                        } else {
                            cB(new Error('gain mode not set'), 'read');
                        }
                    }
                });
            }
        ],
        function(err, results) {
            var ts = Math.round(+new Date() / 1000);
            var evData = {
                'addr': self.options.address,
                'type': 'TSL2561',
                'setting': 'gainMode',
                'newValue': newMode,
                'ts': ts,
                'error': err
            };
            if (err) {
                self.emit('sensorSettingFailed', evData);
                if (callback) callback(err, null);
            } else {
                self.options.gainMode = newMode;
                self.emit('sensorSettingChanged', evData);
                if (callback) callback(null, newMode);
            }
        });
};

TSL2561.prototype.getSensorId = function(callback) {
    var self = this;
    var idArr = ['TSL2560CS', 'TSL2561CS', 'TSL2560T/FN/CL', 'TSL2561T/FN/CL'];

    if (_.has(self.packageTypes, self.options.packageType) === false) {
        throw new Error('wrong packagetype set');
    }

    if (self.options.packageType === 'CS') {
        self.sensId = 0x10; // fake a TSL2561CS
        if (callback) callback(null, {
            'type': 'TSL2561CS',
            'revision': 0
        });
        return;
    } else if (self.options.packageType === 'T/FN/CL') {
        self.sensId = 0x50; // fake a TSL2561T
        if (callback) callback(null, {
            'type': 'TSL2561T/FN/CL',
            'revision': 0
        });
        return;
    }

    self.readIdRegister(function(err, val) {
        if (err) {
            if (callback) callback(new Error('read sensor id failed'), null);
            return;
        }
        self.sensId = val;
        var rev = (val & 0x0F);
        var id = (val >> 4);
        if (id > 1) {
            id -= 2;
        }
        if (callback) callback(null, {
            'type': idArr[id],
            'revision': rev
        });
    });
};

TSL2561.prototype.getLight0 = function(callback) {
    var self = this;
    var readLightCmd = 0x80 | self.registers.lightData0.location;
    var hi = 0;
    var lo = 0;
    var li = 0;

    self.wire.readBytes(readLightCmd, 2, function(err, bytes) {
        if (err) {
            if (callback) callback(new Error('read on channel 0 failure'), null);
            return;
        }
        hi = bytes.readUInt8(1);
        lo = bytes.readUInt8(0);
        li = (hi << 8) + lo;
        // console.log(lo, hi);
        callback(null, li);
    });
};

TSL2561.prototype.getLight1 = function(callback) {
    var self = this;
    var readLightCmd = 0x80 | self.registers.lightData1.location;
    var hi = 0;
    var lo = 0;
    var li = 0;

    self.wire.readBytes(readLightCmd, 2, function(err, bytes) {
        if (err) {
            if (callback) callback(new Error('read on channel 1 failure'), null);
            return;
        }
        hi = bytes.readUInt8(1);
        lo = bytes.readUInt8(0);
        li = (hi << 8) + lo;
        // console.log(lo, hi);
        callback(null, li);
    });
};

TSL2561.prototype.getLux = function(callback) {
    var self = this;

    async.series([

            function(cB) {
                self.getLight0(cB);
            },
            function(cB) {
                self.getLight1(cB);
            },
        ],
        function(err, results) {
            //console.log(results)
            var ts = Math.round(+new Date() / 1000);
            var evData = {
                'addr': self.options.address,
                'type': 'TSL2561',
                'valType': 'light',
                'ts': ts,
                'error': err
            };

            if (err) {
                self.emit('sensorValueError', evData);
                if (callback) callback(err, null);
            } else if ((results[0] === 0) || (results[1] === 0)) {
                var e = new Error('invalid value(s) from sensor');
                evData.error = e;
                self.emit('sensorValueError', evData);
                if (callback) callback(e, null);
            } else {
                self.calcLux(results[0], results[1], function(err, result) {
                    evData.sensVal = result;
                    self.emit('newSensorValue', evData);
                    if (callback) callback(null, result);
                });
            }
        });
};

TSL2561.prototype.getAllValues = function(callback) {
    var self = this;

    async.series([

            function(cB) {
                self.getLight0(cB);
            },
            function(cB) {
                self.getLight1(cB);
            },
        ],
        function(err, results) {
            //console.log(results)
            var ts = Math.round(+new Date() / 1000);
            var evData = {
                'addr': self.options.address,
                'type': 'TSL2561',
                'ts': ts,
                'error': err
            };

            if (err) {
                self.emit('sensorValuesError', evData);
                if (callback) callback(err, null);
            } else if ((results[0] === 0) || (results[1] === 0)) {
                var e = new Error('invalid value(s) from sensor');
                evData.error = e;
                self.emit('sensorValuesError', evData);
                if (callback) callback(e, null);
            } else {
                self.calcLux(results[0], results[1], function(err, result) {
                    var devData = {
                        devData: {
                            light: {
                                unit: 'lx',
                                value: result
                            },
                        },
                        rawData: {
                            addr_0x0C: (results[0] & 0x00FF),
                            addr_0x0D: (results[0] >> 8),
                            addr_0x0E: (results[1] & 0x00FF),
                            addr_0x0F: (results[1] >> 8),
                        }
                    };
                    evData.sensValues = devData;
                    self.emit('newSensorValues', evData);
                    if (callback) callback(null, evData);
                });
            }
        });
};

TSL2561.prototype.calcLux = function(ch0, ch1, callback) {
    var self = this;
    var gainMultiplier = 1;
    var timeMultiplier = 1;
    var scaling;
    var lux = 0;
    var channelRatio = 1;

    if (self.options.gainMode === '1') {
        gainMultiplier = 16;
    }
    if (self.options.timingMode === '13.7ms') {
        timeMultiplier = 322 / 11;
    } else {
        if (self.options.timingMode === '101ms') {
            timeMultiplier = 322 / 81;
        }
    }

    scaling = timeMultiplier * gainMultiplier;
    ch0 *= scaling;
    ch1 *= scaling;
    channelRatio = ch1 / ch0;


    if ((self.sensId & 0x40) === 0x40) {
        // T/FN/CL
        if ((0 < channelRatio) && (channelRatio <= 0.50)) {
            lux = 0.0304 * ch0 - 0.062 * ch0 * Math.pow(channelRatio, 1.4);
        } else if ((0.50 < channelRatio) && (channelRatio <= 0.61)) {
            lux = 0.0224 * ch0 - 0.031 * ch1;
        } else if ((0.61 < channelRatio) && (channelRatio <= 0.80)) {
            lux = 0.0128 * ch0 - 0.0153 * ch1;
        } else if ((0.80 < channelRatio) && (channelRatio <= 1.30)) {
            lux = 0.00146 * ch0 - 0.00112 * ch1;
        } else if (channelRatio > 1.30) {
            lux = 0;
        }
    } else {
        // CS
        if ((0 < channelRatio) && (channelRatio <= 0.52)) {
            lux = 0.0315 * ch0 - 0.0593 * ch0 * Math.pow(channelRatio, 1.4);
        } else if ((0.52 < channelRatio) && (channelRatio <= 0.65)) {
            lux = 0.0229 * ch0 - 0.0291 * ch1;
        } else if ((0.65 < channelRatio) && (channelRatio <= 0.80)) {
            lux = 0.0157 * ch0 - 0.0180 * ch1;
        } else if ((0.80 < channelRatio) && (channelRatio <= 1.30)) {
            lux = 0.00338 * ch0 - 0.00260 * ch1;
        } else if (channelRatio > 1.30) {
            lux = 0;
        }
    }
    callback(null, (Math.round(lux * 100) / 100)); // dec val with .xx
};

module.exports = TSL2561;
