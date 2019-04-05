//var Ronin = require('./ronin_s.js');
var noble = require('noble');

//var ronin = new Ronin();

noble.on('discover', btDiscover);
noble.startScanning([], false, function(err){
    console.log("BLE scan started: ", err);
});

function btDiscover(peripheral) {
	console.log("BT peripheral", peripheral);
}