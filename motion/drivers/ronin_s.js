
/****************************************************************************
 LICENSE: CC BY-NC-SA 4.0 https://creativecommons.org/licenses/by-nc-sa/4.0/
 This is an original driver by Elijah Parker <mail@timelapseplus.com>
 It is free to use in other projects for non-commercial purposes.  For a
 commercial license and consulting, please contact mail@timelapseplus.com
*****************************************************************************/

var util = require('util');
var async = require('async');
var EventEmitter = require('events').EventEmitter;

function Ronin(id) {
    this.btServiceIds = ['fff0'];

    this._id = id;
    this._cmdCh = null;
    this._notifyCh = null;
    this._dev = null;
    this._buf = null;
    this._moving = false;
    this._angle = null;
    this._expectedLength = 0;
    this._posTimer = null;
    this.pan = 0;
    this.tilt = 0;
    this.roll = 0;
    this._stepsPerDegree = 1;
    this._backlash = 0;
    this._lastDirection = 0;
    this._commandIndex = 0;
}

util.inherits(Ronin, EventEmitter);


Ronin.prototype._connectBt = function(btPeripheral, callback) {
    var self = this;
    btPeripheral.connect(function(err1) {
        if (err1) {
            if (callback) callback(false);
            return;
        }
        console.log('Ronin(' + self._id + '): connecting via BLE');
        setTimeout(function(){
            btPeripheral.discoverServices(['fff0'], function(err2, services) {
                if (services && services[0]) {
                    services[0].discoverCharacteristics([], function(err, characteristics) {
                        self._notifyCh = null;
                        self._cmdCh = null;
                        self._dev = null;
                        for(var i = 0; i < characteristics.length; i++) {
                            var ch = characteristics[i];
                            if(ch.uuid == 'fff4') {
                                self._notifyCh = ch;
                            }

                            if(ch.uuid == 'fff5') {
                                self._cmdCh = ch;
                            }
                        }
                        if (self._notifyCh && self._cmdCh) {
                            try {
                                self._notifyCh.subscribe(function(){
                                    console.log('Ronin(' + self._id + "):subscribed...");
                                    self._expectedLength = 0;
                                    self._buf = null;
                                    self._dev = btPeripheral;
                                    self._dev.connected = true;
                                    self.connected = true;
                                    self._dev.type = "bt";
                                    self._posTimer = null;
                                    self._commandIndex = 0;
                                    self._notifyCh.on('data', function(data, isNotification) {
                                        self._parseIncoming(data);
                                    });
                                    console.log("Ronin(" + self._id + "): connected!");
                                    self._init();
                                    if (callback) callback(true);
                                });
                            } catch(err3) {
                                btPeripheral.disconnect();
                                console.log("Ronin(" + self._id + "): exception while connecting: ", err3);
                                if (callback) callback(false);
                            }
                        } else {
                            console.log("Ronin(" + self._id + "): couldn't locate characteristics, disconnecting... ", err);
                            btPeripheral.disconnect();
                            if (callback) callback(false);
                        }
                        //console.log("characteristics:", characteristics);
                    });
                }
            });
        }, 1000);

        btPeripheral.once('disconnect', function() {
            console.log("Ronin(" + self._id + "): disconnected");
            self._dev = null;
            self.connected = false;
            self._moving = false;
            clearTimeout(self._posTimer);
            clearTimeout(self._pollTimer);
            self.emit("status", self.getStatus());
        });

    });
}

Ronin.prototype._pollPositions = function(self) {
    if(self._pollTimer) clearTimeout(self._pollTimer);
    self._write(new Buffer("046602e5c70080000e00", 'hex'), function(err) {
        if(self.connected) self._pollTimer = setTimeout(function() {
            self._pollPositions(self);
        }, 2000);
    }); // get positions
}

