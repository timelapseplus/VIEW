
/****************************************************************************
 LICENSE: CC BY-NC-SA 4.0 https://creativecommons.org/licenses/by-nc-sa/4.0/
 This is an original driver by Elijah Parker <mail@timelapseplus.com>
 It is free to use in other projects for non-commercial purposes.  For a
 commercial license and consulting, please contact mail@timelapseplus.com
*****************************************************************************/

var util = require('util');
var EventEmitter = require('events').EventEmitter;

function Ronin(id) {
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
                    });
                } else {
                    console.log("Ronin(" + self._id + "): couldn't locate services, disconnecting... ", err2);
                    btPeripheral.disconnect();
                    if (callback) callback(false);
                }

            });
        }, 1000);

        btPeripheral.once('disconnect', function() {
            console.log("Ronin(" + self._id + "): disconnected");
            self._dev = null;
            self.connected = false;
            //clearInterval(self.statusIntervalHandle);
            self.emit("status", self.getStatus());
        });

    });
}

Ronin.prototype._init = function() {
    var self = this;
    self.emit("status", self.getStatus());
}

Ronin.prototype._parseIncoming = function(data) {
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
        motor1: this._dev && this._dev.connected,
        motor1pos: this._position / this._stepsPerDegree,
        orientation: this.orientation,
        motor1backlash: this._backlash
    }   
}

Ronin.prototype.disable = function(motor) {
    this._enabled = false;
}

Ronin.prototype.enable = function(motor) {
    this._enabled = true;
}

Ronin.prototype.move = function(motor, degrees, callback) {
}


Ronin.prototype._write = function(buffer, callback) {
    callback && callback(err);
}

Ronin.prototype.constantMove = function(motor, speed, callback) {
    console.log("Ronin(" + this._id + "): moving motor at speed ", speed, "%");
    if(!this._enabled) this.enable();

    var dataBuf = new Buffer(3);
    var self = this;

    this._moving = true;

    if(this._watchdog) {
        clearTimeout(this._watchdog);
        this._watchdog = null;
    }
    if(speed) {
        this._watchdog = setTimeout(function(){
            console.log("Ronin(" + self._id + "): stopping via watchdog");
            self.constantMove(motor, 0);
        }, 3000);
    }

}

Ronin.prototype.resetMotorPosition = function(motor, callback) {
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

Ronin.prototype.setMotorPosition = function(motor, position, callback) {
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
