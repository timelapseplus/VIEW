var util = require('util');
var EventEmitter = require('events').EventEmitter;

function CB(id) {
    this.btServiceIds = ['ae0e019cef7511e981b42a2ae2dbcce4'];

    this._id = id;
    this._gmCh = null;
    this._dev = null;
    this._moving = false;
    this._position = 0;
    this._stepsPerUnit = 1;
    this._backlash = 0;
    this._lastDirection = 0;
}

util.inherits(CB, EventEmitter);

CB.prototype._connectBt = function(btPeripheral, callback) {
    var self = this;
    btPeripheral.connect(function(err1) {
        if (err1) {
            if (callback) callback(false);
            return;
        }
        console.log('CB(' + self._id + '): connecting via BLE');
        setTimeout(function(){
            btPeripheral.discoverServices(self.btServiceIds, function(err2, services) {
                if (services && services[0]) {
                    services[0].discoverCharacteristics([], function(err, characteristics) {
                        //console.log("characteristics:", characteristics);
                        self._writeCh = null;
                        self._readCh = null;
                        self._dev = null;
                        for (var i = 0; i < characteristics.length; i++) {
                            ch = characteristics[i];
                            console.log("ch.uuid", ch.uuid);
                            if (ch.uuid == "ae0e0408ef7511e981b42a2ae2dbcce4") {
                                self._writeCh = ch;
                            } else if (ch.uuid == "ae0e055cef7511e981b42a2ae2dbcce4") {
                                self._readCh = ch;
                            }
                        }
                        if (self._writeCh && self._readCh) {
                            try {
                                console.log("CB(" + self._id + "): subscribing...");
                                self._readCh.subscribe(function(){
                                    self._dev = btPeripheral;
                                    self._dev.connected = true;
                                    self.connected = true;
                                    self._dev.type = "bt";
                                    self._readCh.on('data', function(data, isNotification) {
                                        self._parseIncoming(data);
                                    });
                                    console.log("CB(" + self._id + "): connected!");
                                    self._init();
                                    if (callback) callback(true);
                                });
                            } catch(err3) {
                                btPeripheral.disconnect();
                                console.log("CB(" + self._id + "): exception while connecting: ", err3);
                                if (callback) callback(false);
                            }
                        } else {
                            console.log("CB(" + self._id + "): couldn't locate characteristics, disconnecting... ", err);
                            btPeripheral.disconnect();
                            if (callback) callback(false);
                        }
                    });
                } else {
                    console.log("CB(" + self._id + "): couldn't locate services, disconnecting... ", err2);
                    btPeripheral.disconnect();
                    if (callback) callback(false);
                }

            });
        }, 1000);

        btPeripheral.once('disconnect', function() {
            console.log("CB(" + self._id + "): disconnected");
            self._dev = null;
            self.connected = false;
            //clearInterval(self.statusIntervalHandle);
            self.emit("status", self.getStatus());
        });

    });
}

CB.prototype._init = function() {
    var self = this;
    self._writeCh.write(new Buffer("S\n"));
}

CB.prototype._parseIncoming = function(data) {
    if(data.length != 5) return;

    this._moving = data.readUInt8(0) & 0x01;
    this._position = data.readUInt32LE(1);

    console.log("CB(" + this._id + "): moving: ", this._moving, ", position:", this._position);
}

CB.prototype.connect = function(device, callback) {
    if (device && device.connect) {
        this._moving = false;
        console.log("CB(" + this._id + "): connecting...");
        this._connectBt(device, callback);
    } else {
        console.log("CB(" + this._id + "): invalid device, cannot connect");
        if (callback) callback("invalid device");
    }
}

CB.prototype.disconnect = function() {
    console.log("CB(" + this._id + "): disconnecting...");
    if (this._dev && this._dev.connected) {
        this.connected = false;
        this._dev.connected = false;
        this._dev.disconnect();
    } else {
        this._dev = null;
    }
    this.emit("status", this.getStatus());
}

CB.prototype.getStatus = function() {
    var type = (this._dev && this._dev.type) ? this._dev.type : null;
    return {
        connected: this._dev && this._dev.connected,
        connectionType: type,
        position: this._position / this._stepsPerUnit,
        backlash: this._backlash,
        moving: this._moving
    }   
}

CB.prototype.disable = function(motor) {
    this._enabled = false;
}

CB.prototype.enable = function(motor) {
    this._enabled = true;
}

CB.prototype.move = function(motor, amount, callback) {
    if (this._moving) {
        if (callback) callback("CB(" + this._id + "): motor already running");
        return console.log("CB(" + this._id + "): motor already running");
    }

    var steps = Math.round(amount * this._stepsPerUnit);

    console.log("CB(" + this._id + "): moving motor", steps, "steps");
    if(!this._enabled) this.enable();

    this._moving = true;

    var self = this;
    self._writeCh.write('M' + steps.toString(), function(err) {
        self._moving = true;
        if (!err) {
            var n = 0;
            var check = function() {
                setTimeout(function() {
                    if(self._moving || self._moving === undefined) {
                        n++;
                        if(n > 500) {
                            console.log("CB(" + self._id + "): ERROR: timed out waiting for move");
                            if (callback) callback("timeout");
                            self._moving = false;
                        } else {
                            check(); // keep checking until stop
                        }
                    } else {
                        console.log("CB(" + self._id + "): position:", self._position);
                        if (callback) callback(null, self._position / self._stepsPerUnit);
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

CB.prototype.constantMove = function(motor, speed, callback) {
    console.log("CB(" + this._id + "): moving motor at speed ", speed, "%");
    if(!this._enabled) this.enable();

    var self = this;
    dataBuf.writeUInt16LE(speed ? 0x01 : 0x00, 1);
    self._moving = true;

    self._constantSpeed = speed;

    if(self._watchdog) {
        clearTimeout(self._watchdog);
        self._watchdog = null;
    }
    if(self._moveTimer) {
        clearTimeout(self._moveTimer);
        self._moveTimer = null;
    }
    if(speed) {
        self._watchdog = setTimeout(function(){
            console.log("CB(" + self._id + "): stopping via watchdog");
            self._constantSpeed = 0;
            clearTimeout(self._moveTimer);
            self._moveTimer = null;
        }, 3000);
    }

    var sendMove = function() {
        if(self._constantSpeed) {
            self.move(motor, self._constantSpeed, function() {
                if (callback) callback(null, self._position / self._stepsPerUnit);
                if(speed) {
                    self._moveTimer = setTimeout(function() {
                        sendMove();
                    }, 100);
                }
            });
        } else {
            if (callback) callback(null, self._position / self._stepsPerUnit);
        }
    }
    sendMove();
}

CB.prototype.resetMotorPosition = function(motor, callback) {
    this.setMotorPosition(motor, 0, callback);
}

CB.prototype.setMotorPosition = function(motor, position, callback) {
    var self = this;
    var check = function() {
        if(self._moving) {
            setTimeout(check, 200); // keep checking until stop
        } else {
            if(!position) position = 0;
            self._position = Math.round(position);
            self._writeCh.write('P' + self._position.toString());
            if (callback) callback();
        }
    }
    check();
}

CB.prototype.setMotorBacklash = function(motor, backlash, callback) {
    this._backlash = backlash;
    if (callback) callback(this._backlash);
}

CB.prototype.getMotorBacklash = function(motor, callback) {
    if (callback) callback(this._backlash);
}

module.exports = CB;