Ronin.prototype._init = function() {
    var self = this;
    self._write(new Buffer("0433020e0200400001", 'hex'));
    self._write(new Buffer("046602e5030040003211", 'hex'));
    self._write(new Buffer("043302040400400001", 'hex'));
    self._write(new Buffer("04330227050040070e", 'hex'));
    self._write(new Buffer("043302040600400001", 'hex'));
    self._write(new Buffer("046602e5080040003211", 'hex'));
    self._write(new Buffer("043302240900400001", 'hex'));
    self._write(new Buffer("043302440a00400001", 'hex'));
    self._write(new Buffer("043302640b00400001", 'hex'));
    self._write(new Buffer("046602e50c0080000e00", 'hex'));
    self._write(new Buffer("043302e50d00400001", 'hex'));
    self._write(new Buffer("046602e5070080000e00", 'hex'));
    self._write(new Buffer("043302c50e00400001", 'hex'));
    self._write(new Buffer("046602e5080040003211", 'hex'));
    self._write(new Buffer("047502e50f00400412660cc01d103e01000050", 'hex'));
    self._write(new Buffer("046602e5100080000e00", 'hex'));
    self._write(new Buffer("0433020e1100400001", 'hex'));
    self._write(new Buffer("043302271200400001", 'hex'));
    self._write(new Buffer("043302261300400001", 'hex'));
    self._write(new Buffer("047502e51400400412660cc01d103e01000050", 'hex'));
    self._write(new Buffer("046602e5150080000e00", 'hex'));
    self._write(new Buffer("047502e51600400412660cc01d103e01000050", 'hex'));
    self._write(new Buffer("0433020b1700400001", 'hex'));
    self._write(new Buffer("046602e5180080000e00", 'hex'));
    setTimeout(function() {
        self._pollPositions(self);
        self.emit("status", self.getStatus());
    }, 2000);
}

// 0  1  2  3  4  5  6  7  8  9  10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25 26 27 28 29 30 31 32 33 34 35 36 37 38 39 40 41 42 43
// 55 2c 04 36 e5 02 bf 6c 00 04 66 01 06 01 01 07 01 01 08 01 01 0a 01 00 0b 01 00 0c 01 00 22 02 05 00 23 02 00 00 24 02 be fe 6c 16

Ronin.prototype._parseIncoming = function(data) {
    if(!data || data.length == 0) return;
    if(this._expectedLength == 0 && data.readUInt8(0) == 0x55) {
        this._expectedLength = data.readUInt8(1);
        //console.log("this._expectedLength =", this._expectedLength);
        this._buf = data;
    } else {
        this._buf = Buffer.concat([this._buf, data]);
    }
    if(this._buf.length >= this._expectedLength) {
        console.log("Ronin(" + this._id + "): received", this._buf);
        var receivedPositions = false;
        var tPos = 0, rPos = 0, pPos = 0;
        for(var i = 0; i < this._buf.length; i++) {
            if(this._buf.readUInt16LE(tPos) == 0x0222) {
                if(i + 9 < this._buf.length) {
                    tPos = i;
                    rPos = i + 4;
                    pPos = i + 8;
                }
                break;
            }            
        }
        if(tPos > 0) {
            if(this._buf.readUInt16LE(tPos) == 0x0222 && this._buf.readUInt16LE(rPos) == 0x0223 && this._buf.readUInt16LE(pPos) == 0x0224) {
                var tilt = this._buf.readInt16LE(tPos + 2) / 10;
                var roll = this._buf.readInt16LE(rPos + 2) / 10;
                var pan = this._buf.readInt16LE(pPos + 2) / 10;
                if(tilt != this.tilt || roll != this.roll || pan != this.pan) {
                    this._moving = true;
                    if(this._posTimer) clearTimeout(this._posTimer);
                    var self = this;
                    this._posTimer = setTimeout(function() { 
                        self._posTimer = null;
                        self._pollPositions(self);
                    }, 1000);
                } else {
                    this._moving = false;
                }
                var emitUpdate = false;
                if(this.pan != pan) emitUpdate = true;
                if(this.tilt != tilt) emitUpdate = true;
                if(this.roll != roll) emitUpdate = true;
                this.pan = pan;
                this.tilt = tilt;
                this.roll = roll;
                if(emitUpdate) {
                    console.log("Ronin(" + this._id + "): POSITIONS:", pan, tilt, roll);
                    this.emit("status", this.getStatus());
                }
            }
        } else if(this._expectedLength == 0x11) {
            if(this._buf.readUInt16LE(10) == 0x10f1 && this._buf.readUInt8(12) == 0x40) { // moved
                this._pollPositions(this);
            } else if(this._buf.readUInt16LE(10) == 0x10f1 && this._buf.readUInt8(12) == 0x0c) { // not moving
                this._moving = false;
            }
        } else if(this._expectedLength == 0x0e) {
            if(this._buf.readUInt16LE(9) == 0x1404 || this._buf.readUInt16LE(9) == 0xe00a) { // moved
                this._pollPositions(this);
            }
        }
        this._expectedLength = 0;
        //console.log("BT data received:", this._buf);
    }
    if(this._buf.length > 255) {
        this._expectedLength = 0;
    }
}

