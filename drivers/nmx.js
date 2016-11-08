var CMD_MOVE_MOTOR = {
    cmd: 0x0F,
    responseType: false,
    delay: 0
}
var CMD_ENABLE_MOTOR = {
    cmd: 0x03,
    responseType: false,
    delay: 0
}
var CMD_MOTOR_STATUS = {
    cmd: 0x6B,
    responseType: 0,
    delay: 0
}
var CMD_MOTOR_POSITION = {
    cmd: 0x6A,
    responseType: 2,
    delay: 0
}
var CMD_MOTOR_RESET = {
    cmd: 0x1B,
    responseType: false,
    delay: 0
}
var CMD_FIRMWARE_VERSION = {
    cmd: 0x64,
    responseType: 1,
    delay: 0
}

var COMMAND_SPACING_MS = 100

var EventEmitter = require("events").EventEmitter;
var SerialPort = require('serialport');

var nmx = new EventEmitter();


var motorRunning = [];
var motorPos = [];

var _nmxQueue = [];
var _queueRunning = false;
var _dev = null;
var _nmxCommandCh = null;
var _nmxReadCh = null;


function getStatus() {
    return {
        connected: _dev && _dev.connected,
        motor1: true,
        motor2: true,
        motor3: false
    }   
}

function move(motorId, steps, callback) {
    if (motorRunning[motorId]) return console.log("NMX: motor already running");
    console.log("NMX: moving motor " + motorId);
    enable(motorId);
    var m = new Buffer(5);
    m.fill(0);
    if (steps < 0) {
        m[0] = 1;
        steps = 0 - steps;
    }
    m.writeUInt32BE(steps, 1, 4);
    motorRunning[motorId] = true;

    var cmd = {
        motor: motorId,
        command: CMD_MOVE_MOTOR,
        dataBuf: m
    }

    _queueCommand(cmd, function(err) {
        if (!err) {
            (function check(motorId) {
                setTimeout(function() {
                    checkMotorRunning(motorId, function(moving) {
                        if(moving === undefined) return;
                        if (moving) {
                            motorRunning[motorId] = true;
                            check(motorId); // keep checking until stop
                        } else {
                            motorRunning[motorId] = false;
                            if (callback) callback(null);
                            checkMotorPosition(motorId, function(position) {
                                motorPos[motorId] = position;
                            })
                        }
                    });
                }, 200);
            })(motorId);
        } else {
            if (callback) callback(err);
            motorRunning[motorId] = false;
        }
    });
}

function checkMotorRunning(motorId, callback) {
    var cmd = {
        motor: motorId,
        command: CMD_MOTOR_STATUS
    }
    _queueCommand(cmd, function(err, moving) {
        console.log("motor moving (" + motorId + "): ", moving);
        if (callback) callback(moving);
    });
}

function checkMotorPosition(motorId, callback) {
    var cmd = {
        motor: motorId,
        command: CMD_MOTOR_POSITION,
        readback: true,
        readbackDelayMs: 50
    }
    _queueCommand(cmd, function(err, position) {
        console.log("motor position (" + motorId + "): ", position);
        if (callback) callback(position);
    });
}

function firmwareVersion(callback) {
    var cmd = {
        motor: 0,
        command: CMD_FIRMWARE_VERSION,
        readback: true,
    }
    _queueCommand(cmd, function(err, version) {
        if (callback) callback(err, version);
    });
}

function resetMotorPosition(motorId, callback) {
    var cmd = {
        motor: motorId,
        command: CMD_MOTOR_RESET,
        readback: false
    }
    _queueCommand(cmd, function(err) {
        if (callback) callback(err);
    });
}

function enable(motorId) {
    if (!motorId) return;
    var cmd = {
        motor: motorId,
        command: CMD_ENABLE_MOTOR,
        dataBuf: new Buffer("01", 'hex')
    }
    _queueCommand(cmd);
}

function disable(motorId) {
    if (!motorId) return;
    var cmd = {
        motor: motorId,
        command: CMD_ENABLE_MOTOR,
        dataBuf: new Buffer(1)
    }
    _queueCommand(cmd);
}

function disconnect() {
    if (_dev && _dev.connected) {
        _dev.disconnect();
    } else {
        _dev = null;
    }
}

function connect(device, callback) {
    if (device && typeof device == "string") {
        _connectSerial(device, callback);
    } else if (device && device.connect) {
        _connectBt(device, callback);
    } else if (!device || typeof device == "function") {
        SerialPort.list(function(err, ports) {
            console.log("scanned serial ports:", ports);
            for (var i = 0; i < ports.length; i++) {
                if (ports[i].manufacturer == 'Dynamic_Perception_LLC') {
                    _connectSerial(ports[i].comName, callback)
                    return;
                }
            }
            if (callback) callback("no device found");
        });
    } else {
        if (callback) callback("invalid device");
    }
}

