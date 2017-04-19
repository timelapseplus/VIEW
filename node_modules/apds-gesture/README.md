#APDS Gesture control driver

Updated for use on a generic system and added a calibration routine.

##Usage

Install with `npm install apds-gesture`

Example usage:

```js
// example for the apds gesture sensor
var tessel = require('tessel');
var GestureLib = require('apds-gesture');

var gesture = GestureLib.use(2); // uses i2c bus 2

gesture.debug = true;

gesture.on('ready', function(){
  console.log("found a gesture sensor");
  gesture.setup(function(){
     gesture.readGesture();
  });
});

gesture.on('movement', function(dir){
  console.log("Sensed movement", dir);
});

gesture.on('error', function (err){
  console.log("Error: ", err);
});
```
