## gpio-button

A JavaScript package for interfacing with hardware momentary push-buttons
connected to GPIO pins on Linux systems. Many Linux systems like the Raspberry
Pi have a driver called gpio-keys which can be used to emit events when
momentary push-buttons are pressed and released. This package conforms to the
conventions of the gpio-keys driver and enables very efficient interfacing with
momentary push-buttons. The technique may appear a little complex at first, but
when used, it resuts in an efficient pure JavaScript solution for momentary
push-buttons.

## Installation

    $ npm install gpio-button

## Usage

Assume that there's a momentary push button connected to GPIO #4 on a
Raspberry Pi:

<img src="https://raw.githubusercontent.com/fivdi/gpio-button/master/example/button4.png">

Let's start with the complex bit, device tree overlays, after that
everything is easy. A device tree overlay can be used to tell the Linux kernel
about hardware that is connected to the system, in this case, a momentary
push-button. Once the Linux kernel knows about the device tree overlay, it
arranges everything so that the momentary push-button can be used with ease.

The device tree overlay for a hardware device is described in source code and
compiled into a binary format understood by the Linux kernel using the device
tree compiler.

The source code for the momentary push-button overlay connected to GPIO #4 in
the circuit diagram above is:

```
/dts-v1/;
/plugin/;

/ {
    compatible = "brcm,bcm2835", "brcm,bcm2708", "brcm,bcm2709";

    fragment@0 {
        target = <&gpio>;
        __overlay__ {
            button4_pin: button4_pin {
                brcm,pins = <4>;     /* gpio4 */
                brcm,function = <0>; /* input */
                brcm,pull = <1>;     /* pull-down */
            };
        };
    };

    fragment@1 {
    target-path = "/soc";
        __overlay__ {
            button4: button4 {
                compatible = "gpio-keys";
                #address-cells = <1>;
                #size-cells = <0>;
                pinctrl-names = "default";
                pinctrl-0 = <&button4_pin>;
                status = "okay";

                button@4 {
                    label = "button gpio4";
                    linux,code = <4>;
                    gpios = <&gpio 4 0>;
                };
            };
        };
    };
};
```

Beautiful, isn't it :). The source code can also be found in
`button4-overlay.dts` in the `example` directory.

On Raspbian, the device tree compiler is installed with the following command:

```
sudo apt-get install device-tree-compiler
```

And the overlay is compiled with the following command:

```
dtc -@ -I dts -O dtb -o button4-overlay.dtb button4-overlay.dts
```

The device tree blob `button4-overlay.dtb` produced by the compiler is the
binary format understood by the Linux kernel and should be copied to
directory `/boot/overlays`:

```
sudo cp button4-overlay.dtb /boot/overlays
```

The last piece of the puzzle is adding the following line at the end of
`/boot/config.txt` so that the overlay gets loaded at boot time:

```
device_tree_overlay=overlays/button4-overlay.dtb
```

After the Pi has been rebooted, the following JavaScript program can be used to
print information when the momentary push-button is pressed, held, or released:

```js
var Button = require('gpio-button'),
  button4 = new Button('button4');

button4.on('press', function () {
  console.log('press');
});

button4.on('hold', function () {
  console.log('hold');
});

button4.on('release', function () {
  console.log('release');
});
```

## API

**Button(name)**

Returns a new Button object which inherits from EventEmitter. A 'ready' event
will be emitted when the hardware button itself is ready for user interaction.
The specified name is a string and and corresponds to the name of the node for
the button in the device tree overlay.

**pressed()**

Returns true if the button is pressed, else false.

**held()**

Returns true if the button is held, else false.

**released()**

Returns true if the button is released, else false.

**Event: press**

Emitted when the button is pressed.

**Event: hold**

Emitted continuously when the button is held.

**Event: release**

Emitted when the button is released.

