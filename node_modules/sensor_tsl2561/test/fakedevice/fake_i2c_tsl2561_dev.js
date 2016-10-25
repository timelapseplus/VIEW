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

var i2cFakeDev = function(addr, opts) {
    var self = this;
    self.addr = addr;
    self.ctrlReg = 0x00;
    self.timingReg = 0x00;
    self.idReg = 0x50; // fake a TSL2561T/FN/CL
    self.chan0Reg = 0x01F7;
    self.chan1Reg = 0x0170;
};

i2cFakeDev.prototype.readBytes = function(cmd, len, callback) {
    var self = this;
    var buf = new Buffer(len);
    var err = null;

    switch (cmd) {
        case 0x80: // ctrl reg
            buf.writeUInt8(self.ctrlReg, 0);
            if (len !== 1) err = new Error('wrong len in readBytes for faked device');
            break;
        case 0x81: // timing reg
            buf.writeUInt8(self.timingReg, 0);
            if (len !== 1) err = new Error('wrong len in readBytes for faked device');
            break;
        case 0x8A: // id reg
            buf.writeUInt8(self.idReg, 0);
            if (len !== 1) err = new Error('wrong len in readBytes for faked device');
            break;
        case 0x8C: // chn0 reg, 16 bit, one read
            buf.writeUInt16LE(self.chan0Reg, 0);
            if (len !== 2) err = new Error('wrong len in readBytes for faked device');
            break;
        case 0x8E: // chn1 reg, 16 bit, one read
            buf.writeUInt16LE(self.chan1Reg, 0);
            if (len !== 2) err = new Error('wrong len in readBytes for faked device');
            break;
        default:
            buf.writeUInt8(0, 0);
            err = new Error('not implemented in fake device');
    }

    callback(err, buf);
};

i2cFakeDev.prototype.writeBytes = function(cmd, data, callback) {
    var self = this;

    if (data.length !== 1) {
        callback(new Error('wrong data len in writeBytes for faked device'));
    }

    switch (cmd) {
        case 0x80: // ctrl reg
            self.ctrlReg = data[0];
            break;
        case 0x81: // timing reg
            self.timingReg = data[0];
            break;
        case 0x8A: // id reg
            self.idReg = data[0];
            break;
    }
    callback(null);
};

module.exports = i2cFakeDev;
