// example for the apds gesture sensor
var GestureLib = require('../');
var I2C_PORT = 2;

var gesture = GestureLib.use(I2C_PORT, 72);

gesture.debug = true;

gesture.on('ready', function() {
    console.log("found a gesture sensor");

    gesture.calibrate(function(err, status, calResults) {
        if(calResults) {
            gesture.start();
        } else if(err) {
            console.log("error calibrating: ", err);
        }
    });

});

gesture.on('error', function(err) {
    console.log("Error: ", err);
});

gesture.on('movement', function(dir) {
    console.log("Sensed movement", dir);
});


