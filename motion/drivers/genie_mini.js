var util = require('util');
var EventEmitter = require('events').EventEmitter;

function GenieMini() {
    this.btServiceIds = ['f000474d04514000b000000000000000'];

    this._gmCh = null;
    this._dev = null;
    this._moving = false;
    this._angle = null;
    this._position = 0;
    this._currentMove = null;
    this._stepsPerDegree = 186.56716418;
}

util.inherits(GenieMini, EventEmitter);

GenieMini.prototype._connectBt = function(btPeripheral, callback) {
    var self = this;
    btPeripheral.connect(function(err1) {
        if (err1) {
            if (callback) callback(false);
            return;
        }
        console.log('GenieMini: connecting via BLE');
        btPeripheral.discoverServices(self.btServiceIds, function(err2, services) {
            if (services && services[0]) {
                services[0].discoverCharacteristics([], function(err, characteristics) {
                    //console.log("characteristics:", characteristics);
                    self._gmCh = null;
                    self._dev = null;
                    for (var i = 0; i < characteristics.length; i++) {
                        ch = characteristics[i];
                        console.log("ch.uuid", ch.uuid);
                        if (ch.uuid == "2") {
                            self._gmCh = ch;
                        }
                    }
                    if (self._gmCh) {
                        self._gmCh.write(new Buffer("012600", 'hex'));
                        self._gmCh.subscribe(function(){
                            self._dev = btPeripheral;
                            self._dev.connected = true;
                            self.connected = true;
                            self._dev.type = "bt";
                            self._gmCh.on('data', function(data, isNotification) {
                                self._parseIncoming(data);
                            });
                            console.log("GenieMini: connected!");
                            self._init();
                            if (callback) callback(true);
                        });
                    } else {
                        btPeripheral.disconnect();
                        if (callback) callback(false);
                    }
                });
            } else {
                btPeripheral.disconnect();
                if (callback) callback(false);
            }

        });

        btPeripheral.once('disconnect', function() {
            console.log("GenieMini: disconnected");
            self._dev = null;
            self.connected = false;
            self.emit("status", self.getStatus());
        });

    });

}

GenieMini.prototype._init = function() {
    this.emit("status", this.getStatus());
}

GenieMini.prototype._parseIncoming = function(data) {
    var id = data.readUInt16LE(1);
    console.log("GenieMini: data", data, id);
    if(id == 0x000B) { // current state
        var state = data.readUInt8(5);
        var angle = data.readInt16LE(12);
        this._angle = angle;
        this._moving = (state == 0x01);
        if(this._currentMove != null && this._lastAngle != null) {
            if(Math.abs(angle - this._lastAngle) < 180) {
                this._currentMove += angle - this._lastAngle;
            } else {
                if(this._lastAngle < angle) {
                    this._currentMove += 360 - (angle - this._lastAngle);
                } else {
                    this._currentMove -= 360 - (this._lastAngle - angle);
                }
            }
        }
        this._lastAngle = angle;
    }
}

GenieMini.prototype.connect = function(device, callback) {
    if (device && device.connect) {
        console.log("GenieMini: connecting...");
        this._connectBt(device, callback);
    } else {
        console.log("GenieMini: invalid device, cannot connect");
        if (callback) callback("invalid device");
    }
}

GenieMini.prototype.disconnect = function() {
    console.log("GenieMini: disconnecting...");
    if (this._dev && this._dev.connected) {
        this.connected = false;
        this._dev.connected = false;
        this._dev.disconnect();
    } else {
        this._dev = null;
    }
    this.emit("status", this.getStatus());
}

GenieMini.prototype.getStatus = function() {
    var type = (this._dev && this._dev.type) ? this._dev.type : null;
    return {
        connected: this._dev && this._dev.connected,
        connectionType: type,
        motor1: this._dev && this._dev.connected,
        motor1pos: this._position / this._stepsPerDegree,
    }   
}

GenieMini.prototype.disable = function(motor) {
    this._enabled = false;
}

GenieMini.prototype.enable = function(motor) {
    this._enabled = true;
}

GenieMini.prototype.move = function(motor, degrees, callback) {
    if (this._moving) {
        if (callback) callback("GenieMini: motor already running");
        return console.log("GenieMini: motor already running");
    }
    var steps = degrees * this._stepsPerDegree;
    console.log("GenieMini: moving motor", steps, "steps");
    if(!this._enabled) this.enable();

    var dataBuf = new Buffer(5);
    dataBuf.fill(0);
    if (steps < 0) {
        dataBuf[4] = 1;
        steps = 0 - steps;
    }
    dataBuf.writeUInt32BE(parseInt(steps), 0);
    this._moving = true;

    var self = this;
    self._write(0x005E, dataBuf, function(err) {
        if (!err) {
            var check = function() {
                setTimeout(function() {
                    if(self._moving === undefined) return;
                    if(self._moving) {
                        check(); // keep checking until stop
                    } else {
                        self._position += steps;
                        if (callback) callback(null, self._position);
                    }
                }, 200);
            }
            check();
        } else {
            if (callback) callback(err);
            self._moving = false;
        }
    });
}

GenieMini.prototype._write = function(command, dataBuf, callback) {
    var template = new Buffer("010000", 'hex');
    var len = dataBuf ? dataBuf.length : 0;
    var COMMAND = 0;

    template.writeUInt16LE(parseInt(command), 1);

    var cmd;
    if (dataBuf) {
        cmd = Buffer.concat([template, dataBuf]);
    } else {
        cmd = template;
    }

    console.log("GenieMini: sending data", cmd);

    this._gmCh.write(cmd, callback);
}

GenieMini.prototype.constantMove = function(motor, speed, callback) {
    if (this._moving) return console.log("GenieMini: motor already running");
    console.log("GenieMini: moving motor", steps, "steps");
    if(!this._enabled) this.enable();

    var dataBuf = new Buffer(3);
    dataBuf.fill(0);
    dataBuf.writeInt8(speed, 0);
    dataBuf.writeUInt16LE(speed ? 0x01 : 0x00, 2);
    this._moving = true;

    var self = this;
    if(this._endTimer) clearTimeout(this._endTimer);
    if(self._currentMove == null) {
        self._lastAngle = self._angle;
        self._currentMove = 0;
    }
    self._write(0x003F, dataBuf, function(err) {
        if (!err) {
            var check = function() {
                if(this._endTimer) clearTimeout(this._endTimer);
                if(!speed) {
                    self._endTimer = setTimeout(function() {
                        if(self._moving === undefined) return;
                        if(self._moving) {
                            check(); // keep checking until stop
                        } else {
                            self._position += self._currentMove * self._stepsPerDegree;
                            self._currentMove = null;
                            if (callback) callback(null, self._position);
                        }
                    }, 200);
                } else {
                    if (callback) callback(null, null);
                }
            }
            check();
        } else {
            if (callback) callback(err);
            self._moving = false;
        }
    });
}

GenieMini.prototype.resetMotorPosition = function(motor, callback) {
    var check = function() {
        if(self._moving) {
            setTimeout(check, 200); // keep checking until stop
        } else {
            self._position = 0;
            if (callback) callback(null, self._position);
        }
    }
    check();
}

module.exports = GenieMini;
