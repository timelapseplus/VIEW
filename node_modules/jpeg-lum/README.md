About
========
Calculates the luminance value and histogram of JPEG images.  This is based on Bill Yeh's excellent node-pixelr (https://github.com/billyeh/node-pixelr), adapted for getting luminance and histogram data instead of raw pixels.

I was originally using node-pixelr and calculating luminance and histogram data in javascript, but I thought it would be faster to do it in C++ before sending it to js.  In the end, I can't say I notice much difference in speed, though I haven't done any benchmarking.

The method for luminance is something I came up with after some trial and error.  I don't know if it's correct or ideal, but it's working for my application (adjusting exposure based on the luminance).

0.2.1 Update: build error fix
0.2.0 Update: changed algorithm to be lookup table based instead of trying to calculate, removed histogram array for now
0.1.0 Update: added "clipped" property to results; percentage (0-1) of pixels at 255
0.0.4 Update: further refined luminance value to match camera exposure
0.0.3 Update: changed gamma correction to 1/2.2
0.0.2 Update: converted pixel value to linear (removed gamma correction) before calculating luminance

Example
==========
```
var luminance = require('jpeg-lum');

/** luminance.read(filename, callback)
 * Filename points to a JPEG image
 * The callback takes an object with properties 'histogram' (an array), 'luminance', 'clipped' (0-1, percentage of pixels at 255), width', and 'height'.
 */
luminance.read("image.jpeg", function(err, res) {
  console.log("Luminance:", res.luminance);
  console.log("Percentage clipped:", res.clipped);
  console.log("Histogram Array:", res.histogram);
});


```

Documentation
===============
JPEG parsing uses `libjpeg`


Installation
===============
```
$ npm install jpeg-lum
```

License
=========

(The MIT License)

Modifications for jpeg-lum Copyright (c) 2016 Elijah Parker

Pixelr codebase Copyright (c) 2013 Bill Yeh

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