var legacyNMX =  "b8e0606762ad41ba9231206ae80ab550";
var currentNMX = "a3a9eb86c0fd4a5cb191bff60a7f9ea7";

nmx.btServiceId = currentNMX;
nmx.connect = connect;
nmx.disconnect = disconnect;
nmx.disable = disable;
nmx.enable = enable;
nmx.move = move;
nmx.getStatus = getStatus;

module.exports = nmx;

// private functions //

function _connectSerial(path, callback) {
    console.log("connecting to NMX via " + path);
    _dev = {};
    _dev.receiveBuf = [];
    var buf = null;
    var header = Buffer("0000000000FF0000", 'hex');
    _dev.port = new SerialPort(path, {
        baudrate: 19200
    }, function() {
        console.log('Serial Opened');
        if (!_dev) return;
        _dev.connected = true;
        _dev.state = "connected";

        _dev.port.once('disconnect', function(err) {
            if (err && _dev.connected) {
                _dev = null;
                nmx.emit("status", getStatus());
                console.log("ERROR: NMX Disconnected: ", err);
                console.log("NMX reconnecting");
                process.nextTick(function() {
                    _connectSerial(path);
                });
            }
        });
        _dev.port.once('error', function(err) {
            console.log("NMX ERROR: ", err);
        });
        _dev.port.once('close', function() {
            console.log("NMX CLOSED");
        });

        var parseIncoming = function() {
            if (buf.length > header.length + 1) {
                var eq = true;
                for (var i = 0; i < header.length; i++) {
                    if (header[i] != buf[i]) {
                        eq = false;
                        break;
                    }
                }
                if (eq) {
                    var motor = buf[header.length];
                    var length = buf[header.length + 1];
                    if (buf.length >= header.length + 1 + length) {
                        _dev.receiveBuf.push(buf.slice(header.length + 1, header.length + 2 + length));
                        buf = buf.slice(header.length + 2 + length);
                        //console.log(" trimmed buf: ", _dev.receiveBuf[_dev.receiveBuf.length - 1]);
                        parseIncoming();
                    }
                }
            }
        }

        _dev.port.on('data', function(data) {
            //console.log("NMX received: ", data);
            //console.log("NMX buf: ", buf);
            if (buf && buf.length > 0) {
                buf = Buffer.concat([buf, data]);
            } else {
                buf = data;
            }
            parseIncoming();
        });

        _nmxCommandCh = {
            write: function(dataBuf, notused, cb) {
                if(!_dev.port) return cb("not connected");
                _dev.port.write(dataBuf, function(err) {
                    _dev.port.drain(function() {
                        //console.log("    NMX sent: ", dataBuf);
                        cb(err);
                    });
                })
            }
        }
        _nmxReadCh = {
            read: function(cb) {
                if(!_dev) return cb && cb("not connected");
                var tries = 10; // 1 second
                var checkForData = function() {
                    if(!_dev) return cb && cb("not connected");
                    if (_dev.receiveBuf.length > 0) {
                        //console.log("receiveBuf:", _dev.receiveBuf);
                        var readData = _dev.receiveBuf.shift();
                        if (cb) cb(null, readData);
                    } else {
                        if (tries > 0) {
                            tries--;
                            setTimeout(checkForData, 100);
                        } else {
                            console.log("NMX timed out waiting for data");
                            if (cb) cb("timed out");
                        }
                    }
                }
                checkForData();
            }
        }
        _dev.disconnect = function() {
            _dev.connected = false;
            _dev.port.close(function() {
                _dev.port = null;
            });
        }
        nmx.emit("status", getStatus());
        firmwareVersion(function(err, version) {
            console.log("NMX connected!");
            console.log("NMX firmware version: ", version);
            resetMotorPosition(1);
        });
        if (callback) callback(true);
    });
}

function _connectBt(btPeripheral, callback) {
    btPeripheral.connect(function(err1) {
        if (err1) {
            if (callback) callback(false);
            return;
        }
        console.log('BLE Connected!');
        btPeripheral.discoverServices([nmx.btServiceId], function(err2, services) {
            if (services && services[0]) {
                services[0].discoverCharacteristics([], function(err, characteristics) {
                    //console.log("characteristics:", characteristics);
                    _nmxCommandCh = null;
                    _nmxReadCh = null;
                    _dev = null;
                    for (var i = 0; i < characteristics.length; i++) {
                        ch = characteristics[i];
                        if (ch.uuid == "bf45e40ade2a4bc8bba0e5d6065f1b4b") {
                            _nmxCommandCh = ch;
                        }
                        if (ch.uuid == "f897177baee847678ecccc694fd5fcee") {
                            _nmxReadCh = ch;
                            //console.log("NMX read ch:", ch);
                        }
                    }
                    if (_nmxReadCh && _nmxCommandCh) {
                        //_nmxReadCh.subscribe(function(){
                            _dev = btPeripheral;
                            _dev.connected = true;
                            console.log("NMX connected!");
                            nmx.emit("status", getStatus());
                            firmwareVersion(function(err, version) {
                                console.log("NMX firmware version: ", version);
                                resetMotorPosition(1);
                            });
                            if (callback) callback(true);
                        //});
                    } else {
                        btPeripheral.disconnect();
                        if (callback) callback(false);
                    }
                });
            } else {
                if (callback) callback(false);
            }

        });

        btPeripheral.on('disconnect', function() {
            console.log("NMX disconnected");
            _dev = null;
            nmx.emit("status", getStatus());
        });

    });

}