Ronin.prototype.connect = function(device, callback) {
    if (device && device.connect) {
        this._moving = false;
        console.log("Ronin(" + this._id + "): connecting...");
        this._connectBt(device, callback);
    } else {
        console.log("Ronin(" + this._id + "): invalid device, cannot connect");
        if (callback) callback("invalid device");
    }
}

Ronin.prototype.disconnect = function() {
    console.log("Ronin(" + this._id + "): disconnecting...");
    if (this._dev && this._dev.connected) {
        this.connected = false;
        this._dev.connected = false;
        this._moving = false;
        clearTimeout(this._posTimer);
        clearTimeout(this._pollTimer);
        this.emit("status", this.getStatus());
        this._dev.disconnect();
    } else {
        this._dev = null;
    }
    this.emit("status", this.getStatus());
}

Ronin.prototype.getStatus = function() {
    var type = (this._dev && this._dev.type) ? this._dev.type : null;
    return {
        connected: this._dev && this._dev.connected,
        connectionType: type,
        panPos: this.pan,
        tiltPos: this.tilt,
        rollPos: this.roll,
        backlash: this._backlash
    }   
}

Ronin.prototype.disable = function(motor) {
    this._enabled = false;
}

Ronin.prototype.enable = function(motor) {
    this._enabled = true;
}

Ronin.prototype.move = function(motor, degrees, callback) {
    var self = this;
    var pan = motor == 1 ? degrees : 0;
    var tilt = motor == 2 ? degrees : 0;
    var roll = motor == 3 ? degrees : 0;

    var checkEnd = function() {
        if(self._moving) {
            setTimeout(checkEnd, 200); // keep checking until stop
        } else {
            var pos = 0;
            if(motor == 1) pos = self.pan;
            if(motor == 2) pos = self.tilt;
            if(motor == 3) pos = self.roll;
            self._panTarget = null;
            self._tiltTarget = null;
            self._rollTarget = null;
            if (callback) callback(null, pos);
        }
    }

    var checkStart = function() {
        if(self._moving) {
            if(self._panTarget != null || self._tiltTarget != null || self._rollTarget != null) { // override exisiting move with current target
                pan += self._panTarget != null ? self._panTarget : self.pan;
                tilt += self._tiltTarget != null ? self._tiltTarget : self.tilt;
                roll += self._rollTarget != null ? self._rollTarget : self.roll;
            } else {
                return setTimeout(checkStart, 200); // keep checking until stop
            }
        } else {
            pan += self.pan;
            tilt += self.tilt;
            roll += self.roll;
        }
        pan = (((pan + 180) % 360) - 180) * (pan < 0 ? -1 : 1); 
        tilt = (((tilt + 180) % 360) - 180) * (tilt < 0 ? -1 : 1); 
        if(motor == 3) {
            roll = (((roll + 180) % 360) - 180) * (roll < 0 ? -1 : 1); 
        } else {
            roll = false;
        } 
        self._moving = true;
        self._moveAbsolute(pan, tilt, roll, function(){
            checkEnd();
        });
    }
    checkStart();
}


