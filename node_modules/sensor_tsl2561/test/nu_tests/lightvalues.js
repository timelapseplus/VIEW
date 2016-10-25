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

/*
 * T/FN/CL package
 */
exports.readAndCalcPowerUpGain1_TFNCL_cb = {
    setUp: function(callback) {
        this.sens = new TSL2561({
            'packageType': 'auto'
        });
        this.sens.wire.idReg = 0x50; // fake a TSL2561T/FN/CL
        this.oldChan0Reg = this.sens.wire.chan0Reg;
        this.oldChan1Reg = this.sens.wire.chan1Reg;
        this.sens.wire.chan0Reg = 0x01F7;
        this.sens.wire.chan1Reg = 0x0170;
        this.sens.init(function(err, val) {
            callback();
        });
    },
    tearDown: function(callback) {
        this.sens.wire.chan0Reg = this.oldChan0Reg;
        this.sens.wire.chan1Reg = this.oldChan1Reg;
        callback();
    },
    'read chan 0 value': function(test) {
        test.expect(2);
        this.sens.getLight0(function(err, val) {
            test.ifError(err);
            test.strictEqual(val, 0x01F7, 'read wrong value from chan 0');
            test.done();
        });
    },
    'read chan 1 value': function(test) {
        test.expect(2);
        this.sens.getLight1(function(err, val) {
            test.ifError(err);
            test.strictEqual(val, 0x0170, 'read wrong value from chan 1');
            test.done();
        });
    },
    'calc lux at powerUp, 402ms, gain 1 ': function(test) {
        test.expect(2);
        this.sens.getLux(function(err, val) {
            test.ifError(err);
            test.strictEqual(val, 12.93, 'calculate a wrong value for lux');
            test.done();
        });
    },
    'get all values at powerUp, 402ms, gain 1 ': function(test) {
        test.expect(2);
        var devData = {
            addr: 57,
            type: 'TSL2561',
            ts: 0,
            error: null,
            sensValues: {
                devData: {
                    light: {
                        unit: 'lx',
                        value: 12.93
                    }
                },
                rawData: {
                    addr_0x0C: 247,
                    addr_0x0D: 1,
                    addr_0x0E: 112,
                    addr_0x0F: 1
                }
            }
        };
        this.sens.getAllValues(function(err, val) {
            test.ifError(err);
            // clone the timestamp :)
            devData.ts = val.ts;
            test.deepEqual(val, devData, 'failure at all values');
            test.done();
        });
    },
    'calc lux at powerUp, 101ms, gain 1 ': function(test) {
        test.expect(3);
        this.sens.wire.chan0Reg = 0x007D;
        this.sens.wire.chan1Reg = 0x005A;
        var self = this;
        this.sens.setTimingMode('101ms', function(err, val) {
            test.ifError(err);
            self.sens.getLux(function(err, val) {
                test.ifError(err);
                test.strictEqual(val, 14.18, 'calculate a wrong value for lux');
                test.done();
            });
        });
    },
    'get all values at powerUp, 101ms, gain 1 ': function(test) {
        test.expect(3);
        var self = this;
        this.sens.wire.chan0Reg = 0x007D;
        this.sens.wire.chan1Reg = 0x005A;
        var devData = {
            addr: 57,
            type: 'TSL2561',
            ts: 0,
            error: null,
            sensValues: {
                devData: {
                    light: {
                        unit: 'lx',
                        value: 14.18
                    }
                },
                rawData: {
                    addr_0x0C: 125,
                    addr_0x0D: 0,
                    addr_0x0E: 90,
                    addr_0x0F: 0
                }
            }
        };
        this.sens.setTimingMode('101ms', function(err, val) {
            test.ifError(err);
            self.sens.getAllValues(function(err, val) {
                test.ifError(err);
                // clone the timestamp :)
                devData.ts = val.ts;
                test.deepEqual(val, devData, 'failure at all values');
                test.done();
            });
        });
    },
    'calc lux at powerUp, 13.7ms, gain 1 ': function(test) {
        test.expect(3);
        var self = this;
        this.sens.wire.chan0Reg = 0x0011;
        this.sens.wire.chan1Reg = 0x000C;
        this.sens.setTimingMode('13.7ms', function(err, val) {
            test.ifError(err);
            self.sens.getLux(function(err, val) {
                test.ifError(err);
                test.strictEqual(val, 15.92, 'calculate a wrong value for lux');
                test.done();
            });
        });
    },
    'get all values at powerUp, 13.7ms, gain 1 ': function(test) {
        test.expect(3);
        var self = this;
        this.sens.wire.chan0Reg = 0x0011;
        this.sens.wire.chan1Reg = 0x000C;
        var devData = {
            addr: 57,
            type: 'TSL2561',
            ts: 0,
            error: null,
            sensValues: {
                devData: {
                    light: {
                        unit: 'lx',
                        value: 15.92
                    }
                },
                rawData: {
                    addr_0x0C: 17,
                    addr_0x0D: 0,
                    addr_0x0E: 12,
                    addr_0x0F: 0
                }
            }
        };
        this.sens.setTimingMode('13.7ms', function(err, val) {
            test.ifError(err);
            self.sens.getAllValues(function(err, val) {
                test.ifError(err);
                // clone the timestamp :)
                devData.ts = val.ts;
                test.deepEqual(val, devData, 'failure at all values');
                test.done();
            });
        });
    },
};

