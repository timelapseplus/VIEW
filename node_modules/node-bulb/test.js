var bulb = require('./build/Release/bulb.node');

var options = {
    bulbMicroSeconds: 33000,
    preFocusMs: 500,
    endLagMicroSeconds: 31933,
    startLagMicroSeconds: 96837,
    expectSync: true,
    runTest: false
}
console.log("Starting bulb test...");
bulb(options, function(err, start_us, stop_us, actual_us, errorPercent) {
    console.log("...done.");
    console.log('err:', err);
    console.log('start_us:', start_us);
    console.log('stop_us:', stop_us);
    console.log('actual_us:', actual_us);
    console.log('errorPercent:', errorPercent);
});