Ronin.prototype._write = function(buffer, callback) {
    var buf = new Buffer('5500', 'hex');
    buf = Buffer.concat([buf, buffer]);
    this._commandIndex++;
    if(this._commandIndex > 0xFF) this._commandIndex = 0x00;
    buf.writeUInt8(buf.length + 2, 1);
    buf.writeUInt8(this._commandIndex, 6);
    var chksm = new Buffer('0000', 'hex');
    chksm.writeUInt16LE(crc(buf.slice(2), crcInitFromLength(buf.length + 2, this)), 0);
    buf = Buffer.concat([buf, chksm]);
    console.log("Ronin(" + this._id + "): writing", buf);
    try {
        var startIndex = 0;
        while(buf.length - startIndex > 0) {
            var nb = buf.slice(startIndex, startIndex + 20);
            //console.log("Ronin(" + this._id + "): writing chunk", nb);
            this._cmdCh.write(nb);
            startIndex += nb.length;
        }
        callback && callback();
    } catch(e) {
        console.log("Ronin(" + this._id + "): ERROR", e);
        callback && callback(e);
    }
}

Ronin.prototype._buildMoveCommand = function(pan, tilt, roll, mode) {

    var mode_flags = 0x01044000; // relative move   
    var other_flags = roll === false ? 0x1405 : 0x0000;

    if(mode == 'absolute') {
        if(pan < 0) pan = 0;
        if(pan > 0xFFFF) pan = 0xFFFF;
        if(tilt < 0) tilt = 0;
        if(tilt > 0xFFFF) tilt = 0xFFFF;
        if(roll < 0) roll = 0;
        if(roll > 0xFFFF) roll = 0xFFFF;
        pan = Math.round(pan);
        tilt = Math.round(tilt);
        roll = Math.round(roll);
        mode_flags = 0x14044000; // absolute move
    } else {
        if(pan > 1) pan = 1;
        if(pan < -1) pan = -1; 
        if(tilt > 1) tilt = 1;
        if(tilt < -1) tilt = -1; 
        if(roll > 1) roll = 1;
        if(roll < -1) roll = -1;
        pan = Math.round(pan * 512 + 1024);
        tilt = Math.round(tilt * 512 + 1024);
        roll = Math.round(roll * 512 + 1024); 
        if(mode == 'joystick') mode_flags = 0x01044001; // joystick move 
    }
      
    var buf = new Buffer('04a9020400004004010004000400040000', 'hex');

    buf.writeUInt32LE(mode_flags, 5);
    buf.writeUInt16LE(tilt, 9);
    buf.writeUInt16LE(roll, 11);
    buf.writeUInt16LE(pan, 13);
    buf.writeUInt16LE(other_flags, 15);

    return buf;
}

Ronin.prototype._moveAbsolute = function(pan, tilt, roll, callback) {
    console.log("Ronin(" + this._id + "): move absolute:", pan, tilt);
    pan *= 10;
    tilt *= 10;
    if(roll !== false) {
        roll *= 10;
    } else {
        var tmp = pan;
        pan = tilt;
        tilt = tmp;
    }
    this._write(this._buildMoveCommand(pan, tilt, false, 'absolute'), callback);
}

Ronin.prototype._moveRelative = function(pan, tilt, roll, callback) {
    pan /= 10;
    tilt /= 10;
    console.log("Ronin(" + this._id + "): move relative:", pan, tilt);
    this._write(this._buildMoveCommand(pan, tilt, false, 'relative'), callback);
}

Ronin.prototype._moveJoystick = function(pan, tilt, roll, callback) {
    this._write(this._buildMoveCommand(pan, tilt, false, 'joystick'), callback);
}


