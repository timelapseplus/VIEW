var DCRAW = "/home/view/current/bin/dcraw";
var UFRAW = "/usr/bin/ufraw-batch";
var TMPFOLDER = "/tmp/tlp";
var execFile = require('child_process').execFile;
var epeg = require('epeg');
// sharp is only used past the early return in downsizeJpegSharp, and its JS half (bluebird, semver, color) costs
// ~1 s at start-up, so that half is loaded on first use. The native half stays loaded up front: it brings sharp's
// own pango/cairo/fontconfig, and the OLED (pitft, loaded after this in the UI) has always drawn with those.
require('sharp/build/Release/sharp.node');
var sharp = function(input, options) {
    sharp = require('sharp');
    return sharp(input, options);
};
var fs = require('fs');
//var pixelr = require('pixelr');
var luminance = require('jpeg-lum');
//var cv = require('opencv');
var jpegSize = require('jpeg-size');

var log2 = Math.log2 || function(x) {
    return Math.log(x) / Math.LN2;
};

if (!fs.existsSync(TMPFOLDER)) {
    fs.mkdirSync(TMPFOLDER);
}

var TMP_IMAGE_INPUT = TMPFOLDER + "/tmp_image_in";
var TMP_IMAGE_OUTPUT = TMPFOLDER + "/tmp_image_in.thumb.jpg";
var TMP_IMAGE_THUMB = TMPFOLDER + "/tmp_image_thm.jpg";

function getJpeg(path, crop, callback) {
    if(Buffer.isBuffer(path)) return exports.getJpegFromRawBuffer(path, crop, callback);
    console.log("IMAGE: Processing photo...");
    try {
        console.log("IMAGE: Fetching JPEG from RAW photo...", path);
        var dcraw = execFile(DCRAW, ['-e', path], function(err, stdout, stderr) {
            if (err) console.log("DCRAW Error:", err);
            if (stderr) console.log("StdErr:", stderr);
            var size = {
                x: 840,
                q: 75
            };
            console.log("IMAGE: Downsizing JPEG at ", path);
            if (path == TMP_IMAGE_INPUT || path.indexOf('.') === -1) path += ".X"; // this gets replaced
            var thmFile = path.replace(/\.([a-z0-9])+$/i, ".thumb.jpg");
            exports.downsizeJpeg(thmFile, size, crop, function(err2, thm) {
                fs.unlink(thmFile);
                if (!err && err2) err = err2;
                console.log("IMAGE: Done.");
                if (callback) callback(err, thm);
            });
        });
    } catch (e) {
        console.log("IMAGE: (getJpeg) ERROR: ", e);
        if (callback) callback(e);
    }
}

