# Sensor TSL2561 for node.js
---
A node.js module for working with the light sensor TSL2561 via i2c.

## About the sensor
The TSL2561 is a light sensor who combines one broadband photodiode (visible plus infrared) and one infrared-responding photodiode. That means you can separately measure infrared, full-spectrum or human-visible light. A breakout with the sensor is available at [adafruit](http://www.adafruit.com/products/439) or [watterott (Germany)](http://www.watterott.com/de/TSL2561-Lichtsensor).
This driver/module based on the [latest datasheet from ams](http://www.ams.com/eng/Products/Light-Sensors/Light-to-Digital-Sensors/TSL2561). An older version is available at [adafruit](http://www.adafruit.com/datasheets/TSL2561.pdf).

## Install
```
$ npm install sensor_tsl2561
```
#### Raspberry PI
Enable [i2c on your Pi](https://github.com/kelly/node-i2c#raspberry-pi-setup) if you haven't done already. To avoid having to run the i2c tools as root add the ‘pi’ user to the i2c group:
```
sudo adduser pi i2c
```

## Usage
The module is easy to use. You have different config-options 

### Simple Usage
```
var TSL2561 = require('sensor_tsl2561');

var sense = new TSL2561();
sense.init(function(err, val) {
  if (!err) {
    sense.getLux(function(error, val) {
      if (!error) console.log(val + ' lux');
    });    
  }
});
```
 
### Don't forget to call init()
```ìnit()``` powers up the sensor and sets the given options.

### Options
The default options are:
```
{
    'debug': false,
    'address': 0x39,
    'device': '/dev/i2c-1',
    'powerMode': 'powerUp',
    'timingMode': '402ms',
    'gainMode': '1',
    'packageType': 'auto',
}
```

Configure the sensor by supplying an options object to the constructor like:
```
var sense = new TSL2561({
    'timingMode': '13.7ms',
    'gainMode': '16'
});
```
### packageType-Option
The sensor is available as package type "CS" or "T/FN/CL". The package types are using different lux calculation methods. You can set the package type as
```CS```, ```T/FN/CL``` or ```auto```. If ```auto``` is set, the value from ```ID-Register``` is used to get the sensors package type. For more details on this read the id section in the old and the new manual to see the differences.

### Getter & Setter for sensor settings
Getter supports only callbacks. Setter supports callbacks and event-emitters - ```sensorSettingChanged``` and ```sensorSettingFailed```. Getter and setter are:
```
getPowerMode(cB) / setPowerMode(newMode, [cB]) / modes: 'powerUp', 'powerDown'
getTimingMode(cB) / setTimingMode(newMode, [cB]) / modes: '13.7ms', '101ms', '402ms', 'n/a'
getGainMode(cB) / setGainMode(newMode, [cB]) / modes: '1', '16'
```

The ```sensorId``` is only a getter:
```
getSensorId(cB) / with 'TSL2560CS', 'TSL2561CS', 'TSL2560T/FN/CL', 'TSL2561T/FN/CL'
```

### Light-Measurements
Measurement-functions using a callback and some of them an event-emitter. All events including a timestamp and additional data like the address to determine the sensor, who emitted the event.

* ```getLight0([cB])``` - channel 0 light value
* ```getLight1([cB])``` - channel 1 light value
* ```getLux([cB])``` - the calculated lux value (depends on channel 0 and 1) - emits event ```newSensorValue``` on success or ```sensorValueError``` on error
* ```getAllValues([cB])``` - all values (raw and calculated) - emits event ```newSensorValues``` on success or ```sensorValuesError``` on error

## Tests
Because it's not really a good idea to run test in an unknown environment all tests under test using a faked devices and not really your i2c bus. The faked device using a faked i2c-bus which is realised with the proxyquire module.

To run the complete test suite nodeunit is required. The best way is using grunt and the shipped gruntfile which comes with this module.

## Examples
All examples are using a real device on address ```0x39``` on your i2c bus. Be carefully if you have more as one device on your i2c or/and if you don't use the default address for the sensor.

## Licence
The licence is GPL v3 and the module is available at [Bitbucket](https://bitbucket.org/iwg/tsl2561_node) and [GitHub](https://github.com/imwebgefunden/tsl2561_node).