var util = require('util');
var EventEmitter = require('events').EventEmitter;

function GenieMini(id) {
    this.btServiceIds = ['f000474d04514000b000000000000000'];

    this._id = id;
    this._gmCh = null;
    this._dev = null;
    this._moving = false;
    this._angle = null;
    this._position = 0;
    this._currentMove = null;
    this._stepsPerDegree = 186.56716418;
    this._backlash = 0;
    this._lastDirection = 0;

    this.orientation = null;
}

util.inherits(GenieMini, EventEmitter);

GenieMini.prototype._connectBt = function(btPeripheral, callback) {
    var self = this;
    btPeripheral.connect(function(err1) {
        if (err1) {
            if (callback) callback(false);
            return;
        }
        console.log('GenieMini(' + self._id + '): connecting via BLE');
        setTimeout(function(){
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
                            try {
                                self._gmCh.write(new Buffer("012600", 'hex'));
                                self._gmCh.subscribe(function(){
                                    self._dev = btPeripheral;
                                    self._dev.connected = true;
                                    self.connected = true;
                                    self._dev.type = "bt";
                                    self._gmCh.on('data', function(data, isNotification) {
                                        self._parseIncoming(data);
                                    });
                                    console.log("GenieMini(" + self._id + "): connected!");
                                    self._init();
                                    if (callback) callback(true);
                                });
                            } catch(err3) {
                                btPeripheral.disconnect();
                                console.log("GenieMini(" + self._id + "): exception while connecting: ", err3);
                                if (callback) callback(false);
                            }
                        } else {
                            console.log("GenieMini(" + self._id + "): couldn't locate characteristics, disconnecting... ", err);
                            btPeripheral.disconnect();
                            if (callback) callback(false);
                        }
                    });
                } else {
                    console.log("GenieMini(" + self._id + "): couldn't locate services, disconnecting... ", err2);
                    btPeripheral.disconnect();
                    if (callback) callback(false);
                }

            });
        }, 1000);

        btPeripheral.once('disconnect', function() {
            console.log("GenieMini(" + self._id + "): disconnected");
            self._dev = null;
            self.connected = false;
            //clearInterval(self.statusIntervalHandle);
            self.emit("status", self.getStatus());
        });

    });
}

GenieMini.prototype._init = function() {
    var self = this;
    var dataBuf = new Buffer(4);
    dataBuf.fill(0);
    dataBuf.writeInt32LE(0x000B, 0);
    //self.statusIntervalHandle = setInterval(function(){
    self._write(0x001E, dataBuf, function(err) { // checks orientation
        var tries = 0;
        var waitForOrientation = function() {
            tries++;
            if(self.orientation || tries > 5) {
                self.emit("status", self.getStatus());
            } else {
                setTimeout(waitForOrientation, 500);
            }
        }
        waitForOrientation();
    });
    //}, 5000);
}

GenieMini.prototype._parseIncoming = function(data) {
    var id = data.readUInt16LE(1);
    if(id == 0x0060 || id == 0x0061) { // moving steps
        var state = data.readUInt8(7);
        var steps = data.readInt16LE(3);
        this._moving = (state == 0x01);
        if(this._newMove) {
            this._newMove = false;
            this._moving = true;
        }
        console.log("GenieMini(" + this._id + "): moving: ", this._moving, ", steps:", steps, "id:", id);
    } else if(id == 0x000B || id == 0x0052) { // current state
        var state = data.readUInt8(4);
        var angle = data.readUInt16LE(12);
        this._angle = angle;
        this._moving = (state == 0x01);
        console.log("GenieMini(" + this._id + "): moving: ", this._moving, ", angle:", angle, "id:", id);
        if(this._currentMove != null && this._lastAngle != null) {
            if(Math.abs(angle - this._lastAngle) < 180) {
                this._currentMove += angle - this._lastAngle;
            } else {
                if(this._lastAngle < angle) {
                    this._currentMove += 359 - (angle - this._lastAngle);
                } else {
                    this._currentMove -= 359 - (this._lastAngle - angle);
                }
            }
            console.log("GenieMini(" + this._id + "): _currentMove", this._currentMove);
        }
        this._lastAngle = angle;
    } else if(id == 0x0025) {
        var orientationCode = data.readUInt8(3);
        console.log("GenieMini(" + this._id + "): orientationCode:", orientationCode);
        var origOrientation = this.orientation;
        if(orientationCode & 0x4) this.orientation = 'tilt'; else this.orientation = 'pan'; // pan = 0x90, 0x80, tilt = 0x94, 0x84
        if(origOrientation != this.orientation) {
            console.log("GenieMini(" + this._id + "): orientation:", this.orientation);
            this.emit("status", this.getStatus());
        }
    } else if(id == 0x004E) {
        this._init(); // update orientation on change
    } else {
        console.log("GenieMini(" + this._id + "): unknown id", id, "data", data);
    }
}

