var CMD_MOTOR_MOVE = {
    cmd: 0x0F,
    hasReponse: false,
    hasAck: true,
    delay: 0
}
var CMD_MOTOR_MOVE_CONSTANT = {
    cmd: 0x0D,
    hasReponse: false,
    hasAck: false,
    delay: 0
}
var CMD_MOTOR_SET_ACCEL = {
    cmd: 0x0E,
    hasReponse: false,
    hasAck: true,
    delay: 0
}
var CMD_MOTOR_ENABLE = {
    cmd: 0x03,
    hasReponse: false,
    hasAck: true,
    delay: 0
}
var CMD_MOTOR_STATUS = {
    cmd: 0x6B,
    hasReponse: true,
    hasAck: true,
    delay: 10
}
var CMD_MOTOR_POSITION = {
    cmd: 0x6A,
    hasReponse: true,
    hasAck: true,
    delay: 50
}
var CMD_MOTOR_RESET = {
    cmd: 0x1B,
    hasReponse: false,
    hasAck: true,
    delay: 0
}
var CMD_FIRMWARE_VERSION = {
    cmd: 0x64,
    hasReponse: true,
    hasAck: true,
    delay: 0
}
var CMD_CHECK_JOYSTICK_MODE = {
    cmd: 0x78,
    hasReponse: true,
    hasAck: true,
    delay: 0
}
var CMD_CONNECTED_MOTORS = {
    cmd: 0x7C,
    hasReponse: true,
    hasAck: true,
    delay: 200
}
var CMD_JOYSTICK_MODE = {
    cmd: 0x17,
    hasReponse: false,
    hasAck: true,
    delay: 200
}
var CMD_PROGRAM_MODE = {
    cmd: 0x16,
    hasReponse: false,
    hasAck: true,
    delay: 200
}
var CMD_APP_MODE = {
    cmd: 0x33,
    hasReponse: false,
    hasAck: true,
    delay: 200
}
var CMD_JOYSTICK_WATCHDOG = {
    cmd: 0x0E,
    hasReponse: false,
    hasAck: true,
    delay: 200
}

var COMMAND_SPACING_MS = 100

var EventEmitter = require("events").EventEmitter;
var SerialPort = require('serialport');

var nmx = new EventEmitter();


var motorRunning = {'1': false, '2': false, '3': false};
var motorPos = {'1': 0, '2': 0, '3': 0};
var motorConnected = [false, false, false];

var _nmxQueue = [];
var _queueRunning = false;
var _dev = null;
var _nmxCommandCh = null;
var _nmxReadCh = null;
var _keepAliveHandle = null;

function keepAlive(enable) {
    if(enable === undefined) enable = true;
    if(_keepAliveHandle) clearInterval(_keepAliveHandle);
    if(enable) {
        _keepAliveHandle = setInterval(function(){
            if(_dev && _dev.connected) {
                checkMotorAttachment();
            } else {
                keepAlive(false);
            }
        }, 15000);
    }
}

function getStatus() {
    var type = (_dev && _dev.type) ? _dev.type : null;
    return {
        connected: _dev && _dev.connected,
        connectionType: type,
        motor1: motorConnected[0],
        motor2: motorConnected[1],
        motor3: motorConnected[2],
        motor1pos: motorPos[1],
        motor2pos: motorPos[2],
        motor3pos: motorPos[3]
    }   
}

function move(motorId, steps, callback) {
    if (motorRunning[motorId]) return console.log("NMX: motor already running");
    console.log("NMX: moving motor " + motorId);
    if(!enabled[motorId]) enable(motorId);
    if(inJoystickMode) return joystickMode(false, function() {
        move(motorId, steps, callback);
    });
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
        command: CMD_MOTOR_MOVE,
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
                            checkMotorPosition(motorId, function(position) {
                                motorPos[motorId] = position;
                                keepAlive(true);
                                if (callback) callback(null, position);
                            })
                        }
                    });
                }, 200);
            })(motorId);
        } else {
            keepAlive(true);
            if (callback) callback(err);
            motorRunning[motorId] = false;
        }
    });
}

function setAccel(motorId, rate, callback) {
    if (motorRunning[motorId]) return console.log("NMX: motor running");
    console.log("NMX: setting accel for " + motorId);

    var m = new Buffer(4);
    m.fill(0);
    m.writeUInt32BE(rate, 0, 4);

    var cmd = {
        motor: motorId,
        command: CMD_MOTOR_SET_ACCEL,
        dataBuf: m
    }

    _queueCommand(cmd, function(err) {
        if (callback) callback(err);
    });
}

