pitft
=====

### A [NodeJS](http://nodejs.org) module for the Adafruit PiTFT family of displays for the [Raspberry Pi](http://www.raspberrypi.org) computer.

With this module, you can draw lines, circles, rectangles, text and images to your Adafruit PiTFT from your NodeJS application.  Includes double buffering support for flicker-free drawing.  This module is only tested on the [2.8" PiTFT](http://www.adafruit.com/product/1601) but should work on other displays from Adafruit.

## Author
  - Werner Vesterås <wvesteraas@gmail.com>

## Installation

To be able to use this module, the Adafruit PiTFT driver must be installed.  I recommend following the installation guide for your particular device.  I used the excellent **DIY Installer script** that Adafruit provides in the installation guide for my PiTFT device, and I guess it can be used for the other devices in the PiTFT family, too.  Just remember to answer **no** when the question **"Would you like the console to appear on the PiTFT display?"** comes up.

You will also need to install the [Cairo](http://cairographics.org) library.  This can be done from the console on your Raspberry Pi:

```bash
$ sudo apt-get install libcairo2-dev
```

Finally, you can install the pitft module itself:

```bash
$ npm install pitft
```

## Examples

Instead of writing a lot of documentation, I've written a few example programs.  They can be found in the [examples](https://github.com/vesteraas/node-pitft/tree/master/examples) directory, and they cover all the functionality of the module.

### Screenshots
#### [berries.js](/examples/berries.js)
![berries.js example](/examples/screenshots/berries.png)

#### [circles.js](/examples/circles.js)
![circles.js example](/examples/screenshots/circles.png)

#### [clock.js](/examples/clock.js)
![clock.js example](/examples/screenshots/clock.png)

#### [lines.js](/examples/lines.js)
![lines.js example](/examples/screenshots/lines.png)

#### [rectangles.js](/examples/rectangles.js)
![rectangles.js example](/examples/screenshots/rectangles.png)

#### [text.js](/examples/text.js)
![text.js example](/examples/screenshots/text.png)
