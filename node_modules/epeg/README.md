# epeg
Forked from github.com/phorque/node-epeg (with github.com/L8D node v6 support)

# My fixes:
 - Issue with random memory for the "cropped" and "scaled" flags (code otherwise randomly fails)
 - Improved error messages and documentation.  
I highly recommend using my fork (this repository) over phorque's and L8D's versions.

# Description
 - Crop or scale down images with the insanely fast (and commonly used) C library libjpeg
 - While libjpeg isn't as fast as libjpeg-turbo, it's waaaay faster than anything written in JavaScript

# Dependencies
 - NodeJS
 - libjpeg

To install libjpeg:
- Mac  
```bash brew install libjpeg ```

- Ubuntu  
```bash sudo apt-get -y install libjpeg ```

- Windows  
``` I have absolutely no idea ```

# Install epeg (once libjpeg installed)
Run this command in your project directory. The --save will add this repository to your package.json
```bash
npm install git://github.com/falconscript/node-epeg --save
```


# Usage

# Load image binary
```javascript
// Load from path - image on disk
var image = new epeg.Image({path: "./test.jpg"}));
```
OR
```javascript
// Load from binary data - after something like fs.readFile
var image = new epeg.Image({data: imgBinaryBuffer}));
```

# Crop:

```javascript
var epeg = require("epeg");

var pixelsFromLeftToCrop = 100;
var pixelsFromTopToCrop = 50;
var newWidth = 200;
var newHeight = 300;

image = new epeg.Image({path: "./test.jpg"}));
image.crop(pixelsFromLeftToCrop, pixelsFromTopToCrop, newWidth, newHeight).saveTo("./output.jpg");
```

# Downsize:
Scale an image down

```javascript
var epeg = require("epeg");

var newWidthInPixels = 150;
var newHeightInPixels = 50;
var saveQualityPercent = 90;

image = new epeg.Image({path: "./test.jpg"}));
image.downsize(newWidthInPixels, newHeightInPixels, saveQualityPercent).saveTo("./ugly.jpg");
```

# Quality parameter
Note that crop and downsize can take an optional extra 'quality' parameter between 1 and 100 (default is 85)


# To get raw image buffer
Instead of saving with .saveTo(filename), you can call .process() after downsize/crop

```javascript
var fs = require("fs");
var epeg = require("epeg");

fs.readFile("./test.jpg", function(err, data) {
  // load the image with the binary buffer
  var image = new epeg.Image({data: data});
  var rawImageBuffer = image.downsize(100, 100).process();
  
  // do whatever with the rawImageBuffer, maybe do a phash or something for image similarity?
  
  // write changed image to disk
  fs.writeFileSync("./output.jpg", buffer);
});
```

# Credits
github.com/phorque - Original repository  
github.com/L8D - added crucial node v6 support  
github.com/falconscript - fixed memory flag runtime error and added docs
