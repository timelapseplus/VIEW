
/****************************************************************************
 LICENSE: CC BY-NC-SA 4.0 https://creativecommons.org/licenses/by-nc-sa/4.0/
 This is an original driver by Elijah Parker <mail@timelapseplus.com>
 It is free to use in other projects for non-commercial purposes.  For a
 commercial license and consulting, please contact mail@timelapseplus.com
*****************************************************************************/

var util = require('util');
var async = require('async');
var EventEmitter = require('events').EventEmitter;

var trafficLog = false;

function MIOPS(id) {
    this.btServiceIds = ['0000fff000001000800000805f9b34fb'];

    this._id = id;
    this._cmdCh = null;
    this._notifyCh = null;
    this._dev = null;
    this._moving = false;
    this._watchdog = null;
    this.position = 0; // position offset corrected
    this._pos = 0; // position as reported
    this._positionOffset = 0,
    this._stepsPerDegree = 1280;
    this._stepsPerMM = 10000000 / 866;
    this._backlash = 0;
    this._lastDirection = 0;
    this._backlashOffset = 0;
    this._commandIndex = 1;
    this._movingJoystick = false,
    this._callbacks = {}
}

var COMMANDS = {
    constant: {
        cmd: 0x00,
        bufSize: 20,
        tags: {
            direction: {tag: 0x01, len: 1},
            _initialSpeed: {tag: 0x02, len: 2, val: 1000},
            speed: {tag: 0x03, len: 2},
            _easyIO: {tag: 0x04, len: 1, val: 1},
        }
    },
    moveToStep: {
        bufSize: 16,
        cmd: 0x08,
        tags: {
            targetStep: {tag: 0x18, len: 8},
        }
    },
    getPos: {
        bufSize: 6,
        cmd: 0x0F,
        tags: {}
    },
    stop: {
        bufSize: 6,
        cmd: 0x0B,
        tags: {}
    }
}

var RESPONSES = {
    0x50: 'ack',
    0x54: 'pos'
}

var TAGS = {
    0x00: 'index',
    0x18: 'pos'
}

function readBufInt(buf, index, length) {
    switch(length) {
        case 1: return buf.readUInt8(index);
        case 2: return buf.readInt16BE(index);
        case 4: return buf.readInt32BE(index);
        case 8: return buf.readInt32BE(index + 4); // 32 bits is enough here -- not trying to handle the full 64
        default: return null;
    }
}

function writeBufInt(buf, index, length, value) {
    value = Math.round(value);
    switch(length) {
        case 1: return buf.writeUInt8(value, index);
        case 2: return buf.writeInt16BE(value, index);
        case 4: return buf.writeInt32BE(value, index);
        case 8:
            if(value < 0) {
                buf.writeUInt32BE(0xFFFFFFFF, index);
            } else {
                buf.writeUInt32BE(0, index);
            }
            if (value > 2147483647) value = 2147483647;
            if (value < -2147483648) value = -2147483648;
            return buf.writeInt32BE(value, index + 4);
        default: return null;
    }
}

util.inherits(MIOPS, EventEmitter);

