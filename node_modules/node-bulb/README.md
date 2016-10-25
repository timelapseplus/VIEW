# node-bulb
low-level camera remote shutter bulb control using mraa for node.js

# requirements

MRAA library for pin-level i/o

Requires node-gyp for building

Setup pins in bulb.h

# usage

```
var bulb = require('node-bulb');

var options = {
    bulbMicroSeconds: 33000,
    preFocusMs: 500,
    endLagMicroSeconds: 31933,
    startLagMicroSeconds: 96837,
    expectSync: true,
    runTest: false
}

bulb(options, function(err, start_us, stop_us, actual_us, error_percent) {
    console.log('start_us:', start_us);
    console.log('stop_us:', stop_us);
    console.log('actual_us:', actual_us);
    console.log('error_percent:', error_percent);
});
```

# acknowledgements

based on this awesome template: https://gist.github.com/eristoddle/948f77cc8da2779484cb