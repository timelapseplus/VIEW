This fork aims to enhance the stability and predictability of the VIEW intervalometer, refine its ramping algorithms, and eliminate bugs. I can only provide support for Sony cameras as I have tested it solely on the Sony A6300 and A6600.

Currently, I have a general understanding of how VIEW operates, the algorithms involved, and why it may sometimes produce extreme light or dark exposures. At present, it appears that the estimated ramping needs adjustment, and issues with the histogram and luminance calculations are causing inaccuracies. Highlight protection calculations may result in underexposure, so it's advisable to disable this feature. Further investigation is necessary.

Please note that the releases are provided 'AS IS.' During development, I inadvertently caused a soft brick on my VIEW and spent several anxious nights trying to recover it. The provided releases have been tested on my own device. 
## Installation
Simply download the latest zip archive from the [releases page](https://github.com/naixx/VIEW/releases/latest) onto your SD card and install the update via the 'Firmware Update' menu. In case of any issues, consult the troubleshooting section in the official documentation to revert to previous versions. Feel free to reach out to discuss ideas, VIEW development, and future enhancements.
## Changes 
### 1.8.52
* Implemented a new method for calculating the histogram. Past experiences highlighted many overexposed timelapses due to incorrect histogram calculations, leading to failures in actual highlights protection algorithms. Day and night luminance calculations are now more precise, based on the YUV colorspace formula. Adjust your luminance references accordingly for `day` and `night`.
* Revised the `sunrise ramping algorithm`. Previously, the algorithm sometimes hesitated to adjust to the increasing light levels in the mornings. It has been modified to ramp faster towards brighter conditions.
* Enhanced camera exposure values in balance mode (`S=A=I`). If previous change in one direction was of the same parameter, then the opposite direction change will be of the same parameter. Except iso in up direction, we want it to ramp as quickly as possible.
For instance, transitioning to darkness with the previous algorithm: `6s 5.6f`, `8s 5.6f`(s), `8s 4f`(a), `10s 4f`(s) -> transitioning light -> `10s 5.6f`(a) -> transitioning dark -> `12s 5.6f`(s). Notice that the shutter and aperture change sequentially, which can lead to a peculiar situation where you may end up with a longer shutter speed instead of a wider aperture at night.
 The new algorithm will maintain the adjusted parameter sequence: `6s 5.6f`, `8s 5.6f`(s), `8s 4f`(a), `10s 4f`(s) -> transitioning light -> `8s 4f`(s) -> transitioning dark -> `10s 4f`(s). Notice that the `aperture remains unchanged` as the EV decreases and increases.
* In balance mode (`S=A=I`), ISO will consistently be the last parameter to change when transitioning to darker settings and the first parameter to adjust when transitioning to brighter settings. 


## TODO:
* video advance in clips via knob
* histogram and luminance in capture and exposure screen
* new mobile app
* new cameras?
* make aperture changes not so quick as it is now, but scaled to the number of shutter changes

------------------------------------------
<img alt="Timelapse+ VIEW Intervalometer" src="https://static1.squarespace.com/static/5318bacfe4b03ba2018b9945/5318bdcce4b04f773bfbb207/585c56295016e19f2cbefd4a/1482446382681/284A7536.jpg?format=475w" width="475">

### Timelapse+ VIEW Intervalometer

📷 Innovative solutions for time-lapse.

### Docs

**[Official VIEW documentation](http://docs.view.tl/)**

**[Documentación oficial de VIEW](http://es.view.tl/)**

[Developer documentation for the VIEW](DEVELOPER.md)
