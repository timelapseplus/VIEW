# Developer Documentation for Timelapse+ VIEW Intervalometer

The _Timelapse+ VIEW Intervalometer_ software is open source, allowing users to assist in the growth and development of the product.

## Development Environment

It is best to develop directly on the VIEW, editing files on your computer, then copy them to the VIEW and run it for debugging and testing.  It is hard to run the tech stack outside the VIEW, as there are many hardware and system dependencies. Much of the VIEW logic is JavaScript which does not require any compiling; however, the native code is easily compiled directly on the VIEW itself.  All the developer tools needed are included, making it simple to get started. 

## Enable _DEVELOPER MODE_. 

After powering on your VIEW navigate to ```Settings > Developer Mode```, then change the selection to ```enabled```.  Doing so will enable access to versions of the VIEW software still under development.

## Connecting to the VIEW

> Note: It is best to have the VIEW fully charged, as many computers will not be able to charge the VIEW which connected.

Use the Micro USB port on the VIEW to connect with your development computer.  Once plugged in, you should see an emulate a serial port which one can then connect to via a serial terminal using these settings.  The VIEW uses a _Prolific chipset_, which is very common; however, some operating systems might require installing drivers.

| Baud Rate | Data Bits | Parity | Stop Bits |
|-----------|-----------|--------|-----------|
| 115200    | 8         | N      | 1         |

> Some users have had a good experience using Decisive Tactics [Serial](https://www.decisivetactics.com/products/serial/) software package to connect with their VIEW.

## Credentials

Log into your VIEW using the following username and password.

| username | password |
|----------|----------|
| root     | tl+view  |

Alternately, if you connect via wifi, you can log in with the same credentials via _ssh_.

## Firmware

The current firmware is located in ```/home/view/current```.

Run ```/root/start.sh``` to start/restart the main application.

## PTP codes

PTP codes are mapped in both JS and in the native library, _libgphoto2_, which is a little confusing. _libgphoto2_ maps PTP codes; however, the mappings are inconsistent, so the VIEW software re-maps many values in the JS. JS mapping values can be found in, ```camera/ptp/lists.js``` and the actual work is done in ```camera/ptp/worker.js```.

## libgphoto2

Compiling custom builds of _libgphoto2_ are easy to compile directly on the VIEW.  Download the source code, compile and install the library normally. Installing _libgphoto2_ will update the library that gets dynamically loaded in _gphoto2_ as well as the Node.js wrapper.
