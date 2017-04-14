var events = require('events');
var util = require('util');
var Queue = require('sync-queue')
var i2c = require('i2c-bus');
var q = new Queue();
var math = require('mathjs');

var I2C_ADDR = 0x39,
    GESTURE_THRESHOLD_OUT = 10,
    GESTURE_SENSITIVITY = 65,
    ENABLE = 0x80,
    ATIME = 0x81,
    WTIME = 0x83,
    AILTL = 0x84,
    AILTH = 0x85,
    AIHTL = 0x86,
    AIHTH = 0x87,
    PILT = 0x89,
    PIHT = 0x8B,
    PERS = 0x8C,
    CONFIG1 = 0x8D,
    PPULSE = 0x8E,
    CONTROL = 0x8F,
    CONFIG2 = 0x90,
    ID = 0x92,
    STATUS = 0x93,
    CDATAL = 0x94,
    CDATAH = 0x95,
    RDATAL = 0x96,
    RDATAH = 0x97,
    GDATAL = 0x98,
    GDATAH = 0x99,
    BDATAL = 0x9A,
    BDATAH = 0x9B,
    PDATA = 0x9C,
    POFFSET_UR = 0x9D,
    POFFSET_DL = 0x9E,
    CONFIG3 = 0x9F,
    GPENTH = 0xA0,
    GEXTH = 0xA1,
    GCONF1 = 0xA2,
    GCONF2 = 0xA3,
    GOFFSET_U = 0xA4,
    GOFFSET_D = 0xA5,
    GOFFSET_L = 0xA7,
    GOFFSET_R = 0xA9,
    GPULSE = 0xA6,
    GCONF3 = 0xAA,
    GCONF4 = 0xAB,
    GFLVL = 0xAE,
    GSTATUS = 0xAF,
    IFORCE = 0xE4,
    PICLEAR = 0xE5,
    CICLEAR = 0xE6,
    AICLEAR = 0xE7,
    GFIFO_U = 0xFC,
    GFIFO_D = 0xFD,
    GFIFO_L = 0xFE,
    GFIFO_R = 0xFF,
    ID_RES = 0xAB;

// bits on the enable register
var ENABLE_GEN = 6 // gesture enable
    ,
    ENABLE_PIEN = 5 // proximity interrupt enable
    ,
    ENABLE_AIEN = 4 // ALS interrupt enable
    ,
    ENABLE_WEN = 3 // wait enable. 1 = activates wait timer
    ,
    ENABLE_PEN = 2 // proximity detect enable
    ,
    ENABLE_AEN = 1 // ALS enable
    ,
    ENABLE_PON = 0 // Power on. 0 = low power state
;

function b(binary) {
    return parseInt(binary, 2);
}

function GestureSensor(port) {
    this.port = port;
    this.i2c = i2c.openSync(this.port);

    var self = this;
    this._readRegister([ID], 1, function(err, data) {
        if (data[0] != ID_RES) {
            self.emit('error', new Error('Cannot connect APDS Gesture sensor. Got id: ' + data[0].toString(16)));
        } else {
            self.fifoData = {};

            self.emit('ready');
        }
    });

    return self;
}

util.inherits(GestureSensor, events.EventEmitter);

GestureSensor.prototype._readRegister = function(data, num, next) {
    //console.log("reading bytes: ", num);
    var result = new Buffer(0);
    var self = this;
    var read = function() {
        var len = num;
        if(len > 32) len = 32;
        var buf = new Buffer(len);
        self.i2c.readI2cBlock(I2C_ADDR, data[0], len, buf, function(err, bytes, buf) {
            result = Buffer.concat([result, buf]);
            num -= bytes;
            if(num > 0 && !err) {
                read();
            } else {
                next && next(err, result);
            }
        });
    }
    read();
    //this.i2c.readBytes(data[0], num, next);
};