function _queueCommand(object, callback) {
    var motor = object.motor; // required
    var command = object.command; // required
    var dataBuf = object.dataBuf || null;
    var readback = object.command.responseType !== false;
    var readbackDelayMs = object.command.delay || 100;
    var responseType = object.command.responseType;

    var template = new Buffer("0000000000FF03000000", 'hex');
    var len = dataBuf ? dataBuf.length : 0;
    var MOTOR = 7;
    var COMMAND = 8;
    var DATALEN = 9;

    template[MOTOR] = parseInt(motor);
    template[COMMAND] = parseInt(command.cmd);
    template[DATALEN] = len;

    var cmd;
    if (dataBuf) {
        cmd = Buffer.concat([template, dataBuf]);
    } else {
        cmd = template;
    }

    var queueItem = {
        buffer: cmd,
        readback: readback,
        readbackDelayMs: readbackDelayMs,
        responseType: responseType,
        callback: callback
    };
    _runQueue(queueItem);
}

function _runQueue(queueItem, rec) {
    console.log("NMX: queue starting...");
    if (queueItem) {
        _nmxQueue.push(queueItem);
    }
    if (_queueRunning && !rec) {
        return;
    } else {
        _queueRunning = true;
    }

    console.log("NMX: running queue...");
    var nextItem = _nmxQueue.shift();
    if (!_dev || !_dev.state || _dev.state != "connected") {
        _queueRunning = false;
        _nmxQueue = [];
        console.log("NMX err: not connected");
        if (nextItem && nextItem.callback) nextItem.callback("not connected");
    }


    if (nextItem) {
        console.log("writing to NMX:", nextItem.buffer);
        (function(item) {
            _nmxCommandCh.write(item.buffer, true, function(err) {
                if(err) console.log("NMX: error writing:", err);
                console.log("checking callback");
                if (item.callback) {
                    if (item.readback) {
                        //if(_nmxCommandCh._noble) {
                        //    _nmxReadCh.once('data', function(data) {
                        //        console.log("read data:", data);
                        //        item.callback(null, _parseNMXData(data));
                        //    });
                        //} else {
                            setTimeout(function() {
                                console.log("NMX: reading data...");
                                _nmxReadCh.read(function(err, data) {
                                    if(err) console.log("NMX: error reading:", err);
                                    console.log("read data:", data);
                                    item.callback(null, _parseNMXData(data, item.responseType));
                                });
                            }, item.readbackDelayMs);
                        //}
                    } else {
                        if(_nmxCommandCh._noble) {
                            item.callback(null);
                        } else {
                            _nmxReadCh.read(function(err, data) {
                                console.log("read data (discarded):", data);
                                item.callback(null);
                            });
                        }
                    }
                } else {
                    if(!_nmxCommandCh._noble) _nmxReadCh.read(function(err, data) {
                        console.log("read data (discarded) (ncb):", data);
                    });
                }
                setTimeout(function() {
                    _runQueue(null, true);
                }, COMMAND_SPACING_MS);
            });
        })(nextItem);
    } else {
        console.log("NMX: queue complete");
        _queueRunning = false;
    }
}

function _parseNMXData(dataBuf, type) {
    var dataOffset = 0;
    if (!dataBuf) return null;
    if (dataBuf.length < dataOffset) return null;

    var len = dataBuf.length;//[dataOffset - 2];
    //var type = dataBuf[dataOffset - 1];

    if (type == 0 && dataBuf.length >= dataOffset + 1) return dataBuf.readUInt8(dataOffset);
    if (type == 1 && dataBuf.length >= dataOffset + 2) return dataBuf.readUInt16BE(dataOffset);
    if (type == 2 && dataBuf.length >= dataOffset + 2) return dataBuf.readInt16BE(dataOffset);
    if (type == 3 && dataBuf.length >= dataOffset + 4) return dataBuf.readUInt32BE(dataOffset);
    if (type == 4 && dataBuf.length >= dataOffset + 4) return dataBuf.readInt32BE(dataOffset);
    if (type == 5 && dataBuf.length >= dataOffset + 4) return dataBuf.readInt32BE(dataOffset) / 100;
    if (type == 6 && dataBuf.length >= dataOffset + 1) return dataBuf.toString('ascii', dataOffset);

    console.log("NMX data length mismatch (type: " + type + ", length: " + dataBuf.length + ")");

    return null;
}
