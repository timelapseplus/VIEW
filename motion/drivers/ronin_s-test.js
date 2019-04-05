//var Ronin = require('./ronin_s.js');
var noble = require('noble');

//var ronin = new Ronin();

noble.on('stateChange', btStateChange);
noble.on('discover', btDiscover);

function btDiscover(peripheral) {
	console.log("BT peripheral", peripheral);
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