MIOPS.prototype._sendCommand = function(command, args, callback) {
    var self = this;
    var cmd = COMMANDS[command];
    if(!cmd) {
        console.log('MIOPS(' + self._id + '): error invalid command:', command);
        return callback && callback("invalid command");
    }
    var buf = new Buffer(cmd.bufSize);
    var bufIndex = 0;
    buf.writeUInt8(0x00, bufIndex); // chunk
    bufIndex++;
    buf.writeUInt8(cmd.bufSize - 2, bufIndex); // length
    bufIndex++;
    buf.writeUInt8(cmd.cmd, bufIndex); // command
    bufIndex++;
    buf.writeUInt8(0x00, bufIndex); // tag
    bufIndex++;
    buf.writeUInt8(0x01, bufIndex);
    bufIndex++;
    var cbIndex = self._commandIndex;
    buf.writeUInt8(cbIndex, bufIndex);
    self._commandIndex++;
    if(self._commandIndex > 255) self._commandIndex = 1;
    bufIndex++;
    for(var key in cmd.tags) {
        var tag = cmd.tags[key];
        if(args[key] != null || tag.val) {
            writeBufInt(buf, bufIndex, 1, tag.tag);
            bufIndex++;
            writeBufInt(buf, bufIndex, 1, tag.len);
            bufIndex++;
            writeBufInt(buf, bufIndex, tag.len, args[key] || tag.val || 0);
            bufIndex += tag.len;
        } else {
            console.log('MIOPS(' + self._id + '): missing required tag "' + key + '" for command', command);
            return callback && callback("missing required tag");
        }
    }
    self._callbacks[cbIndex.toString()] = callback;
    console.log('MIOPS(' + self._id + '): sending command:', buf);
    self._cmdCh.write(buf, true, function(err) {
        if(err) {
            self._callbacks[cbIndex.toString()] = null;
            callback(err);
        }
    });
}

MIOPS.prototype._parseIncoming = function(data) {
    var self = this;
    if(!data || data.length < 5 || data.readUInt8(0) != 0x00) return; // chunk0
    if(data.length - 2 != data.readUInt8(1)) return; // validate length
    var res = RESPONSES[data.readUInt8(2)];
    if(!res) return;
    var index = 3;
    var callback = null;
    var dataCB = null;
    console.log('MIOPS(' + self._id + '): data received:', data);
    while(index < data.length - 1) {
        var tag = data.readUInt8(index);
        index++;
        var len = data.readUInt8(index);
        index++;
        var tagName = TAGS[tag];
        if(tagName) {
            var tagData = readBufInt(data, index, len);
            index += len;
            if(tagName == 'index' && tagData) { // we ignore zero
                console.log('MIOPS(' + self._id + '): callback for #', tagData.toString());
                callback = self._callbacks[tagData.toString()];
                self._callbacks[tagData.toString()] = null;
            } else {
                dataCB = tagData;
                console.log('MIOPS(' + self._id + '): value received:', dataCB, "for tag", tagName);
                if(tagName == 'pos') {
                    self._pos = tagData;
                    self.position = self.getOffsetPosition();
                    dataCB = self.position;
                }
            }
        } else {
            index += len;
            continue;
        }
    }
    callback && callback(null, dataCB);
}



MIOPS.prototype._connectBt = function(btPeripheral, callback) {
    var self = this;
    btPeripheral.connect(function(err1) {
        if (err1) {
            if (callback) callback(false);
            return;
        }
        console.log('MIOPS(' + self._id + '): connecting via BLE');
        setTimeout(function(){
            btPeripheral.discoverServices(['fff0', 'ffe0'], function(err2, services) {
                //console.log('MIOPS(' + self._id + '): services:', services);
                if (services && services.length > 1) {
                    var depth = 0;
                    var completed = 0;
                    self._notifyCh = null;
                    self._cmdCh = null;
                    self._dev = null;
                    for(var i = 0; i < services.length; i++) {
                        depth++;
                        services[i].discoverCharacteristics([], function(err, characteristics) {
                            completed++;
                            for(var i = 0; i < characteristics.length; i++) {
                                var ch = characteristics[i];
                                console.log('MIOPS(' + self._id + '): ch:', ch.uuid);
                                if(ch.uuid == 'fff5') {
                                    self._cmdCh = ch;
                                }
                                if(ch.uuid == 'ffe2') {
                                    self._notifyCh = ch;
                                }
                            }
                            if (self._notifyCh && self._cmdCh) {
                                try {
                                    self._notifyCh.subscribe(function(){
                                        console.log('MIOPS(' + self._id + "): subscribed...");
                                        self._expectedLength = 0;
                                        self._buf = null;
                                        self._dev = btPeripheral;
                                        self._dev.connected = true;
                                        self.connected = true;
                                        self._dev.type = "bt";
                                        self._watchdog = null;
                                        self._commandIndex = 1;
                                        self._lastDirection = 0;
                                        self._backlashOffset = 0;
                                        self._notifyCh.on('data', function(data, isNotification) {
                                            self._parseIncoming(data);
                                        });
                                        console.log("MIOPS(" + self._id + "): connected!");
                                        self._init();
                                        if (callback) callback(true);
                                        callback = null;
                                    });
                                } catch(err3) {
                                    btPeripheral.disconnect();
                                    console.log("MIOPS(" + self._id + "): exception while connecting: ", err3);
                                    if (callback) callback(false);
                                    callback = null;
                                }
                            } else {
                                if(completed >= 2 && depth == completed) {
                                    console.log("MIOPS(" + self._id + "): couldn't locate characteristics, disconnecting... ", err);
                                    btPeripheral.disconnect();
                                    if (callback) callback(false);
                                    callback = null;
                                }
                            }
                        });
                    }
                } else {
                    console.log("MIOPS(" + self._id + "): couldn't locate services, disconnecting... ", err2);
                    btPeripheral.disconnect();
                    if (callback) callback(false);
                }
            });
        }, 1000);

        btPeripheral.once('disconnect', function() {
            console.log("MIOPS(" + self._id + "): disconnected");
            self._dev = null;
            self.connected = false;
            self._moving = false;
            self._movingJoystick = false;
            self._callbacks = {};
            clearTimeout(self._watchdog);
            self.emit("status", self.getStatus(self));
        });

    });
}