GestureSensor.prototype._writeRegister = function(data, next) {
    this.i2c.writeByte(I2C_ADDR, data[0], data[1], function(err) {
        next && next(err);
    });
    //this.i2c.writeBytes(data[0], [data[1]], next);
};

// set up gesture control
GestureSensor.prototype.setup = function(config, callback) {
    var self = this;
    this.stop();
    if(!config) config = {};
    GESTURE_THRESHOLD_OUT = config.threshold ? config.threshold : 20;
    GESTURE_SENSITIVITY = config.sensitivity ? config.sensitivity : 50;
    // turns off everything. need to do this before changing control registers
    this._writeRegister([ENABLE, 0x00], function() {
        q.clear();

        // set up offset
        q.place(function() {
            self._writeRegister([GOFFSET_U, config.gUOffset || 0], q.next);
        });
        // set down offset
        q.place(function() {
            self._writeRegister([GOFFSET_D, config.gDOffset || 0], q.next);
        });
        // set left offset
        q.place(function() {
            self._writeRegister([GOFFSET_L, config.gLOffset || 0], q.next);
        });
        // set right offset
        q.place(function() {
            self._writeRegister([GOFFSET_R, config.gROffset || 0], q.next);
        });

        // set enter threshold
        q.place(function() {
            self._writeRegister([GPENTH, config.gEnter === null ? 40 : config.gEnter], q.next);
        });

        // set exit threshold
        q.place(function() {
            self._writeRegister([GEXTH, config.gExit === null ? 30 : config.gExit], q.next);
        });

        // set gconf1 (fifo threshold, exit mask, exit persistance)
        q.place(function() {
            self._writeRegister([GCONF1, 0x40], q.next);
        });

        // set gain, led, & wait time
        // 2.8ms wait time  = 1 [2:0]
        // 100mA led drive strength = 0 [4:3]
        // 4x gain = 2 [6:5]
        // 1000001 = 0x41
        q.place(function() {
            var val = 0;
            var drive = (config.gDrive || 0) & b('00000011');
            drive = drive << 3;
            val &= b('11100111');
            val |= drive;

            var time = (config.gWaitTime || 1) & b('00000111');
            val &= b('11111000');
            val |= time;
            
            var gain = (config.gGain || 2) & b('00000011');
            gain = gain << 5;
            val &= b('10011111');
            val |= gain;
            self._writeRegister([GCONF2, val], q.next); // 0x41
        });

        // set gpulse (pulse count & length)
        q.place(function() {
            self._writeRegister([GPULSE, 0xC9], q.next);
        });

        // callback setup
        q.place(function() {
            self.enable(callback);
        });

    });
}

GestureSensor.prototype.enable = function(callback) {
    var self = this;
    q.clear();
    // 0.03s low power wait mode
    q.place(function() {
        self._writeRegister([WTIME, 0xFF], q.next);
    });

    // ppulse, set pulse count to 0x89, 16us length 10pulses
    q.place(function() {
        self._writeRegister([PPULSE, 0x89], q.next);
    });

    // enter gesture mode
    q.place(function() {
        self._writeRegister([GCONF4, 0x01], q.next);
    });

    q.place(function() {
        self.resetGesture();
        self._writeRegister([ENABLE, 0x4D], callback);
    });

}

GestureSensor.prototype.disable = function(callback) {
    var self = this;
    q.clear();
    q.place(function() {
        self.resetGesture();
        self._writeRegister([ENABLE, 0x00], callback);
    });

}

GestureSensor.prototype.start = function(interval) {
    if(this.intervalHandle) {
        clearInterval(this.intervalHandle);
        this.intervalHandle = null;
    }
    var self = this;
    this.intervalHandle = setInterval(function() {
        self.readGesture();
    }, interval || 200);
}

GestureSensor.prototype.stop = function(interval) {
    if(this.intervalHandle) {
        clearInterval(this.intervalHandle);
        this.intervalHandle = null;
    }
}

