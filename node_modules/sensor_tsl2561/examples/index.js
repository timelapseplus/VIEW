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

var TSL2561 = require('./../tsl2561');
var async = require('async');

var sens = new TSL2561();

sens.on('newSensorValues', function(allData) {
    console.log('received event "newSensorValues" - calculating ...');
    var ir = allData.sensValues.rawData.addr_0x0F << 8 | allData.sensValues.rawData.addr_0x0E;
    var full = allData.sensValues.rawData.addr_0x0D << 8 | allData.sensValues.rawData.addr_0x0C;
    console.log('IR      : ' + ir);
    console.log('FULL    : ' + full);
    console.log('VISIBLE : ' + (full - ir));
    console.log('LUX     : ' + allData.sensValues.devData.light.value);
});

async.series([

        function(cB) {
            sens.init(function(err, val) {
                console.log('sensor init completed');
                cB(null, 'sensor init');
            });
        },
        function(cB) {
            setTimeout(function() {
                sens.getPowerMode(function(err, val) {
                    console.log('power mode is: ' + val);
                    cB(null, 'read power mode');
                });
            }, 1000);
        },
        function(cB) {
            sens.getTimingMode(function(err, val) {
                console.log('timing mode is: ' + val);
                cB(null, 'read timing mode');
            });
        },
        function(cB) {
            sens.getSensorId(function(err, val) {
                console.log('sensor id is: ' + val.type + ' rvision: ' + val.revision);
                cB(null, 'read sensor id');
            });
        },
        function(cB) {
            sens.getGainMode(function(err, val) {
                console.log('sensor gain mode is: ' + val);
                cB(null, 'read gain mode');
            });
        },
        function(cB) {
            setTimeout(function() {
                sens.getLux(function(err, val) {
                    console.log('light value is: ' + val + ' lux');
                    cB(null, 'read sensor value');
                });
            }, 1000);
        },
        function(cB) {
            setTimeout(function() {
                sens.getAllValues(function(err, val) {
                    //console.log(JSON.stringify(val, null, 2));
                    cB(null, 'all sensor values');
                });
            }, 1000);
        },
        function(cB) {
            sens.setPowerMode('powerDown', function(err, val) {
                console.log('power mode is now: ' + val);
                cB(err, 'set power mode to off');
            });
        },
        function(cB) {
            setTimeout(function() {
                sens.getLux(function(err, val) {
                    console.log('light value is: ' + val + ' lux');
                    cB(null, 'read sensor value');
                });
            }, 1000);
        },
        function(cB) {
            sens.setPowerMode('powerUp', function(err, val) {
                console.log('power mode is now: ' + val);
                cB(err, 'set power mode to up');
            });
        },
        function(cB) {
            setTimeout(function() {
                sens.getLux(function(err, val) {
                    console.log('light value is: ' + val + ' lux');
                    cB(null, 'read sensor value');
                });
            }, 1000);
        },
        function(cB) {
            sens.setTimingMode('101ms', function(err, val) {
                console.log('timing mode is now: ' + val);
                cB(err, 'set timing mode to 101ms');
            });
        },
        function(cB) {
            setTimeout(function() {
                sens.getLux(function(err, val) {
                    console.log('light value is: ' + val + ' lux');
                    cB(null, 'read sensor value');
                });
            }, 1000);
        },
        function(cB) {
            sens.setTimingMode('13.7ms', function(err, val) {
                console.log('timing mode is now: ' + val);
                cB(err, 'set timing mode to 13.7ms');
            });
        },
        function(cB) {
            setTimeout(function() {
                sens.getLux(function(err, val) {
                    console.log('light value is: ' + val + ' lux');
                    cB(null, 'read sensor value');
                });
            }, 1000);
        },
        function(cB) {
            sens.setGainMode('16', function(err, val) {
                console.log('gain mode is now: ' + val);
                cB(err, 'set gain mode to 16');
            });
        },
        function(cB) {
            setTimeout(function() {
                sens.getLux(function(err, val) {
                    console.log('light value is: ' + val + ' lux');
                    cB(null, 'read sensor value');
                });
            }, 1000);
        },
        function(cB) {
            sens.getTimingMode(function(err, val) {
                console.log('timing mode is: ' + val);
                cB(null, 'read timing mode');
            });
        },
        function(cB) {
            sens.setGainMode('1', function(err, val) {
                console.log('gain mode is now: ' + val);
                cB(err, 'set gain mode to 1');
            });
        },
        function(cB) {
            setTimeout(function() {
                sens.getLux(function(err, val) {
                    console.log('light value is: ' + val + ' lux');
                    cB(null, 'read sensor value');
                });
            }, 1000);
        },
        function(cB) {
            sens.getTimingMode(function(err, val) {
                console.log('timing mode is: ' + val);
                cB(null, 'read timing mode');
            });
        },
        function(cB) {
            sens.setTimingMode('402ms', function(err, val) {
                console.log('timing mode is now: ' + val);
                cB(err, 'set timing mode to 402ms');
            });
        },
        function(cB) {
            setTimeout(function() {
                sens.getLux(function(err, val) {
                    console.log('light value is: ' + val + ' lux');
                    cB(null, 'read sensor value');
                });
            }, 1000);
        },
    ],
    function(err, results) {
        console.log(err);
        console.log('finished');
    });