MIOPS.prototype._getPosition = function(callback) {
    var self = this;
    self._sendCommand('getPos', {}, function(err, pos) {
        callback && callback(err, pos || self.position);
    });
}

MIOPS.prototype._init = function() {
    var self = this;
    console.log("MIOPS(" + self._id + "): initializing...");
    self._getPosition(function(err, pos) {
        console.log("MIOPS(" + self._id + "): position (init):", pos);
        self.emit("status", self.getStatus(self));
    });
}


MIOPS.prototype.connect = function(device, callback) {
    if (device && device.connect) {
        this._moving = false;
        this._movingJoystick = false;
        this._callbacks = {};
        console.log("MIOPS(" + this._id + "): connecting...");
        this._connectBt(device, callback);
    } else {
        console.log("MIOPS(" + this._id + "): invalid device, cannot connect");
        if (callback) callback("invalid device");
    }
}

MIOPS.prototype.disconnect = function() {
    console.log("MIOPS(" + this._id + "): disconnecting...");
    if (this._dev && this._dev.connected) {
        this.connected = false;
        this._dev.connected = false;
        this._moving = false;
        this._movingJoystick = false;
        this._callbacks = {};
        clearTimeout(this._watchdog);
        this.emit("status", this.getStatus());
        this._dev.disconnect();
    } else {
        this._dev = null;
    }
    this.emit("status", this.getStatus());
}

MIOPS.prototype.getStatus = function() {
    var self = this;
    var type = (self._dev && self._dev.type) ? self._dev.type : null;
    return {
        connected: (self._dev && self._dev.connected) ? true : false,
        connectionType: type,
        position: self.getOffsetPosition(),
        backlash: self._backlash
    }   
}

MIOPS.prototype.disable = function(motor) {
    this._enabled = false;
}

MIOPS.prototype.enable = function(motor) {
    this._enabled = true;
}

MIOPS.prototype._takeBacklash = function(direction, callback) {
    if(this._lastDirection != 0 && this._lastDirection != direction && this._backlash > 0 && this.direction != 0) {
        this._lastDirection = direction;
        if(this._backlashOffset) {
            this._backlashOffset = 0;
        } else {
            this._backlashOffset = this._backlash * direction;
        }
        this.move(0, this._backlash * direction, callback, null, true);
    } else {
        if(direction) this._lastDirection = direction;
        callback && callback();
    }
}