exports.writeXMP = function(fileName, exposureCompensation, description, name, lat, lon) {
    var template = '<x:xmpmeta xmlns:x="adobe:ns:meta/" x:xmptk="Adobe XMP Core 5.5-c002 1.148022, 2012/07/15-18:06:45        ">\n\
 <rdf:RDF xmlns:rdf = "http://www.w3.org/1999/02/22-rdf-syntax-ns#" >\n\
  <rdf:Description rdf:about=""\n\
    xmlns:xmp="http://ns.adobe.com/xap/1.0/"\n\
    xmlns:tiff="http://ns.adobe.com/tiff/1.0/"\n\
    xmlns:exif="http://ns.adobe.com/exif/1.0/"\n\
    xmlns:dc="http://purl.org/dc/elements/1.1/"\n\
    xmlns:aux="http://ns.adobe.com/exif/1.0/aux/"\n\
    xmlns:photoshop="http://ns.adobe.com/photoshop/1.0/"\n\
    xmlns:xmpMM="http://ns.adobe.com/xap/1.0/mm/"\n\
    xmlns:stEvt="http://ns.adobe.com/xap/1.0/sType/ResourceEvent#"\n\
    xmlns:crs="http://ns.adobe.com/camera-raw-settings/1.0/"\n\
    crs:Exposure2012="{{EXP}}">\n\
    <dc:subject>\n\
     <rdf:Bag>\n\
      <rdf:li>Timelapse+ VIEW</rdf:li>\n\
      <rdf:li>time-lapse</rdf:li>\n\
      <rdf:li>{{NAME}}</rdf:li>\n\
     </rdf:Bag>\n\
    </dc:subject>\n\
    <dc:description>\n\
     <rdf:Alt>\n\
      <rdf:li xml:lang="x-default">{{DESC}}</rdf:li>\n\
     </rdf:Alt>\n\
    </dc:description>\n\
  </rdf:Description>\n\
{{GPS}}  <rdf:Description rdf:about=""\n\
    xmlns:lrt="http://lrtimelapse.com/">\n\
    <lrt:ExternalExposureDefault>{{LRTEXP}}</lrt:ExternalExposureDefault>\n\
  </rdf:Description>\n\
  </rdf:RDF>\n\
</x:xmpmeta>';

    var gpsData = "";
    if(lat != null && lat != null) {
        if(lat < 0) {
            lat = 0 - lat;
            lat = "S" + lat.toString();
        } else {
            lat = "N" + lat.toString();
        }
        if(lon < 0) {
            lon = 0 - lon;
            lon = "W" + lon.toString();
        } else {
            lon = "E" + lon.toString();
        }
        var gpsData = '  <rdf:Description rdf:about="" xmlns:exif="http://ns.adobe.com/exif/1.0/">\n\
            <exif:GPSLatitude>{{LAT}}</exif:GPSLatitude>\n\
            <exif:GPSLongitude>{{LON}}</exif:GPSLongitude>\n\
          </rdf:Description>\n\
        ';
        gpsData = gpsData.replace("{{LAT}}", lat);
        gpsData = gpsData.replace("{{LON}}", lon);
    }

    var expString = (exposureCompensation >= 0 ? "+" : "") + exposureCompensation.toString();
    var xmpData = template.replace("{{EXP}}", expString);
    xmpData = xmpData.replace("{{LRTEXP}}", expString);
    xmpData = xmpData.replace("{{NAME}}", name);
    xmpData = xmpData.replace("{{DESC}}", description);
    xmpData = xmpData.replace("{{GPS}}", gpsData);

    console.log("IMAGE: writing XMP file");
    fs.writeFileSync(fileName.replace(/\.[0-9a-z]+$/i, '.xmp'), xmpData);
}


exports.convertRawToTiff = function(rawImagePath, tiffOutputPath, exposureCompensation, callback) {
    console.log("IMAGE: Processing RAW photo...");
    var ufraw = execFile(UFRAW, ['--out-depth=16', '--out-type=tiff', '--zip', '--exposure=' + exposureCompensation, '--output=' + tiffOutputPath, rawImagePath], function(err, stdout, stderr) {
        if (err) console.log("IMAGE: (ufraw) error:", err);
        if (stderr) console.log("IMAGE: (ufraw) stderr:", stderr);
        if (callback) callback();
    });
}

exports.getJpegFromRawBuffer = function(rawImageBuf, crop, callback) {
    fs.writeFile(TMP_IMAGE_INPUT, new Buffer(rawImageBuf), function() {
        getJpeg(TMP_IMAGE_INPUT, crop, callback);
    });
}

exports.saveTemp = function(name, buf, callback) {
    var file = name ? TMPFOLDER + "/" + name : TMP_IMAGE_INPUT;
    fs.writeFile(file, new Buffer(buf), function(err) {
        if (callback) callback(err, file);
    });
}

exports.getJpegFromRawFile = function(rawImagePath, crop, callback) {
    getJpeg(rawImagePath, crop, callback);
}