GestureSensor.prototype.processGesture = function(length, callback) {
    var self = this;
    var start = -1;
    var end = 0;

    var up = "", down = "", left = "", right = "";
    for (var i = 0; i < length; i++) up += self.fifoData['up'][i] + ",";
    for (var i = 0; i < length; i++) down += self.fifoData['down'][i] + ",";
    for (var i = 0; i < length; i++) left += self.fifoData['left'][i] + ",";
    for (var i = 0; i < length; i++) right += self.fifoData['right'][i] + ",";
    console.log(up);
    console.log(down);
    console.log(left);
    console.log(right);

    // get first and last values above threshold
    for (var i = 0; i < length; i++) {

        if (self.fifoData['up'][i] > GESTURE_THRESHOLD_OUT && self.fifoData['down'][i] > GESTURE_THRESHOLD_OUT && self.fifoData['left'][i] > GESTURE_THRESHOLD_OUT && self.fifoData['right'][i] > GESTURE_THRESHOLD_OUT) {

            if (start == -1) {
                start = i;
            }

            //if (i == (length - 1) || start != 0) {
            end = i;
            //}
        }

    }

    if (start == -1 || end == 0) {
        // if either is 0 then no values passed threshold
        if (self.debug) {
            console.log("no values passed threshold");
        }
        return callback();
    }

    // get the ratios
    var ud_first = ((self.fifoData['up'][start] - self.fifoData['down'][start]) * 100) / (self.fifoData['up'][start] + self.fifoData['down'][start]);
    var lr_first = ((self.fifoData['left'][start] - self.fifoData['right'][start]) * 100) / (self.fifoData['left'][start] + self.fifoData['right'][start]);
    var ud_last = ((self.fifoData['up'][end] - self.fifoData['down'][end]) * 100) / (self.fifoData['up'][end] + self.fifoData['down'][end]);
    var lr_last = ((self.fifoData['left'][end] - self.fifoData['right'][end]) * 100) / (self.fifoData['left'][end] + self.fifoData['right'][end]);

    // difference between ratios
    var ud_diff = ud_last - ud_first;
    var lr_diff = lr_last - lr_first;

    self.gesture_ud_diff = self.gesture_ud_diff + ud_diff;
    self.gesture_lr_diff = self.gesture_lr_diff + lr_diff;

    console.log("lrd: ", self.gesture_lr_diff, " udd:", self.gesture_ud_diff);

    self.dir = {
        'up': 0,
        'left': 0
    };

    if (self.gesture_ud_diff >= GESTURE_SENSITIVITY) {
        self.dir['up'] = -1;
    } else if (self.gesture_ud_diff <= -GESTURE_SENSITIVITY) {
        self.dir['up'] = 1;
    }

    if (self.gesture_lr_diff >= GESTURE_SENSITIVITY) {
        self.dir['left'] = -1;
    } else if (self.gesture_lr_diff <= -GESTURE_SENSITIVITY) {
        self.dir['left'] = 1;
    }

    //console.log("self.dir", self.dir);

    if(self.dir['up'] && self.dir['left']) {
        var lr = Math.abs(self.gesture_lr_diff);
        var ud = Math.abs(self.gesture_ud_diff);
        if(Math.abs(lr - ud) >= GESTURE_SENSITIVITY) {
            if(lr > ud) {
                self.dir['up'] = 0;
            } else {
                self.dir['left'] = 0;
            }
        }
    }

    //console.log("self.dir", self.dir);

    if (self.dir['up'] == -1 && self.dir['left'] == 0) {
        self.resetGesture();
        self.emit('movement', 'down');
    } else if (self.dir['up'] == 1 && self.dir['left'] == 0) {
        self.resetGesture();
        self.emit('movement', 'up');
    } else if (self.dir['up'] == 0 && self.dir['left'] == -1) {
        self.resetGesture();
        self.emit('movement', 'right');
    } else if (self.dir['up'] == 0 && self.dir['left'] == 1) {
        self.resetGesture();
        self.emit('movement', 'left');
    } else if (self.dir['up'] != 0 && self.dir['down'] != 0) {
        self.resetGesture();
    }

    callback();
}