var inJoystickMode = false;
var enabled = {};
function constantMove(motorId, speed, callback) {
    //if (motorRunning[motorId]) return console.log("NMX: motor already running");
    console.log("NMX: moving motor (constant) " + motorId + " at speed " + speed);
    if(!enabled[motorId]) enable(motorId);
    if(!inJoystickMode) return joystickMode(true, function(){
        if(inJoystickMode) {
            constantMove(motorId, speed, callback);
        } else {
            callback && callback("failed to enter joystick mode");
        }
    });
    var m = new Buffer(4);
    m.fill(0);
    var maxSpeed =  4250 + 750;
    speed = Math.floor((speed / 100) * maxSpeed);
    if(speed > maxSpeed) speed = maxSpeed;
    if(speed < -maxSpeed) speed = -maxSpeed;
    m.writeInt32BE(speed, 0, 4);
    motorRunning[motorId] = true;

    var cmd = {
        motor: motorId,
        command: CMD_MOTOR_MOVE_CONSTANT,
        dataBuf: m
    }

    _queueCommand(cmd, function(err) {
        if (!err) {
            motorRunning[motorId] = false;
                if(speed != 0) return callback && callback(null); // only check position when stopped
                setTimeout(function() {
                    motorRunning[motorId] = false;
                    checkMotorPosition(motorId, function(position) {
                        motorPos[motorId] = position;
                        if (callback) callback(null, position);
                    });
                }, 200);
        } else {
            if (callback) callback(err);
            motorRunning[motorId] = false;
        }
    });
}

function checkJoystickMode(callback) {
    var cmd = {
        motor: 0,
        command: CMD_CHECK_JOYSTICK_MODE
    }
    _queueCommand(cmd, function(err, jsMode) {
        console.log("NMX: joystick mode: ", jsMode);
        inJoystickMode = jsMode;
        if (callback) callback(jsMode);
    });
}

function checkMotorRunning(motorId, callback) {
    var cmd = {
        motor: motorId,
        command: CMD_MOTOR_STATUS
    }
    _queueCommand(cmd, function(err, moving) {
        console.log("NMX: motor " + motorId + " moving: ", moving);
        if (callback) callback(moving);
    });
}