GenieMini.prototype.connect = function(device, callback) {
    if (device && device.connect) {
        this._moving = false;
        console.log("GenieMini(" + this._id + "): connecting...");
        this._connectBt(device, callback);
    } else {
        console.log("GenieMini(" + this._id + "): invalid device, cannot connect");
        if (callback) callback("invalid device");
    }
}

GenieMini.prototype.disconnect = function() {
    console.log("GenieMini(" + this._id + "): disconnecting...");
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
        orientation: this.orientation,
        motor1backlash: this._backlash
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
        if (callback) callback("GenieMini(" + this._id + "): motor already running");
        return console.log("GenieMini(" + this._id + "): motor already running");
    }

    var steps = Math.round(degrees * this._stepsPerDegree);

    var sign = 0;
    if(degrees > 0) sign = 1;
    if(degrees < 0) sign = -1;

    if(sign && this._lastDirection != sign) {
        this._lastDirection = sign;
        degrees += this._backlash * sign;
    }
    var backlashCorrectedSteps = Math.round(degrees * this._stepsPerDegree);
    if(!backlashCorrectedSteps) {
        console.log("GenieMini(" + this._id + "): NOT moving motor", backlashCorrectedSteps, "steps, (", degrees, " degrees)");
        return callback && callback(null, this._position / this._stepsPerDegree);
    }
    console.log("GenieMini(" + this._id + "): moving motor", backlashCorrectedSteps, "steps");
    if(!this._enabled) this.enable();

    var dataBuf = new Buffer(4);
    dataBuf.fill(0);
    dataBuf.writeInt32LE(backlashCorrectedSteps, 0);
    this._moving = true;

    var self = this;
    this._newMove = true;
    self._write(0x005E, dataBuf, function(err) {
        self._moving = true;
        if (!err) {
            var check = function() {
                setTimeout(function() {
                    if(self._moving === undefined) return check();;
                    if(self._moving) {
                        check(); // keep checking until stop
                    } else {
                        self._position += steps;
                        console.log("GenieMini(" + self._id + "): position:", self._position);
                        if (callback) callback(null, self._position / self._stepsPerDegree);
                    }
                }, 300);
            }
            check();
        } else {
            if (callback) callback(err);
            self._moving = false;
        }
    });
}
//<Buffer 01 5e 00 00 00 03 a4 00>
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

    //console.log("GenieMini(" + this._id + "): sending data", cmd);

    try {
        this._gmCh.write(cmd);
        callback && callback();
    } catch(err) {
        callback && callback(err);
    }
}

GenieMini.prototype.constantMove = function(motor, speed, callback) {
    console.log("GenieMini(" + this._id + "): moving motor at speed ", speed, "%");
    if(!this._enabled) this.enable();

    var dataBuf = new Buffer(3);
    var self = this;
    dataBuf.fill(0);
    dataBuf.writeInt8(Math.round(speed), 0);
    dataBuf.writeUInt16LE(speed ? 0x01 : 0x00, 1);
    this._moving = true;

    if(this._watchdog) {
        clearTimeout(this._watchdog);
        this._watchdog = null;
    }
    if(speed) {
        this._watchdog = setTimeout(function(){
            console.log("GenieMini(" + self._id + "): stopping via watchdog");
            self.constantMove(motor, 0);
        }, 3000);
    }

    var sendMove = function() {
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
                                console.log("GenieMini(" + self._id + "): adding", self._currentMove, "° to position");
                                self._position += self._currentMove * self._stepsPerDegree;
                                self._currentMove = null;
                                if (callback) callback(null, self._position / self._stepsPerDegree);
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

    var self = this;
    if(this._endTimer) clearTimeout(this._endTimer);
    if(self._currentMove == null) {
        self._lastAngle = null;
        self._currentMove = 0;
        console.log("GenieMini(" + self._id + "): starting move at speed, saving position");
        var d = new Buffer(2);
        d.fill(0);
        d.writeUInt16LE(0x000B, 0);
        this._moving = true;
        self._write(0x001E, d, function(err) {
            sendMove();
        });
    } else {
        sendMove();
    }
}

GenieMini.prototype.resetMotorPosition = function(motor, callback) {
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

GenieMini.prototype.setMotorPosition = function(motor, position, callback) {
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

GenieMini.prototype.setMotorBacklash = function(motor, backlash, callback) {
    this._backlash = backlash;
    if (callback) callback(this._backlash);
}

GenieMini.prototype.getMotorBacklash = function(motor, callback) {
    if (callback) callback(this._backlash);
}

module.exports = GenieMini;