MIOPS.prototype.move = function(motor, steps, callback, empty, noBacklash) {
    if(noBacklash) {
        console.log("MIOPS(" + this._id + "): taking up backlash by", steps, "steps");
    } else {
        console.log("MIOPS(" + this._id + "): move by", steps, "steps");
    }
    if(steps == 0) return callback && callback(null, this.getOffsetPosition());
    var self = this;
    if(self._movingJoystick) self.constantMove(1, 0);
    var target = self._pos + steps;
    var lastPos = self._pos;
    var dir = 0;
    if(steps > 0) dir = 1;
    if(steps < 0) dir = -1;
    self._moving = true;
    var doMove = function() {
        self._sendCommand('moveToStep', {targetStep: target}, function(err) {
            var check = function() {
                self._getPosition(function(err, pos) {
                    if(lastPos - pos == 0) {
                        self._moving = false;
                        callback && callback(err, pos);
                    } else {
                        lastPos = pos;
                        setTimeout(check, 200);
                    }
                });
            }
            setTimeout(check, 200);
        });
    }
    if(noBacklash) {
        doMove();
    } else {
        self._takeBacklash(dir, doMove);
    }
}

MIOPS.prototype.constantMove = function(motor, speed, callback) {
    if(!this._enabled) this.enable();
    var self = this;
    var range = 10000 - 1001;
    var direction = speed < 0 ? 0 : 1;
    var speedVal = Math.abs(speed / 100) * range + 1001;
    var dir = 0;
    if(speed > 0) dir = 1;
    if(speed < 0) dir = -1;
    console.log("MIOPS(" + this._id + "): moving motor at speed ", speed, "% (", speedVal, direction, ")");

    if(self._watchdog) {
        console.log("MIOPS(" + self._id + "): reset timeout");
        clearTimeout(self._watchdog);
        self._watchdog = null;
    }
    self._takeBacklash(dir, function() {
        self._sendCommand('constant', {direction: direction, speed: speedVal}, function(err) {
            if(speed != 0) callback(err, self.position);

            if(speed == 0) {
                setTimeout(function(){
                    self._movingJoystick = false;
                    self._sendCommand('stop', {});
                    setTimeout(function(){
                        self._getPosition(function(err, pos){
                            callback && callback(err, pos);
                            console.log("MIOPS(" + self._id + "): position ", self.position);
                            self.emit("status", self.getStatus());
                        });
                    }, 100);
                }, 1000);
            } else {
                self._movingJoystick = true;
                self._watchdog = setTimeout(function(){
                    console.log("MIOPS(" + self._id + "): stopping joystick by timeout");
                    self._sendCommand('stop', {});
                    self._movingJoystick = false;
                }, 2000);
            }
        });
    });
}


MIOPS.prototype.getOffsetPosition = function() {
    return this._pos - this._positionOffset - this._backlashOffset;
}

MIOPS.prototype.resetPosition = function(motor, callback) {
    var self = this;
    if(!motor) return callback && callback();
    var check = function() {
        if(self._moving || self._movingJoystick) {
            setTimeout(check, 200); // keep checking until stop
        } else {
            self._positionOffset = self._pos;
            self.position = self.getOffsetPosition();
            self.emit("status", self.getStatus());
            if (callback) callback();
        }
    }
    check();
}

MIOPS.prototype.setPosition = function(motor, position, callback) {
    var self = this;
    if(!motor) return callback && callback();
    var check = function() {
        if(self._moving || self._movingJoystick) {
            setTimeout(check, 200); // keep checking until stop
        } else {
            self._positionOffset = self._pos - position;
            self.position = self.getOffsetPosition();
            self.emit("status", self.getStatus());
            if (callback) callback();
        }
    }
    check();
}

MIOPS.prototype.setBacklash = function(motor, backlash, callback) { // not implemented
    this._backlash = backlash || 0;
    console.log("MIOPS(" + self._id + "): set backlash to", backlash);
    if (callback) callback(0);
}

MIOPS.prototype.getBacklash = function(motor, callback) { // not implemented
    if (callback) callback(this._backlash || 0);
}

module.exports = MIOPS;