function checkMotorAttachment(callback) {
    var cmd = {
        motor: 0,
        command: CMD_CONNECTED_MOTORS
    }
    _queueCommand(cmd, function(err, status) {
        if(!err) {
            motorConnected[0] = (status & 1<<0) ? true : false;
            motorConnected[1] = (status & 1<<1) ? true : false;
            motorConnected[2] = (status & 1<<2) ? true : false;
            console.log("NMX: motors connected", motorConnected);
        }
        if (callback) callback(motorConnected);
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
        console.log("NMX: motor " + motorId + " position: ", position);
        motorPos[motorId] = position;
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
function setProgramMode(mode, callback) {
    var cmd = {
        motor: 0,
        command: CMD_PROGRAM_MODE,
        dataBuf: new Buffer("0" + mode.toString(), 'hex'),
        readback: false
    }
    _queueCommand(cmd, function(err) {
        if (callback) callback(err);
    });
}
function setAppMode(callback) {
    var cmd = {
        motor: 0,
        command: CMD_APP_MODE,
        dataBuf: new Buffer("01", 'hex'),
        readback: false
    }
    _queueCommand(cmd, function(err) {
        if (callback) callback(err);
    });
}

var enteringJoystickMode = null;
function joystickMode(en, callback) {
    console.log("NMX: setting joystick mode to ", en);
    var checkMode = function(tries){
        if(!tries) tries = 0;
        checkJoystickMode(function(jsMode){
            if(jsMode == en) {
                enteringJoystickMode = null;
                callback && callback(null);
            } else {
                tries++;
                if(tries > 5) {
                    console.log("NMX: failed to change joystick mode. Current:", inJoystickMode);
                    callback && callback("failed to change joystick mode");
                } else {
                    setTimeout(function() {
                        checkMode(tries);
                    }, 100);
                }
            }
        });
    }

    if(enteringJoystickMode === null) {
        enteringJoystickMode = en ? true : false;
        var cmd = {
            motor: 0,
            command: CMD_JOYSTICK_MODE,
            dataBuf: new Buffer(en ? "01" : "00", 'hex')
        }
        _queueCommand(cmd, function(err) {});
        cmd2 = {
            motor: 0,
            command: CMD_JOYSTICK_WATCHDOG,
            dataBuf: new Buffer("00", 'hex')
        }
        _queueCommand(cmd2, function(err) {
            checkMode();
        });
    } else {
        checkMode();
    }
}

function enable(motorId) {
    if (!motorId) return;
    enabled[motorId] = true;
    var cmd = {
        motor: motorId,
        command: CMD_MOTOR_ENABLE,
        dataBuf: new Buffer("01", 'hex')
    }
    _queueCommand(cmd);
}

function disable(motorId) {
    if (!motorId) return;
    enabled[motorId] = false;
    var cmd = {
        motor: motorId,
        command: CMD_MOTOR_ENABLE,
        dataBuf: new Buffer("00", 'hex')
    }
    _queueCommand(cmd);
}

function disconnect() {
    if (_dev && _dev.connected) {
        _dev.disconnect();
    } else {
        _dev = null;
    }
    nmx.emit("status", getStatus());
}

function connect(device, callback) {
    if (device && typeof device == "string") {
        _connectSerial(device, callback);
    } else if (device && device.connect) {
        _connectBt(device, callback);
    } else if (!device || typeof device == "function") {
        SerialPort.list(function(err, ports) {
            console.log("NMX: scanned serial ports:", ports);
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

nmx.btServiceIds = [currentNMX, legacyNMX];
nmx.connect = connect;
nmx.disconnect = disconnect;
nmx.disable = disable;
nmx.enable = enable;
nmx.move = move;
nmx.constantMove = constantMove;
nmx.getStatus = getStatus;
nmx.resetMotorPosition = resetMotorPosition;

module.exports = nmx;

// private functions //

var receiveBuf = [];
var buf = null;
var header = Buffer("0000000000FF0000", 'hex');

function parseIncoming() {
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
            if (buf.length >= header.length + 2 + length) {
                var responseData = buf.slice(header.length + 1, header.length + 2 + length);
                //console.log("NMX DATA (" + length + "):", buf);//responseData);
                receiveBuf.push(responseData);
                buf = buf.slice(header.length + 2 + length);
                parseIncoming();
            }
        } else {
            console.log("NMX: discarding data to resync");
            buf = buf.slice(1); // take a byte off the front and try again to match header
            parseIncoming();
        }
    }
}

function readData(cb) {
    if(!_dev) return cb && cb("not connected");
    var tries = 10; // 1 second
    var checkForData = function() {
        if(!_dev) return cb && cb("not connected");
        if (receiveBuf.length > 0) {
            //console.log("receiveBuf:", receiveBuf);
            var readData = receiveBuf.shift();
            if (cb) cb(null, readData);
        } else {
            if (tries > 0) {
                tries--;
                setTimeout(checkForData, 100);
            } else {
                console.log("NMX: timed out waiting for data");
                if (cb) cb("timed out");
            }
        }
    }
    checkForData();
}

function _connectSerial(path, callback) {
    console.log("NMX: connecting via " + path);
    _dev = {};
    _dev.port = new SerialPort(path, {
        baudrate: 19200
    }, function() {
        console.log('NMX: serial opened');
        if (!_dev) return;
        _dev.connected = true;
        _dev.type = "serial";
        _dev.state = "connected";

        _dev.port.once('disconnect', function(err) {
            if (err && _dev.connected) {
                _dev = null;
                nmx.emit("status", getStatus());
                console.log("NMX: ERROR: NMX Disconnected: ", err);
                console.log("NMX: reconnecting");
                process.nextTick(function() {
                    _connectSerial(path);
                });
            }
        });
        _dev.port.once('error', function(err) {
            console.log("NMX: ERROR: ", err);
        });
        _dev.port.once('close', function() {
            console.log("NMX: CLOSED");
        });

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
            read: readData
        }
        _dev.disconnect = function() {
            _dev.connected = false;
            _dev.port.close(function() {
                _dev.port = null;
            });
        }
        init();
        if (callback) callback(true);
    });
}

function init() {
    checkMotorAttachment(function(){
        checkMotorPosition(1);
        checkMotorPosition(2);
        checkMotorPosition(3, function(){
            nmx.emit("status", getStatus());
        });
    });
    firmwareVersion(function(err, version) {
        console.log("NMX: connected!");
        console.log("NMX: firmware version: ", version);
        //resetMotorPosition(1);
        //resetMotorPosition(2);
        //resetMotorPosition(3);
        setAccel(1, 25000);
        setAccel(2, 25000);
        setAccel(3, 25000);
    });
}

function _connectBt(btPeripheral, callback) {
    btPeripheral.connect(function(err1) {
        if (err1) {
            if (callback) callback(false);
            return;
        }
        console.log('NMX: connecting via BLE');
        btPeripheral.discoverServices(nmx.btServiceIds, function(err2, services) {
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
                        _nmxReadCh.subscribe(function(){
                            _dev = btPeripheral;
                            _dev.connected = true;
                            _dev.type = "bt";
                            _nmxReadCh.subscribe();
                            _nmxReadCh.on('data', function(data, isNotification) {
                                if(isNotification) {
                                    if (buf && buf.length > 0) {
                                        buf = Buffer.concat([buf, data]);
                                    } else {
                                        buf = data;
                                    }
                                    parseIncoming();
                                }
                            });
                            console.log("NMX: connected!");
                            init();
                            if (callback) callback(true);
                        });
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
            console.log("NMX: disconnected");
            _dev = null;
            nmx.emit("status", getStatus());
        });

    });

}

function _queueCommand(object, callback) {
    var motor = object.motor; // required
    var command = object.command; // required
    var dataBuf = object.dataBuf || null;
    var readback = object.command.hasReponse !== false;
    var ack = object.command.hasAck !== false;
    var readbackDelayMs = object.command.delay || 100;

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
        ack: ack,
        readbackDelayMs: readbackDelayMs,
        callback: callback
    };
    _runQueue(queueItem);
}

function _runQueue(queueItem, rec) {
    //console.log("NMX: queue starting...");
    if (queueItem) {
        _nmxQueue.push(queueItem);
    }
    if (_queueRunning && !rec) {
        return;
    } else {
        _queueRunning = true;
    }

    //console.log("NMX: running queue...");
    var nextItem = _nmxQueue.shift();
    if (!_dev || !_dev.state || _dev.state != "connected") {
        _queueRunning = false;
        _nmxQueue = [];
        console.log("NMX: error not connected");
        if (nextItem && nextItem.callback) nextItem.callback("not connected");
    }


    if (nextItem) {
        console.log("NMX: writing", nextItem.buffer);
        (function(item) {
            _nmxCommandCh.write(item.buffer, true, function(err) {
                if(err) console.log("NMX: error writing:", err);
                //console.log("checking callback");
                if (item.readback) {
                    setTimeout(function() {
                        ///console.log("NMX: reading data...");
                        readData(function(err, data) {
                            if(err) console.log("NMX: error reading:", err);
                            console.log("NMX: read data:", data);
                            item.callback && item.callback(null, _parseNMXData(data));
                            setTimeout(function() {
                                _runQueue(null, true);
                            }, COMMAND_SPACING_MS);
                        });
                    }, item.readbackDelayMs);
                } else if(item.ack) {
                    readData(function(err, data) {
                        //console.log("read data (discarded):", data);
                        item.callback && item.callback(null);
                        setTimeout(function() {
                            _runQueue(null, true);
                        }, COMMAND_SPACING_MS);
                    });
                } else {
                    item.callback && item.callback(null);
                    setTimeout(function() {
                        _runQueue(null, true);
                    }, COMMAND_SPACING_MS);
                }
            });
        })(nextItem);
    } else {
        //console.log("NMX: queue complete");
        _queueRunning = false;
    }
}

function _parseNMXData(dataBuf) {
    var dataOffset = 2;
    if (!dataBuf) return null;
    if (dataBuf.length < dataOffset) return null;

    var len = dataBuf[dataOffset - 2];
    var type = dataBuf[dataOffset - 1];

    //console.log("NMX: data type", type, "length", len);

    if (type == 0 && dataBuf.length >= dataOffset + 1) return dataBuf.readUInt8(dataOffset);
    if (type == 1 && dataBuf.length >= dataOffset + 2) return dataBuf.readUInt16BE(dataOffset);
    if (type == 2 && dataBuf.length >= dataOffset + 2) return dataBuf.readInt16BE(dataOffset);
    if (type == 3 && dataBuf.length >= dataOffset + 4) return dataBuf.readUInt32BE(dataOffset);
    if (type == 4 && dataBuf.length >= dataOffset + 4) return dataBuf.readInt32BE(dataOffset);
    if (type == 5 && dataBuf.length >= dataOffset + 4) return dataBuf.readInt32BE(dataOffset) / 100;
    if (type == 6 && dataBuf.length >= dataOffset + 1) return dataBuf.toString('ascii', dataOffset);

    console.log("NMX: error: data length mismatch (type: " + type + ", length: " + dataBuf.length + ")");

    return null;
}
