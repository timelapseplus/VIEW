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

var sens = new TSL2561({
    'timingMode': '402ms',
    'gainMode': '1',
    'packageType': 'auto'
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
                sens.getAllValues(function(err, val) {
                    console.log(JSON.stringify(val, null, 2));
                    cB(err, 'all sensor values');
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
                sens.getAllValues(function(err, val) {
                    console.log(JSON.stringify(val, null, 2));
                    cB(err, 'all sensor values');
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
                sens.getAllValues(function(err, val) {
                    console.log(JSON.stringify(val, null, 2));
                    cB(err, 'all sensor values');
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
            sens.setTimingMode('402ms', function(err, val) {
                console.log('timing mode is now: ' + val);
                cB(err, 'set timing mode to 402ms');
            });
        },
        function(cB) {
            setTimeout(function() {
                sens.getAllValues(function(err, val) {
                    console.log(JSON.stringify(val, null, 2));
                    cB(err, 'all sensor values');
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
                sens.getAllValues(function(err, val) {
                    console.log(JSON.stringify(val, null, 2));
                    cB(err, 'all sensor values');
                });
            }, 1000);
        },
        function(cB) {
            sens.setTimingMode('13.7ms', function(err, val) {
                console.log('timing mode is now: ' + val);
                cB(err, 'all sensor values');
            });
        },
        function(cB) {
            setTimeout(function() {
                sens.getAllValues(function(err, val) {
                    console.log(JSON.stringify(val, null, 2));
                    cB(err, 'all sensor values');
                });
            }, 1000);
        },
    ],
    function(err, results) {
        console.log(err);
        console.log('finished');
    });
