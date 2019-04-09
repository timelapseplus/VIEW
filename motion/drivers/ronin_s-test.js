//var Ronin = require('./ronin_s.js');
var noble = require('noble');

//var ronin = new Ronin();

noble.on('stateChange', btStateChange);
noble.on('discover', btDiscover);

var cmdCh = null;
var readCh = null;
var notifyCh = null;

var wIndex = 0;
var cmds = [
    "550d043302e5140040000162eb",
    "550e046602e50f0080000e002702",
    "550e046602e5150080000e009969",
    "550e046602e5650080000e8898ac",
    "550d043302262100400001e912",
];
var tilt = 0;
var roll = 0;
var pan = 0;
var posTimer = null;

function btDiscover(peripheral) {
    //console.log("BT peripheral", peripheral);

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
                                            //console.log("expectedLength =", expectedLength);
                                            buf = data;
                                        } else {
                                            buf = Buffer.concat([buf, data]);
                                        }
                                        if(buf.length >= expectedLength) {
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
                                                    cmdCh.write(new Buffer("550e046602e5c70080000e000c24", 'hex')); // get positions
                                                }
                                            } else if(expectedLength == 0x0e) {
                                                if(buf.readUInt16LE(9) == 0x1404 || buf.readUInt16LE(9) == 0xe00a) { // moved
                                                    cmdCh.write(new Buffer("550e046602e5c70080000e000c24", 'hex')); // get positions
                                                }
                                            }
                                            expectedLength = 0;
                                            //console.log("BT data received:", buf);
                                        }
                                        if(buf.length > 255) {
                                            expectedLength = 0;
                                        }
                                    });
                                });
                            }
                            //if(ch.uuid == 'fff1') {
                            //    readCh = ch;
                            //    setInterval(function() {
                            //        readCh.read(function(err, data){
                            //            console.log("BT data received 1:", data);
                            //        });
                            //    }, 1000);
                            //}
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

                                setTimeout(function() {
                                    cmdCh.write(new Buffer("550e046602e5c70080000e000c24", 'hex')); // get positions --- works
                                }, 1000);

                                setTimeout(function() {
                                    console.log("moving...");
                                    cmdCh.write(new Buffer("551504a90204010040041484030000c2010514dd", 'hex'));
                                    cmdCh.write(new Buffer("2b", 'hex'));
                                }, 10000);
                                setTimeout(function() {
                                    console.log("moving...");
                                    cmdCh.write(new Buffer("551504a9020401004004140000000000000514fc", 'hex'));
                                    cmdCh.write(new Buffer("06", 'hex'));
                                }, 20000);
                                setInterval(function() {
                                    //console.log("writing:");
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
    noble.startScanning(['fff0'], false, function(err){
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
