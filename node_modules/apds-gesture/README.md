#APDS Gesture control driver

![demo](https://s3.amazonaws.com/technicalmachine-assets/gifs/apds.gif)

Uses the [Sparkfun Gesture sensor](https://www.sparkfun.com/products/12787) and a [Tessel DIY module](https://shop.tessel.io/Modules/DIY%20Module%3A%20Single-Wide).

Physical hookup is this:

Gesture Sensor | DIY Module
---------------|------------
3.3V           | 3.3V
GND            | GND
SDA            | SDA
SCL            | SCL
INT            | GPIO 1 (G1)


##Usage

Install with `npm install apds-gesture`

Example usage:

```js
// example for the apds gesture sensor
var tessel = require('tessel');
var GestureLib = require('apds-gesture');
var G_THRESHOLD = 15
  , G_SENSITIVITY = 0.5//0.5
  ;

var gesture = GestureLib.use(tessel.port['A'], 
	{'threshold': G_THRESHOLD, 'sensitivity': G_SENSITIVITY});

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