GestureSensor.prototype.calibrate = function(calConfig, statusCallback) {
    if(typeof calConfig == 'function') {
        statusCallback = calConfig;
        calConfig = null;
    }
    var MAX_READ_GAIN = 200;
    var MAX_READ_OFFSET = 3;
    var MAX_STD = 5;
    var THRES_DEF = 15;
    var SENS_DEF = 10;
    var CAL_READINGS = 5;
    var MAX_ATTEMPTS_START = 20;
    var MAX_ATTEMPTS_OFFSET = 100;
    var MAX_ATTEMPTS_EMPTY = 100;

    if(!calConfig) {
        statusCallback && statusCallback(null, 'starting...');
        calConfig = {
            gDrive: 0,
            gWaitTime: 1,
            gGain: 2,
            gUOffset: 0,
            gDOffset: 0,
            gLOffset: 0,
            gROffset: 0,
            threshold: 15,
            sensitivity: 10,
            gEnter: 0,
            gExit: 0,
            startAttempts: 0,
            offsetAttempts: 0
        }
    }
    var self = this;
    this.setup(calConfig, function() {
        var calBuf = {
            u: [],
            d: [],
            l: [],
            r: []
        }
        var getCalData = function() {
            console.log("readGesture");
            self.readGesture(function(up, down, left, right) {
                if(up && down && left && right) {
                    var stdMax = math.max(math.std(up), math.std(down), math.std(left), math.std(right));
                    if(stdMax < MAX_STD) {
                        calBuf.u.push(math.mean(up));
                        calBuf.d.push(math.mean(down));
                        calBuf.l.push(math.mean(left));
                        calBuf.r.push(math.mean(right));
                        if(calBuf.u.length >= CAL_READINGS) {
                            var m = {
                                u: math.mean(calBuf.u),
                                d: math.mean(calBuf.d),
                                l: math.mean(calBuf.l),
                                r: math.mean(calBuf.r),
                            }
                            console.log(m.u, m.d, m.l, m.r);
                            var maxVal = math.max(m.u, m.d, m.l, m.r);
                            if(maxVal > MAX_READ_GAIN && calConfig.gGain > 0) {
                                calConfig.gGain--;
                                console.log("adjusting gain...");
                                statusCallback && statusCallback(null, 'adjusting gain...');
                                setTimeout(function(){self.calibrate(calConfig, statusCallback);}, 100);
                            } else if(maxVal > MAX_READ_OFFSET) {
                                if(m.u > MAX_READ_OFFSET) calConfig.gUOffset += Math.floor(math.max(1, m.u / 20)); //Math.floor(m.u / (Math.pow(2, calConfig.gGain) + 1));
                                if(m.d > MAX_READ_OFFSET) calConfig.gDOffset += Math.floor(math.max(1, m.d / 20)); // = Math.floor(m.d / (Math.pow(2, calConfig.gGain) + 1));
                                if(m.l > MAX_READ_OFFSET) calConfig.gLOffset += Math.floor(math.max(1, m.l / 20)); // = Math.floor(m.l / (Math.pow(2, calConfig.gGain) + 1));
                                if(m.r > MAX_READ_OFFSET) calConfig.gROffset += Math.floor(math.max(1, m.r / 20)); // = Math.floor(m.r / (Math.pow(2, calConfig.gGain) + 1));
                                console.log("adjusting offsets...");
                                calConfig.startAttempts++;
                                if(calConfig.startAttempts > MAX_ATTEMPTS_OFFSET) {
                                    statusCallback && statusCallback('Error: failed to calibrate offsets', 'Err: calibration failed');
                                } else {
                                    statusCallback && statusCallback(null, 'adjusting offsets...');
                                    setTimeout(function(){self.calibrate(calConfig, statusCallback);}, 100);
                                }
                            } else {
                                delete calConfig.startAttempts;
                                delete calConfig.offsetAttempts;
                                calConfig.gEnter = 30;// * Math.pow(2, calConfig.gGain);
                                calConfig.gExit = 20;// * Math.pow(2, calConfig.gGain);
                                calConfig.threshold = THRES_DEF;//* Math.pow(2, calConfig.gGain);
                                calConfig.sensitivity = SENS_DEF;// * Math.pow(2, calConfig.gGain);
                                console.log("calibration results:", calConfig);
                                self.setup(calConfig, function() {
                                    statusCallback && statusCallback(null, 'done!', calConfig);
                                });
                            }
                        } else {
                            setTimeout(getCalData, 100);
                        }
                    } else {
                        calBuf.u = [];
                        calBuf.d = [];
                        calBuf.l = [];
                        calBuf.r = [];
                        calConfig.startAttempts++;
                        if(calConfig.startAttempts > MAX_ATTEMPTS_START) {
                            statusCallback && statusCallback('Error: failed to acheive stable readings', 'Err: readings not stable');
                        } else {
                            statusCallback && statusCallback(null, 'reading...');
                            setTimeout(getCalData, 100);
                        }
                    }
                } else {
                    calBuf.u = [];
                    calBuf.d = [];
                    calBuf.l = [];
                    calBuf.r = [];
                    calConfig.startAttempts++;
                    if(calConfig.startAttempts > MAX_ATTEMPTS_EMPTY) {
                        statusCallback && statusCallback('Error: failed to read sensor', 'Err: failed to read');
                    } else {
                        setTimeout(getCalData, 100);
                    }
                }
            });
        }
        getCalData();
    });
}