exports.readAndCalcPowerUpGain16_TFNCL_cb = {
    setUp: function(callback) {
        this.sens = new TSL2561({
            'gainMode': '16',
            'packageType': 'auto'
        });
        this.sens.wire.idReg = 0x50; // fake a TSL2561T/FN/CL
        this.oldChan0Reg = this.sens.wire.chan0Reg;
        this.oldChan1Reg = this.sens.wire.chan1Reg;
        this.sens.wire.chan0Reg = 0x1EB0;
        this.sens.wire.chan1Reg = 0x1613;
        this.sens.init(function(err, val) {
            callback();
        });
    },
    tearDown: function(callback) {
        this.sens.wire.chan0Reg = this.oldChan0Reg;
        this.sens.wire.chan1Reg = this.oldChan1Reg;
        callback();
    },
    'read chan 0 value': function(test) {
        test.expect(2);
        this.sens.getLight0(function(err, val) {
            test.ifError(err);
            test.strictEqual(val, 0x1EB0, 'read wrong value from chan 0');
            test.done();
        });
    },
    'read chan 1 value': function(test) {
        test.expect(2);
        this.sens.getLight1(function(err, val) {
            test.ifError(err);
            test.strictEqual(val, 0x1613, 'read wrong value from chan 1');
            test.done();
        });
    },
    'calc lux at powerUp, 402ms, gain 16 ': function(test) {
        test.expect(2);
        this.sens.getLux(function(err, val) {
            test.ifError(err);
            test.strictEqual(val, 14.1, 'calculate a wrong value for lux');
            test.done();
        });
    },
    'get all values at powerUp, 402ms, gain 16 ': function(test) {
        test.expect(2);
        var devData = {
            addr: 57,
            type: 'TSL2561',
            ts: 0,
            error: null,
            sensValues: {
                devData: {
                    light: {
                        unit: 'lx',
                        value: 14.1
                    }
                },
                rawData: {
                    addr_0x0C: 176,
                    addr_0x0D: 30,
                    addr_0x0E: 19,
                    addr_0x0F: 22
                }
            }
        };
        this.sens.getAllValues(function(err, val) {
            test.ifError(err);
            // clone the timestamp :)
            devData.ts = val.ts;
            test.deepEqual(val, devData, 'failure at all values');
            test.done();
        });
    },
    'calc lux at powerUp, 101ms, gain 16 ': function(test) {
        test.expect(3);
        var self = this;
        this.sens.wire.chan0Reg = 0x07B4;
        this.sens.wire.chan1Reg = 0x058B;
        this.sens.setTimingMode('101ms', function(err, val) {
            test.ifError(err);
            self.sens.getLux(function(err, val) {
                test.ifError(err);
                test.strictEqual(val, 14.04, 'calculate a wrong value for lux');
                test.done();
            });
        });
    },
    'get all values at powerUp, 101ms, gain 16 ': function(test) {
        test.expect(3);
        var self = this;
        this.sens.wire.chan0Reg = 0x07B4;
        this.sens.wire.chan1Reg = 0x058B;
        var devData = {
            addr: 57,
            type: 'TSL2561',
            ts: 0,
            error: null,
            sensValues: {
                devData: {
                    light: {
                        unit: 'lx',
                        value: 14.04
                    }
                },
                rawData: {
                    addr_0x0C: 180,
                    addr_0x0D: 7,
                    addr_0x0E: 139,
                    addr_0x0F: 5
                }
            }
        };
        this.sens.setTimingMode('101ms', function(err, val) {
            test.ifError(err);
            self.sens.getAllValues(function(err, val) {
                test.ifError(err);
                // clone the timestamp :)
                devData.ts = val.ts;
                test.deepEqual(val, devData, 'failure at all values');
                test.done();
            });
        });
    },
    'calc lux at powerUp, 13.7ms, gain 16 ': function(test) {
        test.expect(3);
        var self = this;
        this.sens.wire.chan0Reg = 0x010E;
        this.sens.wire.chan1Reg = 0x00C2;
        this.sens.setTimingMode('13.7ms', function(err, val) {
            test.ifError(err);
            self.sens.getLux(function(err, val) {
                test.ifError(err);
                test.strictEqual(val, 14.28, 'calculate a wrong value for lux');
                test.done();
            });
        });
    },
    'get all values at powerUp, 13.7ms, gain 16 ': function(test) {
        test.expect(3);
        var self = this;
        this.sens.wire.chan0Reg = 0x010E;
        this.sens.wire.chan1Reg = 0x00C2;
        var devData = {
            addr: 57,
            type: 'TSL2561',
            ts: 0,
            error: null,
            sensValues: {
                devData: {
                    light: {
                        unit: 'lx',
                        value: 14.28
                    }
                },
                rawData: {
                    addr_0x0C: 14,
                    addr_0x0D: 1,
                    addr_0x0E: 194,
                    addr_0x0F: 0
                }
            }
        };
        this.sens.setTimingMode('13.7ms', function(err, val) {
            test.ifError(err);
            self.sens.getAllValues(function(err, val) {
                test.ifError(err);
                // clone the timestamp :)
                devData.ts = val.ts;
                test.deepEqual(val, devData, 'failure at all values');
                test.done();
            });
        });
    },
};