Ronin.prototype.constantMove = function(motor, speed, callback) {
    console.log("Ronin(" + this._id + "): moving motor at speed ", speed, "%");
    if(!this._enabled) this.enable();

    var self = this;
    this._moving = true;

    if(this._watchdog) {
        clearTimeout(this._watchdog);
        this._watchdog = null;
    }
    if(this._timerMove1) {
        clearTimeout(this._timerMove1);
        this._timerMove1 = null;
    }
    if(this._timerMove2) {
        clearTimeout(this._timerMove2);
        this._timerMove2 = null;
    }
    if(this._timerMove3) {
        clearTimeout(this._timerMove3);
        this._timerMove3 = null;
    }
    if(speed) {
        speed /= 100;
        var pan = motor == 1 ? speed : 0;
        var tilt = motor == 2 ? speed : 0;
        var roll = motor == 3 ? speed : 0;
        self._moveJoystick(pan, tilt, roll, callback)
        this._timerMove1 = setTimeout(function(){self._moveJoystick(pan, tilt, roll, null);}, 250);
        this._timerMove2 = setTimeout(function(){self._moveJoystick(pan, tilt, roll, null);}, 500);
        this._timerMove3 = setTimeout(function(){self._moveJoystick(pan, tilt, roll, null);}, 750);

        this._watchdog = setTimeout(function(){
            console.log("Ronin(" + self._id + "): stopping via watchdog");
            self._moveJoystick(0, 0, 0, null);
            self._pollPositions(self);
        }, 3000);
    } else {
        self._moveJoystick(0, 0, 0, null);
        this._timerMove1 = setTimeout(function(){self._moveJoystick(0, 0, 0, null);}, 250);
        this._timerMove2 = setTimeout(function(){self._moveJoystick(0, 0, 0, null);}, 500);
        this._timerMove3 = setTimeout(function(){self._moveJoystick(0, 0, 0, null);}, 750);
        self._pollPositions(self);
        var check = function() {
            if(self._moving) {
                setTimeout(check, 200); // keep checking until stop
            } else {
                var pos = 0;
                if(motor == 1) pos = self.pan;
                if(motor == 2) pos = self.tilt;
                if(motor == 3) pos = self.roll;
                if (callback) callback(null, pos);
            }
        }
        check();
    }
}

Ronin.prototype.resetMotorPosition = function(motor, callback) { // needs work
    var self = this;
    var check = function() {
        if(self._moving) {
            setTimeout(check, 200); // keep checking until stop
        } else {
            self._position = 0;
            if (callback) callback();
        }
    }
    check();
}

Ronin.prototype.setMotorPosition = function(motor, position, callback) { // needs work
    var self = this;
    var check = function() {
        if(self._moving) {
            setTimeout(check, 200); // keep checking until stop
        } else {
            self._position = position;
            if (callback) callback();
        }
    }
    check();
}

Ronin.prototype.setMotorBacklash = function(motor, backlash, callback) {
    if (callback) callback(0);
}

Ronin.prototype.getMotorBacklash = function(motor, callback) {
    if (callback) callback(0);
}

module.exports = Ronin;