exports.downsizeJpeg = function(jpeg, size, crop, callback) {
    //console.log("Resizing photo...");
    if (!size) size = {};
    if (!size.x) x = (size.y > 0) ? size.y * 1.5 : 300;
    if (!size.y) size.y = size.x / 1.5;
    if (!size.q) size.q = 70;

    if (!jpeg) return callback && callback("invalid JPEG");

    //var jpegPath;
    var jpegBuf;

    var jpegConfig = {};
    if (typeof jpeg == "string") {
        //console.log("IMAGE: downsizeJpeg: reading image file", jpeg);
        jpegBuf = fs.readFileSync(jpeg);
        //jpegPath = jpeg;
    } else {
        //console.log("IMAGE: downsizeJpeg: assuming image buffer, size=", jpeg.length);
        //jpegPath = "/tmp/thumbnail.jpg";
        //fs.writeFileSync(jpegPath, jpeg);
        jpegBuf = jpeg;
    }

    var err = null;
    try {
        var imgSize = jpegSize(jpegBuf);
        if(!imgSize || imgSize.width > size.x) {
            //console.log("IMAGE: loading jpeg...");
            var img = new epeg.Image({
                //path: jpegPath
                data: jpegBuf
            });
            //console.log("IMAGE: loaded jpeg");

            var thm;
            if (crop && crop.xPercent && crop.yPercent) {
                if (imgSize) {
                    if (crop.xPercent > 1) crop.xPercent /= 100;
                    if (crop.yPercent > 1) crop.yPercent /= 100;
                    crop.x = imgSize.width * crop.xPercent - size.x / 2;
                    crop.y = imgSize.height * crop.yPercent - size.y / 2;
                    if (crop.x < 0) crop.x = 0;
                    if (crop.y < 0) crop.y = 0;
                    if (crop.x > imgSize.width - size.x) crop.x = imgSize.width - size.x;
                    if (crop.y > imgSize.height - size.y) crop.y = imgSize.height - size.y;
                    //console.log("cropping to ", crop);
                    thm = img.crop(crop.x, crop.y, size.x, size.y, size.q).process();
                } else {
                    console.log("IMAGE: failed to read image size; not cropping");
                    thm = img.downsize(size.x, size.y, size.q).process();
                }
            } else {
                //console.log("IMAGE: downsizeJpeg: ", size);
                thm = img.downsize(size.x, size.y, size.q).process();
            }
            delete img;
        } else {
            thm = jpegBuf;
        }
        //console.log("downsizeJpeg: Done.");
    } catch (e) {
        console.log("IMAGE: Error resizing photo", e);
        err = e;
    }
    if (callback) callback(err, thm);
}

// The EXIF thumbnail of a camera JPEG (IFD1 in APP1): {data, width, height} or null. The DCF standard has cameras
// write a 160x120 one; a 3:2 picture sits in it between black bars (7 rows top and bottom on the Sony A6600, where it
// starts ≈39 KB into the file — a probe of the first 32 KB misses it). Decoding it costs ≈6 ms on the VIEW against
// 150-430 ms for the 1/8-scale decode of the whole file (docs/2026-10-20-frame-time-cpu-research.md §7.1).
exports.exifThumbnail = function(d) {
    try {
        if (!d || d.length < 4 || d[0] != 0xFF || d[1] != 0xD8) return null;
        var i = 2;
        while (i < d.length - 4) {
            if (d[i] != 0xFF) return null;
            var m = d[i + 1];
            if (m == 0xD8 || m == 0x01 || (m >= 0xD0 && m <= 0xD7)) { i += 2; continue; }
            if (m == 0xDA) return null; // the scan: no APP1 before it
            var L = d.readUInt16BE(i + 2);
            if (m == 0xE1 && d.toString('binary', i + 4, i + 10) == 'Exif\0\0') {
                var t = i + 10, le = d[t] == 0x49;
                var u16 = function(o) { return le ? d.readUInt16LE(o) : d.readUInt16BE(o); };
                var u32 = function(o) { return le ? d.readUInt32LE(o) : d.readUInt32BE(o); };
                var ifd0 = t + u32(t + 4), n0 = u16(ifd0);
                var ifd1 = u32(ifd0 + 2 + 12 * n0);
                if (!ifd1) return null;
                ifd1 += t;
                var n1 = u16(ifd1), off = 0, len = 0;
                for (var k = 0; k < n1; k++) {
                    var e = ifd1 + 2 + 12 * k, tag = u16(e);
                    if (tag == 0x0201) off = u32(e + 8); // JPEGInterchangeFormat
                    if (tag == 0x0202) len = u32(e + 8); // JPEGInterchangeFormatLength
                }
                if (!off || !len || t + off + len > d.length) return null;
                var thumb = d.slice(t + off, t + off + len);
                var sz = jpegSize(thumb);
                if (!sz || !sz.width || !sz.height) return null;
                return { data: thumb, width: sz.width, height: sz.height };
            }
            i += 2 + L;
        }
    } catch (e) {}
    return null;
}