/*
 * CS package
 */

exports.readAndCalcPowerUpGain1_CS_cb = {
    setUp: function(callback) {
        this.sens = new TSL2561({
            'packageType': 'CS'
        });
        this.sens.wire.idReg = 0x10; // fake a TSL2561CS
        this.oldChan0Reg = this.sens.wire.chan0Reg;
        this.oldChan1Reg = this.sens.wire.chan1Reg;
        this.sens.wire.chan0Reg = 0x01DB;
        this.sens.wire.chan1Reg = 0x0156;
        this.sens.init(function(err, val) {
            callback();
        });
    },
    tearDown: function(callback) {
        this.sens.wire.chan0Reg = this.oldChan0Reg;
        this.sens.wire.chan1Reg = this.oldChan1Reg;
        callback();
    },
    'read chan 0 value': function(test) {
        test.expect(2);
        this.sens.getLight0(function(err, val) {
            test.ifError(err);
            test.strictEqual(val, 0x01DB, 'read wrong value from chan 0');
            test.done();
        });
    },
    'read chan 1 value': function(test) {
        test.expect(2);
        this.sens.getLight1(function(err, val) {
            test.ifError(err);
            test.strictEqual(val, 0x0156, 'read wrong value from chan 1');
            test.done();
        });
    },
    'calc lux at powerUp, 402ms, gain 1 ': function(test) {
        test.expect(2);
        this.sens.getLux(function(err, val) {
            test.ifError(err);
            test.strictEqual(val, 20.82, 'calculate a wrong value for lux');
            test.done();
        });
    },
    'get all values at powerUp, 402ms, gain 1 ': function(test) {
        test.expect(2);
        var devData = {
            addr: 57,
            type: 'TSL2561',
            ts: 0,
            error: null,
            sensValues: {
                devData: {
                    light: {
                        unit: 'lx',
                        value: 20.82
                    }
                },
                rawData: {
                    addr_0x0C: 219,
                    addr_0x0D: 1,
                    addr_0x0E: 86,
                    addr_0x0F: 1
                }
            }
        };
        this.sens.getAllValues(function(err, val) {
            test.ifError(err);
            // clone the timestamp :)
            devData.ts = val.ts;
            test.deepEqual(val, devData, 'failure at all values');
            test.done();
        });
    },
    'calc lux at powerUp, 101ms, gain 1 ': function(test) {
        test.expect(3);
        var self = this;
        this.sens.wire.chan0Reg = 0x0077;
        this.sens.wire.chan1Reg = 0x0056;
        this.sens.setTimingMode('101ms', function(err, val) {
            test.ifError(err);
            self.sens.getLux(function(err, val) {
                test.ifError(err);
                test.strictEqual(val, 20.37, 'calculate a wrong value for lux');
                test.done();
            });
        });
    },
    'get all values at powerUp, 101ms, gain 1 ': function(test) {
        test.expect(3);
        var self = this;
        this.sens.wire.chan0Reg = 0x0077;
        this.sens.wire.chan1Reg = 0x0056;
        var devData = {
            addr: 57,
            type: 'TSL2561',
            ts: 0,
            error: null,
            sensValues: {
                devData: {
                    light: {
                        unit: 'lx',
                        value: 20.37
                    }
                },
                rawData: {
                    addr_0x0C: 119,
                    addr_0x0D: 0,
                    addr_0x0E: 86,
                    addr_0x0F: 0
                }
            }
        };
        this.sens.setTimingMode('101ms', function(err, val) {
            test.ifError(err);
            self.sens.getAllValues(function(err, val) {
                test.ifError(err);
                // clone the timestamp :)
                devData.ts = val.ts;
                test.deepEqual(val, devData, 'failure at all values');
                test.done();
            });
        });
    },
    'calc lux at powerUp, 13.7ms, gain 1 ': function(test) {
        test.expect(3);
        var self = this;
        this.sens.wire.chan0Reg = 0x0010;
        this.sens.wire.chan1Reg = 0x000C;
        this.sens.setTimingMode('13.7ms', function(err, val) {
            test.ifError(err);
            self.sens.getLux(function(err, val) {
                test.ifError(err);
                test.strictEqual(val, 16.49, 'calculate a wrong value for lux');
                test.done();
            });
        });
    },
    'get all values at powerUp, 13.7ms, gain 1 ': function(test) {
        test.expect(3);
        var self = this;
        this.sens.wire.chan0Reg = 0x0010;
        this.sens.wire.chan1Reg = 0x000C;
        var devData = {
            addr: 57,
            type: 'TSL2561',
            ts: 0,
            error: null,
            sensValues: {
                devData: {
                    light: {
                        unit: 'lx',
                        value: 16.49
                    }
                },
                rawData: {
                    addr_0x0C: 16,
                    addr_0x0D: 0,
                    addr_0x0E: 12,
                    addr_0x0F: 0
                }
            }
        };
        this.sens.setTimingMode('13.7ms', function(err, val) {
            test.ifError(err);
            self.sens.getAllValues(function(err, val) {
                test.ifError(err);
                // clone the timestamp :)
                devData.ts = val.ts;
                test.deepEqual(val, devData, 'failure at all values');
                test.done();
            });
        });
    },
};