var crcTable = [
    0x0000, 0x1021, 0x2042, 0x3063, 0x4084, 0x50A5, 0x60C6, 0x70E7,
    0x8108, 0x9129, 0xA14A, 0xB16B, 0xC18C, 0xD1AD, 0xE1CE, 0xF1EF, 
    0x1231, 0x0210, 0x3273, 0x2252, 0x52B5, 0x4294, 0x72F7, 0x62D6,
    0x9339, 0x8318, 0xB37B, 0xA35A, 0xD3BD, 0xC39C, 0xF3FF, 0xE3DE, 
    0x2462, 0x3443, 0x0420, 0x1401, 0x64E6, 0x74C7, 0x44A4, 0x5485,
    0xA56A, 0xB54B, 0x8528, 0x9509, 0xE5EE, 0xF5CF, 0xC5AC, 0xD58D, 
    0x3653, 0x2672, 0x1611, 0x0630, 0x76D7, 0x66F6, 0x5695, 0x46B4,
    0xB75B, 0xA77A, 0x9719, 0x8738, 0xF7DF, 0xE7FE, 0xD79D, 0xC7BC, 
    0x48C4, 0x58E5, 0x6886, 0x78A7, 0x0840, 0x1861, 0x2802, 0x3823,
    0xC9CC, 0xD9ED, 0xE98E, 0xF9AF, 0x8948, 0x9969, 0xA90A, 0xB92B, 
    0x5AF5, 0x4AD4, 0x7AB7, 0x6A96, 0x1A71, 0x0A50, 0x3A33, 0x2A12,
    0xDBFD, 0xCBDC, 0xFBBF, 0xEB9E, 0x9B79, 0x8B58, 0xBB3B, 0xAB1A, 
    0x6CA6, 0x7C87, 0x4CE4, 0x5CC5, 0x2C22, 0x3C03, 0x0C60, 0x1C41,
    0xEDAE, 0xFD8F, 0xCDEC, 0xDDCD, 0xAD2A, 0xBD0B, 0x8D68, 0x9D49, 
    0x7E97, 0x6EB6, 0x5ED5, 0x4EF4, 0x3E13, 0x2E32, 0x1E51, 0x0E70,
    0xFF9F, 0xEFBE, 0xDFDD, 0xCFFC, 0xBF1B, 0xAF3A, 0x9F59, 0x8F78, 
    0x9188, 0x81A9, 0xB1CA, 0xA1EB, 0xD10C, 0xC12D, 0xF14E, 0xE16F,
    0x1080, 0x00A1, 0x30C2, 0x20E3, 0x5004, 0x4025, 0x7046, 0x6067, 
    0x83B9, 0x9398, 0xA3FB, 0xB3DA, 0xC33D, 0xD31C, 0xE37F, 0xF35E,
    0x02B1, 0x1290, 0x22F3, 0x32D2, 0x4235, 0x5214, 0x6277, 0x7256, 
    0xB5EA, 0xA5CB, 0x95A8, 0x8589, 0xF56E, 0xE54F, 0xD52C, 0xC50D,
    0x34E2, 0x24C3, 0x14A0, 0x0481, 0x7466, 0x6447, 0x5424, 0x4405, 
    0xA7DB, 0xB7FA, 0x8799, 0x97B8, 0xE75F, 0xF77E, 0xC71D, 0xD73C,
    0x26D3, 0x36F2, 0x0691, 0x16B0, 0x6657, 0x7676, 0x4615, 0x5634, 
    0xD94C, 0xC96D, 0xF90E, 0xE92F, 0x99C8, 0x89E9, 0xB98A, 0xA9AB,
    0x5844, 0x4865, 0x7806, 0x6827, 0x18C0, 0x08E1, 0x3882, 0x28A3, 
    0xCB7D, 0xDB5C, 0xEB3F, 0xFB1E, 0x8BF9, 0x9BD8, 0xABBB, 0xBB9A,
    0x4A75, 0x5A54, 0x6A37, 0x7A16, 0x0AF1, 0x1AD0, 0x2AB3, 0x3A92, 
    0xFD2E, 0xED0F, 0xDD6C, 0xCD4D, 0xBDAA, 0xAD8B, 0x9DE8, 0x8DC9,
    0x7C26, 0x6C07, 0x5C64, 0x4C45, 0x3CA2, 0x2C83, 0x1CE0, 0x0CC1, 
    0xEF1F, 0xFF3E, 0xCF5D, 0xDF7C, 0xAF9B, 0xBFBA, 0x8FD9, 0x9FF8,
    0x6E17, 0x7E36, 0x4E55, 0x5E74, 0x2E93, 0x3EB2, 0x0ED1, 0x1EF0
];

//var crcInit = 0xDC29; // 0x15 length
//var crcInit = 0x965c; // 0x0e length

var finalXor = 0x0000;

function crcInitFromLength(len, self) {
    switch(len) {
        case 0x23:
            return 0x7103;
        case 0x1b:
            return 0xe7cc;
        case 0x15:
            return 0xDC29;
        case 0x0e:
            return 0x965c;
        case 0x0d:
            return 0x4f10;
        default:
            console.log('Ronin(' + self._id + "): no crc init for length", len);
    }
    return 0;
}

function rf8(val, width) {
        var resByte = 0;
        for (var i = 0; i < 8; i++) {
            if ((val & (1 << i)) != 0) {
                resByte |= ((1 << (7 - i)) & 0xFF);
            }
        }
        return resByte;
}
function rf16(val, width) {
        var resByte = 0;
        for (var i = 0; i < 16; i++) {
            if ((val & (1 << i)) != 0) {
                resByte |= ((1 << (15 - i)) & 0xFFFF);
            }
        }
        return resByte;
}
function crc(bufData, crcInit) {
    var crc16 = crcInit;
    for(var i = 0; i < bufData.length; i++) {
        var curByte = bufData.readUInt8(i) & 0xFF;
        curByte = rf8(curByte);
        crc16 = (crc16 ^ (curByte << 8)) & 0xFFFF;
        var pos = (crc16 >> 8) & 0xFF;
        crc16 = (crc16 << 8) & 0xFFFF;
        crc16 = (crc16 ^ crcTable[pos]) & 0xFFFF;
    }
    crc16 = rf16(crc16);
    return (crc16 ^ finalXor) & 0xFFFF;
} 