// The EXIF thumbnail cropped to the picture, as a JPEG of quality q: the bars follow from the main image's aspect
// ratio (a 3:2 picture in a 160x120 thumbnail is 160x106 from row 7; a 4:3 one fills it). callback(err, jpeg, info)
// with info = {width, height, bars (rows cut at the top and at the bottom), bytes (of the thumbnail in the file)}.
exports.thumbnailFromExif = function(jpegBuf, q, callback) {
    var th = exports.exifThumbnail(jpegBuf);
    if (!th) return callback && callback("no EXIF thumbnail");
    var info = { width: th.width, height: th.height, bars: 0, bytes: th.data.length };
    try {
        var full = jpegSize(jpegBuf);
        var h = th.height, y = 0;
        if (full && full.width && full.height) {
            h = Math.floor(th.width * full.height / full.width);
            if (h > th.height) h = th.height;
            y = Math.floor((th.height - h) / 2);
            info.bars = y;
        }
        var img = new epeg.Image({ data: th.data });
        var out = (y > 0) ? img.crop(0, y, th.width, h, q || 80).process() : img.downsize(th.width, th.height, q || 80).process();
        callback && callback(null, out, info);
    } catch (e) {
        callback && callback(e);
    }
}

exports.downsizeJpegSharp = function(jpeg, size, crop, exposureCompensation, callback) {
    return exports.downsizeJpeg(jpeg, size, crop, callback);



    console.log("IMAGE: (sharp) Resizing photo...");
    var startTime = new Date() / 1000;
    if (!size) size = {};
    if (!size.x) x = (size.y > 0) ? size.y * 1.5 : 300;
    if (!size.y) size.y = size.x / 1.5;
    if (!size.q) size.q = 70;
    if (!jpeg) return;

    var jpegConfig = {};
    if (typeof jpeg == "string") {
        jpegBuf = fs.readFileSync(jpeg);
    } else {
        jpegBuf = jpeg;
    }

    var err = null;
    try {
        var img = sharp(jpegBuf);
        //var img = new epeg.Image({
        //    data: jpegBuf
        //});
        var thm;
        var cb = function(err) {
            var processingTime = (new Date() / 1000) - startTime;
            console.log("IMAGE: (sharp) Done resizing photo in ", processingTime, "seconds");
            callback && callback(err);
        }
        if (crop && crop.xPercent && crop.yPercent) {
            img.metadata(function(err, metadata) {
                if (!err && metadata) {
                    if (crop.xPercent > 1) crop.xPercent /= 100;
                    if (crop.yPercent > 1) crop.yPercent /= 100;
                    crop.x = metadata.width * crop.xPercent - size.x / 2;
                    crop.y = metadata.height * crop.yPercent - size.y / 2;
                    if (crop.x < 0) crop.x = 0;
                    if (crop.y < 0) crop.y = 0;
                    if (crop.x > metadata.width - size.x) crop.x = metadata.width - size.x;
                    if (crop.y > metadata.height - size.y) crop.y = metadata.height - size.y;
                    console.log("IMAGE: cropping to ", crop);
                    img.extract({
                        left: Math.round(crop.x),
                        top: Math.round(crop.y),
                        width: Math.round(size.x),
                        height: Math.round(size.y)
                    }).sharpen().jpeg().quality(size.q).toBuffer(cb);
                } else {
                    console.log("IMAGE: failed to read image size; not cropping");
                    img.resize(Math.round(size.x), Math.round(size.y)).sharpen().jpeg().quality(size.q).toBuffer(cb);
                }
            });
        } else {
            if (exposureCompensation) {
                img.resize(Math.round(size.x), Math.round(size.y)).raw().toBuffer(function(err, buf, info) {
                    if (!err && buf) {
                        console.log("IMAGE: adding exposure compensation of " + exposureCompensation);
                        for (var i = 0; i < buf.length; i++) {
                            // read 8-bit pixel val from buf
                            var val = buf.readUInt8(i, true);
                            if (val < 255) {
                                // convert to linear
                                val = Math.pow(val / 255, 2.2) * 255;
                                // add exposure compensation
                                val *= Math.pow(2, exposureCompensation);
                                // reapply gamma
                                val = Math.pow(val / 255, 1 / 2.2) * 255;
                                // coerce to 8-bit range
                                val = Math.round(Math.min(Math.max(val, 0), 255));
                                // save to buf
                            }
                            buf.writeUInt8(val, i, true);
                        }
                        console.log("IMAGE: exposure compensation done");
                        var out = sharp(buf, {
                            raw: info
                        }).gamma(2.2).sharpen().jpeg().quality(size.q).toBuffer(cb);
                    } else {
                        console.log("IMAGE: Error creating buffer", err);
                        if (callback) callback(err, null);
                    }
                });
            } else {
                img.resize(Math.round(size.x), Math.round(size.y)).sharpen().jpeg().quality(size.q).toBuffer(cb);
            }
        }
        console.log("IMAGE: Done.");
    } catch (e) {
        console.log("IMAGE: Error resizing photo", e);
        err = e;
        if (callback) callback(err, null);
    }
}