exports.readAndCalcPowerUpGain16_CS_cb = {
    setUp: function(callback) {
        this.sens = new TSL2561({
            'gainMode': '16',
            'packageType': 'CS'
        });
        this.sens.wire.idReg = 0x10; // fake a TSL2561T/FN/CL
        this.oldChan0Reg = this.sens.wire.chan0Reg;
        this.oldChan1Reg = this.sens.wire.chan1Reg;
        this.sens.wire.chan0Reg = 0x1D7E;
        this.sens.wire.chan1Reg = 0x152B;
        this.sens.init(function(err, val) {
            callback();
        });
    },
    tearDown: function(callback) {
        this.sens.wire.chan0Reg = this.oldChan0Reg;
        this.sens.wire.chan1Reg = this.oldChan1Reg;
        callback();
    },
    'read chan 0 value': function(test) {
        test.expect(2);
        this.sens.getLight0(function(err, val) {
            test.ifError(err);
            test.strictEqual(val, 0x1D7E, 'read wrong value from chan 0');
            test.done();
        });
    },
    'read chan 1 value': function(test) {
        test.expect(2);
        this.sens.getLight1(function(err, val) {
            test.ifError(err);
            test.strictEqual(val, 0x152B, 'read wrong value from chan 1');
            test.done();
        });
    },
    'calc lux at powerUp, 402ms, gain 16 ': function(test) {
        test.expect(2);
        this.sens.getLux(function(err, val) {
            test.ifError(err);
            test.strictEqual(val, 20.99, 'calculate a wrong value for lux');
            test.done();
        });
    },
    'get all values at powerUp, 402ms, gain 16 ': function(test) {
        test.expect(2);
        var devData = {
            addr: 57,
            type: 'TSL2561',
            ts: 0,
            error: null,
            sensValues: {
                devData: {
                    light: {
                        unit: 'lx',
                        value: 20.99
                    }
                },
                rawData: {
                    addr_0x0C: 126,
                    addr_0x0D: 29,
                    addr_0x0E: 43,
                    addr_0x0F: 21
                }
            }
        };
        this.sens.getAllValues(function(err, val) {
            test.ifError(err);
            // clone the timestamp :)
            devData.ts = val.ts;
            test.deepEqual(val, devData, 'failure at all values');
            test.done();
        });
    },
    'calc lux at powerUp, 101ms, gain 16 ': function(test) {
        test.expect(3);
        var self = this;
        this.sens.wire.chan0Reg = 0x076A;
        this.sens.wire.chan1Reg = 0x0552;
        this.sens.setTimingMode('101ms', function(err, val) {
            test.ifError(err);
            self.sens.getLux(function(err, val) {
                test.ifError(err);
                test.strictEqual(val, 21, 'calculate a wrong value for lux');
                test.done();
            });
        });
    },
    'get all values at powerUp, 101ms, gain 16 ': function(test) {
        test.expect(3);
        var self = this;
        this.sens.wire.chan0Reg = 0x076A;
        this.sens.wire.chan1Reg = 0x0552;
        var devData = {
            addr: 57,
            type: 'TSL2561',
            ts: 0,
            error: null,
            sensValues: {
                devData: {
                    light: {
                        unit: 'lx',
                        value: 21
                    }
                },
                rawData: {
                    addr_0x0C: 106,
                    addr_0x0D: 7,
                    addr_0x0E: 82,
                    addr_0x0F: 5
                }
            }
        };
        this.sens.setTimingMode('101ms', function(err, val) {
            test.ifError(err);
            self.sens.getAllValues(function(err, val) {
                test.ifError(err);
                // clone the timestamp :)
                devData.ts = val.ts;
                test.deepEqual(val, devData, 'failure at all values');
                test.done();
            });
        });
    },
    'calc lux at powerUp, 13.7ms, gain 16 ': function(test) {
        test.expect(3);
        var self = this;
        this.sens.wire.chan0Reg = 0x0104;
        this.sens.wire.chan1Reg = 0x00BA;
        this.sens.setTimingMode('13.7ms', function(err, val) {
            test.ifError(err);
            self.sens.getLux(function(err, val) {
                test.ifError(err);
                test.strictEqual(val, 21.49, 'calculate a wrong value for lux');
                test.done();
            });
        });
    },
    'get all values at powerUp, 13.7ms, gain 16 ': function(test) {
        test.expect(3);
        var self = this;
        this.sens.wire.chan0Reg = 0x0104;
        this.sens.wire.chan1Reg = 0x00BA;
        var devData = {
            addr: 57,
            type: 'TSL2561',
            ts: 0,
            error: null,
            sensValues: {
                devData: {
                    light: {
                        unit: 'lx',
                        value: 21.49
                    }
                },
                rawData: {
                    addr_0x0C: 4,
                    addr_0x0D: 1,
                    addr_0x0E: 186,
                    addr_0x0F: 0
                }
            }
        };
        this.sens.setTimingMode('13.7ms', function(err, val) {
            test.ifError(err);
            self.sens.getAllValues(function(err, val) {
                test.ifError(err);
                // clone the timestamp :)
                devData.ts = val.ts;
                test.deepEqual(val, devData, 'failure at all values');
                test.done();
            });
        });
    },
};
