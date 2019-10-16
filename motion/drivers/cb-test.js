//var Ronin = require('./ronin_s.js');
var noble = require('noble');

//var ronin = new Ronin();

noble.on('stateChange', btStateChange);
noble.on('discover', btDiscover);

var cmdCh = null;
var notifyCh = null;


function btDiscover(peripheral) {
    console.log("BT peripheral", peripheral._services[0]);

    if(peripheral.advertisement.serviceUuids[0] == 'fff0') {
        console.log("BT connecting to", peripheral.address);
        peripheral.connect(function(err1) {
            peripheral.discoverServices(['fff0'], function(err2, services) {
                //console.log("services:", services);
                if (services && services[0]) {
                    services[0].discoverCharacteristics([], function(err, characteristics) {
                        for(var i = 0; i < characteristics.length; i++) {
                            var ch = characteristics[i];
                            if(ch.uuid == 'fff4') {
                                notifyCh = ch;
                                notifyCh.subscribe(function(){
                                    console.log("subscribed...");
                                    var expectedLength = 0;
                                    var buf;
                                    notifyCh.on('data', function(data, isNotification) {
                                        if(expectedLength == 0 && data.readUInt8(0) == 0x55) {
                                            expectedLength = data.readUInt8(1);
                                            console.log("expectedLength =", expectedLength.toString(16));
                                            buf = data;
                                        } else if(expectedLength > 0 && buf) {
                                            console.log("concatenating data..");
                                            buf = Buffer.concat([buf, data]);
                                        } else {
                                            console.log("unknown data: ", data, buf);
                                        }
                                        if(buf && buf.length >= expectedLength) {
                                            if(expectedLength == 0x23) {
                                                if(buf.readUInt16LE(21) == 0x0222 && buf.readUInt16LE(25) == 0x0223 && buf.readUInt16LE(29) == 0x0224) {
                                                    var ntilt = buf.readInt16LE(23) / 10;
                                                    var nroll = buf.readInt16LE(27) / 10;
                                                    var npan = buf.readInt16LE(31) / 10;
                                                    console.log("POSITIONS:", pan, tilt, roll);
                                                    if(tilt != ntilt || roll != nroll || pan != npan) {
                                                        if(posTimer) clearTimeout(posTimer);
                                                        posTimer = setTimeout(function() { 
                                                            posTimer = null;
                                                            cmdCh.write(new Buffer("550e046602e5c70080000e000c24", 'hex')); // get positions
                                                        }, 1000);
                                                    }
                                                    pan = npan;
                                                    tilt = ntilt;
                                                    roll = nroll;

                                                }
                                            } else if(expectedLength == 0x11) {
                                                if(buf.readUInt16LE(10) == 0x10f1 && buf.readUInt8(12) == 0x40) { // moved
                                                    cIndex++;
                                                    var buf = new Buffer('5500' + '046602e5c70080000e00', 'hex');
                                                    buf.writeUInt8(buf.length + 2, 1);
                                                    //buf.writeUInt8(cIndex + 1, 6);
                                                    var chksm = new Buffer('0000', 'hex');
                                                    chksm.writeUInt16LE(crc(buf.slice(2), 0x965c), 0);
                                                    buf = Buffer.concat([buf, chksm]);
                                                    console.log("writing", buf);
                                                    cmdCh.write(buf); // get positions
                                                }
                                            } else if(expectedLength == 0x0e) {
                                                if(buf.readUInt16LE(9) == 0x1404 || buf.readUInt16LE(9) == 0xe00a) { // moved
                                                    cmdCh.write(new Buffer("550e046602e5c70080000e000c24", 'hex')); // get positions
                                                }                          //"550e046602e5070080000e002310"
                                            }
                                            expectedLength = 0;
                                            console.log("BT data received:", buf);
                                        }
                                        if(buf && buf.length > 255) {
                                            expectedLength = 0;
                                        }
                                    });
                                });
                            }
                            if(ch.uuid == 'fff5') {
                                cmdCh = ch;
                                //cmdCh.write(new Buffer("550e046602e5010080000e00853b", 'hex'));
                                //cmdCh.write(new Buffer("550d0433020e02004000018ccb", 'hex'));
                                //cmdCh.write(new Buffer("550e046602e50300400032110016", 'hex'));
                                //cmdCh.write(new Buffer("550d04330227040040070ef8e5", 'hex'));
                                //cmdCh.write(new Buffer("550d0433020405004000015ed2", 'hex'));
                                //cmdCh.write(new Buffer("550e046602e5070040003211ac06", 'hex'));
                                //cmdCh.write(new Buffer("551b047502e50800400412103e010000000c0000", 'hex'));
                                //cmdCh.write(new Buffer("50660c001ccd23", 'hex'));

                                //setTimeout(function() {  //"550e046602e5010080000e00d908"
                                //    cmdCh.write(new Buffer("550e046602e5c70080000e000c24", 'hex')); // get positions --- works
                                //}, 1000);
//
                                //setTimeout(function() {
                                //    console.log("moving...");
                                //    cmdCh.write(new Buffer("551504a90204010040041484030000c2010514dd", 'hex'));
                                //    cmdCh.write(new Buffer("2b", 'hex'));
                                //}, 10000);
                                //setTimeout(function() {
                                //    console.log("moving...");
                                //    cmdCh.write(new Buffer("551504a9020401004004140000000000000514fc", 'hex'));
                                //    cmdCh.write(new Buffer("06", 'hex'));
                                //}, 20000);
                                var cIndex = 0;
                                setInterval(function() {
                                    if(cIndex < cmds.length) {
                                        var buf = new Buffer(cmds[cIndex], 'hex');
                                        //var buf = new Buffer('5500' + commands[cIndex], 'hex');
                                        //buf.writeUInt8(buf.length + 2, 1);
                                        //buf.writeUInt8(cIndex + 1, 6);
                                        //var chksm = new Buffer('0000', 'hex');
                                        //chksm.writeUInt16LE(crc(buf.slice(2)), 0);
                                        //buf = Buffer.concat([buf, chksm]);
                                        var startIndex = 0;
                                        while(buf.length - startIndex > 0) {
                                            var nb = buf.slice(startIndex, startIndex + 20);
                                            //console.log("Ronin(" + this._id + "): writing chunk", nb);
                                            cmdCh.write(nb);
                                            startIndex += nb.length;
                                        }

                                        cIndex++;
                                        console.log(cIndex, "or", cmds.length, ":", buf);
                                    }
                                    //if(wIndex % 3 == 0) 
                                    //cmdCh.write(new Buffer("550e0466e502010080041200d4c2", 'hex')); // general status poll?
                                    //if(wIndex % 3 == 1) cmdCh.write(new Buffer("550d043302263400400001fd80", 'hex')); // gets pan
                                    //if(wIndex % 3 == 2) cmdCh.write(new Buffer("550d043302c532004000010b35", 'hex'));
                                    //wIndex++;
                                }, 1000);
                            }
                        }
                        //console.log("characteristics:", characteristics);
                    });
                }
            });
        });
    }
}



function startScan() {
    noble.startScanning([], false, function(err){
        console.log("BLE scan started: ", err);
    });
}

function btStateChange(state) {
    console.log("CORE: BLE state changed to", state);
    if (state == "poweredOn") {
        setTimeout(function() {
            startScan();
            setTimeout(function(){
                noble.stopScanning();
                setTimeout(startScan, 1000);
            }, 4000);
        });
    }
}

// fff5 = writeWithoutResponse -- primary commands
// fff4 = notify


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

//var crcInit = 0xDC29; // for commands
//var crcInit = 0x965c; // for polling

var finalXor = 0x0000;

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
//551e048a02e559004004126624c01d00001c103e010300008c0e005009a2
for(var x = 0; x <= 0xFFFF; x++) { 
    if(crc(new Buffer("048a02e559004004126624c01d00001c103e010300008c0e0050", 'hex'), x).toString(16) == 'a209') {
        console.log(x.toString(16)); 
        break;
    }
}