exports.getJpegBuffer = function(jpegPath, callback) {
    //console.log("IMAGE: Loading JPEG as buffer...");
    var err = null;
    try {
        fs.readFile(jpegPath, function(err, jpg) {
            if (callback) callback(err, jpg);
        });
        //console.log("IMAGE: Done.");
    } catch (e) {
        console.log("IMAGE: Error loading photo (" + jpegPath + ")", e);
        err = e;
        if (callback) callback(err, null);
    }
}

exports.histogramArray = function(jpegBuffer, callback) {
    fs.writeFile(TMP_IMAGE_THUMB, new Buffer(jpegBuffer), function() {
        luminance.read(TMP_IMAGE_THUMB, function(err, res) {
            var histArray = null;
            if(!err && res && res.histogram) histArray = res.histogram;
            if (callback) callback(err, histArray);
        });
        /*pixelr.read(TMP_IMAGE_THUMB, "jpeg", function(err, data) {
            if (err) console.log("Error:", err);
            var result = new Array(256);
            if (!err) {
                for (var i = 0; i < data.pixels.length; i += 3) {
                    pixelIndex = i / 3;
                    var val = Math.ceil((data.pixels[i + 0] + data.pixels[i + 1] + data.pixels[i + 2]) / 3);
                    if (val >= 0 && val <= 255) {
                        if (!result[val]) result[val] = 1;
                        else result[val] ++;
                    }
                }
            }
            if (callback) callback(err, result);
        });*/
    });
}

exports.exposureValue = function(jpegBuffer, callback) {
    var highlightProtection = false;//20;

    fs.writeFile(TMP_IMAGE_THUMB, jpegBuffer, function() {
        luminance.read(TMP_IMAGE_THUMB, function(err, res) {
            var lum = 0;
            if(!err && res && res.luminance) {
                lum = res.luminance;
               /* if(res.clipped && highlightProtection) {
                    console.log("IMAGE: Compensating for clipped highlights: ", res.clipped * highlightProtection);
                    lum += res.clipped * highlightProtection;
                }*/
            }
            if (callback) callback(err, lum, res.histogram);
        });
    });
}

exports.faceDetection = function(jpegBuffer, callback) {
    cv.readImage(jpegBuffer, function(err, im) {
        im.detectObject(cv.FACE_CASCADE, {}, function(err, faces) {
            if (!err && faces && faces.length > 0) {
                console.log("IMAGE: detected " + faces.length + " faces");
                for (var i = 0; i < faces.length; i++) {
                    var f = faces[i]
                    im.ellipse(f.x + f.width / 2, f.y + f.height / 2, f.width / 2, f.height / 2);
                }
                jpg = im.toBuffer('jpg');
                if (callback) callback(jpg);
            } else {
                if (callback) callback(jpegBuffer);
            }
        });
    });
}