GestureSensor.prototype.resetGesture = function() {
    this.gesture_ud_diff = 0;
    this.gesture_lr_diff = 0;
}

GestureSensor.prototype.readGesture = function(testCallback) {
    var self = this;
    self.fifoData = {};
    self.fifoData['up'] = [];
    self.fifoData['down'] = [];
    self.fifoData['left'] = [];
    self.fifoData['right'] = [];

    q.clear();
    // check the status to see if there is anything
    self._readRegister([GSTATUS], 1, function(err, data) {
        //console.log("reading gstatus", data);
        if (data[0] & 1) {
            var fifoLength = 0;
            // we have valid fifo data
            q.place(function() {
                self._readRegister([GFLVL], 1, function(err, data) {
                    fifoLength = data[0];
                    if (self.debug) {
                        //console.log("valid fifo length of", fifoLength);
                    }
                    q.next();
                })
            })

            q.place(function() {
                self._readRegister([GFIFO_U], fifoLength * 4, function(err, data) {
                    if (self.debug) {
                        //console.log("reading buffer");
                    }
                    for (var i = 0; i < (fifoLength * 4); i = i + 4) {
                        self.fifoData['up'].push(data[i]);
                        self.fifoData['down'].push(data[i + 1]);
                        self.fifoData['left'].push(data[i + 2]);
                        self.fifoData['right'].push(data[i + 3]);
                    }
                    q.next();
                });
            });

            q.place(function() {
                // restart the process
                if (self.debug) {
                    //console.log("processing: ", fifoLength);
                }
                if (fifoLength <= 4) return testCallback && testCallback();
                if(testCallback) {
                    var up = self.fifoData['up'].slice(0, fifoLength);                
                    var down = self.fifoData['down'].slice(0, fifoLength);                
                    var left = self.fifoData['left'].slice(0, fifoLength);                
                    var right = self.fifoData['right'].slice(0, fifoLength);                
                    testCallback(up, down, left, right);
                } else {
                    self.processGesture(fifoLength, function() {
                        //self.readGesture();
                    });
                }
            });
        } else {
            testCallback && testCallback();
            //self.readGesture();
        }
    })
}

// exports
exports.GestureSensor = GestureSensor;

exports.use = function(hardware, opts) {
    return new GestureSensor(hardware);
};