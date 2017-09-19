var gphoto2 = require('gphoto2');
var GPhoto = new gphoto2.GPhoto2();
var fs = require('fs');
var execFile = require('child_process').execFile;
var SonyCamera = require('sony-camera');

require('rootpath')();
var LISTS = require('camera/ptp/lists.js');
var image = require('camera/image/image.js');

var camera = null;
var port = null;
var jpeg = null;
var settings = {};

var previewCrop = null;
var centerFaces = false;
var thumbnailPath = false;

supports = {
    thumbnail: true
};

function sendEvent(name, value) {
    process.send({
        type: 'event',
        event: name,
        value: value
    });
}

function exit() {
    sendEvent('exiting');
    setTimeout(process.exit, 0);
}

function buildCB(id) {
    if (!id) return null;
    return function(err, data) {
        var ctx = {
            id: id,
            err: err,
            data: data
        }
        sendEvent('callback', ctx);
    }
}

process.on('message', function(msg) {
    if (msg.type == 'port') {
        port = msg.port;
        // List cameras / assign list item to variable to use below options
        if(port == "SonyWifi") {
            camera = new SonyCamera();
            camera.connect(function(err) {
                if (err) {
                    if(err.message) sendEvent('connectionError', err.message);
                    console.log("WORKER: No (wifi) cameras found, exiting worker");
                    exit();
                    return;
                }
                camera.on('disconnected', function() {
                    console.log('WORKER: Camera lost connection, exiting...');
                    exit();
                });
                camera.model = 'SonyWifi';
                camera.getConfig = function(callback) {
                    var res = {
                        main: {
                            children: camera.params
                        }
                    }
                    callback && callback(null, res);
                }
                camera.setConfigValue = function(item, value, callback) {
                    camera.set(item, value, callback);
                }
                camera.takePicture = function(options, callback) {
                    if(options.preview) {
                        if(!camera.lvMode) {
                            camera.startViewfinder();
                            camera.lvMode = true;
                        }
                        camera.once('liveviewJpeg', function(img) {
                            callback && callback(null, img, 'preview');
                        })
                    } else {
                        camera.capture(function(err, name, image) {
                            callback && callback(err, image, name);
                        });
                    }
                }
                console.log('WORKER: Found', camera.model);

                camera._processEvents(false, function(){
                    getConfig(false, false, function() {
                        sendEvent('connected', camera.model);
                    });
                });
            });
        } else {
            console.log("WORKER: Searching for camera at port " + port + "...");
            GPhoto.list(function(list) {
                for (var i = 0; i < list.length; i++) {
                    if (list[i].model != 'Mass Storage Camera' && list[i].port == port) {
                        camera = list[i];
                        console.log("WORKER: camera:", camera);
                        break;
                    }
                }
                if (!camera) {
                    console.log("WORKER: No cameras found, exiting worker");
                    exit();
                    return;
                }
                //waitEvent();

                console.log('WORKER: Found', camera.model);

                getConfig(false, false, function() {
                    sendEvent('connected', camera.model);
                    setTimeout(getConfig, 3000);
                });

            });
        }
    }
    if (msg.type == 'command') {
        if (msg.do == 'exit') {
            console.log("WORKER: Received message, exiting worker");
            exit();
        }
    }
    if (msg.type == 'camera' && camera) {
        if (msg.do && msg.do != 'preview') console.log("WORKER: ", msg.do, msg.options);
        if (msg.do == 'capture') capture(msg.options, buildCB(msg.id));
        if (msg.do == 'captureTethered') captureTethered(false, buildCB(msg.id));
        if (msg.do == 'preview') preview(buildCB(msg.id));
        if (msg.do == 'lvTimerReset') liveViewOffTimerReset();
        if (msg.do == 'lvOff') liveViewOff(buildCB(msg.id));
        if (msg.do == 'zoom') {
            if (msg.reset) {
                previewCrop = null;
            } else {
                previewCrop = msg.data;
                console.log("WORKER: setting crop:", previewCrop);
            }
        }
        if(msg.do == 'waitComplete') waitComplete(buildCB(msg.id));
        if (msg.set) set(msg.set, msg.value, buildCB(msg.id));
        if (msg.setDirect) setDirect(msg.setDirect, msg.value, buildCB(msg.id));
        if (msg.get == 'settings') {
            console.log("WORKER: called getConfig in", new Date() / 1000 - msg.time, "seconds");
            getConfig(false, msg.useCache ? true : false, buildCB(msg.id));
        }
    }
    if (msg.type == 'setup') {
        if (msg.set == "thumbnailPath") thumbnailPath = msg.value;
    }
});

sendEvent('online');

// runs callback when all active writes to the SD card are complete
var sdWriting = false;
function waitComplete(callback) {
    var checkComplete = function() {
        if(sdWriting) {
            setTimeout(checkComplete, 500);
        } else {
            callback && callback();
        }
    }
    checkComplete();
}

function thumbnailFileFromIndex(index, cameraIndex, hqVersion) {
    if(!thumbnailPath) return "";
    var indexStr = (index + 1).toString();
    while (indexStr.length < 5) {
        indexStr = '0' + indexStr;
    }
    if(!cameraIndex) cameraIndex = 1;
    return thumbnailPath + "/cam-" + cameraIndex + "-" + indexStr + (hqVersion ? "q" : "") + ".jpg"
}

function saveThumbnail(jpgBuffer, index, cameraIndex, exposureCompensation) {
    if (thumbnailPath && index != null) {
        var thumbnailStartTime = new Date() / 1000;
        var indexStr = (index + 1).toString();
        fs.writeFile(thumbnailPath + "/count.txt", indexStr, function() {

            image.downsizeJpegSharp(new Buffer(jpgBuffer), {x: 160, q: 80}, null, exposureCompensation, function(err, jpgBuf) {
                if (!err && jpgBuf) {
                    fs.writeFile(thumbnailFileFromIndex(index, cameraIndex, false), jpgBuf, function() {
                        console.log("WORKER: completed saveThumbnail", index, "in", (new Date() / 1000) - thumbnailStartTime, "seconds");
                    });
                }
            });

            image.downsizeJpegSharp(new Buffer(jpgBuffer), {x: 320, q: 80}, null, exposureCompensation, function(err, jpgBuf) {
                if (!err && jpgBuf) {
                    fs.writeFile(thumbnailFileFromIndex(index, cameraIndex, true), jpgBuf, function() {
                        console.log("WORKER: completed saveThumbnail", index, "in", (new Date() / 1000) - thumbnailStartTime, "seconds");
                    });
                }
            });
        });
    }
}


function processRawPath(path, options, info, callback) {
    image.getJpegFromRawFile(path, null, function(err, jpg) {
        //if (!options.index) options.index = 0;
        if(options.index || options.index===0) {
            saveThumbnail(jpg, options.index, options.cameraIndex, options.exposureCompensation);
        }
        var dest;
        if (options.saveRaw) {
            dest = options.saveRaw + info.substr(-4); // get extension
            console.log("WORKER: Saving RAW image " + path + " to " + dest);
            execFile('/bin/cp', ['--no-target-directory', path, dest], {}, function(err, stdout, stderr) {
                if(err || stderr) {
                    console.log("WORKER: #################### ERROR SAVING RAW IMAGE:", err, stderr);
                    if(stderr.indexOf("No space left on device") !== -1) {
                        sendEvent('saveErrorCardFull', "Error saving RAW file " + dest + "\nNo space left on SD card.");
                    } else {
                        sendEvent('saveError', "Error saving RAW file " + dest + "\nError code: " + err + ", message: " + stderr);
                    }
                }
                sdWriting = false;
                fs.unlink(path);
            });
            if(options.index || options.index===0) {
                var s = options.saveRaw.match(/(tl-[0-9]+)/i);
                var name = "Timelapse";
                if(s && s.length > 1) name = s[1];
                var desc = name + " created with the Timelapse+ VIEW\nImage #" + options.index + "\nBase Exposure: " + options.exposureCompensation;
                if (options.exposureCompensation != null) image.writeXMP(dest, options.exposureCompensation, desc, name);
            }
        } else {
            sdWriting = false;
            fs.unlink(path);
        }

        if(options.index || options.index===0) {
            sendEvent('status', "analyzing photo");
            var size = {
                x: 160,
                q: 80
            }
            image.downsizeJpeg(jpg, size, null, function(err, lowResJpg) {
                var img;
                if (!err && lowResJpg) {
                    img = lowResJpg;
                } else {
                    img = jpg;
                }
                image.exposureValue(img, function(err, ev, histogram) {
                    ev = ev + options.exposureCompensation;
                    console.log("WORKER: ev:", ev, " (compensation: " + options.exposureCompensation + ")");
                    sendEvent('status', "photo ev: " + (Math.round(ev * 100) / 100));
                    sendEvent('histogram', histogram);
                    sendEvent('ev', ev);
                    if (callback) {
                        callback(err, {
                            ev: ev,
                            histogram: histogram,
                            file: info,
                            thumbnailPath: thumbnailFileFromIndex(options.index)
                        });
                    }
                });
            });
        } else if(options.saveRaw) {
            sendEvent('status', "photo saved to " + dest.replace('/media', 'SD card: '));
            if (callback) {
                callback(err, {
                    file: dest
                });
            }
        }

        if(options.mode == 'test') {
            var size = {
                x: 160,
                q: 80
            }
            image.downsizeJpeg(jpg, size, null, function(err, lowResJpg) {
                var img;
                if (!err && lowResJpg) {
                    img = lowResJpg;
                } else {
                    img = jpg;
                }
                image.exposureValue(img, function(err, ev, histogram) {
                    sendEvent('photo', {
                        jpeg: jpg,
                        ev: ev,
                        histogram: histogram,
                        zoomed: false,
                        type: 'test'
                    });
                });
            });
        } else {
            sendEvent('photo', {
                jpeg: jpg,
                zoomed: false,
                type: 'image'
            });
        }
    });
}

var errCount = 0;
var captureTimeoutHandle = null;

function capture(options, callback) {
    if (cameraBusy && !options.ignoreBusy) {
        clearTimeout(captureTimeoutHandle);
        captureTimeoutHandle = setTimeout(function() {
            capture(options, callback);
        }, 500);
        return;
    }
    sdWriting = true;
    cameraBusy = true;
    sendEvent('status', "waiting on camera");
    if (!options) {
        options = {
            thumbnail: true
        };
    }
    if (!options.exposureCompensation) options.exposureCompensation = 0;
    var captureOptions = {};
    if(options.mode == 'test') {
        console.log("WORKER: running test photo");
        captureOptions = {
            targetPath: '/tmp/tmpXXXXXX',
            keepOnCamera: false,
            thumbnail: false
        }
    } else if (options.saveRaw) {
        captureOptions = {
            targetPath: '/tmp/tmpXXXXXX',
            keepOnCamera: false,
            thumbnail: false
        }
    } else if (options.noDownload) {
        captureOptions = {
            download: false,
            thumbnail: false,
            keepOnCamera: true
        }
    } else {
        captureOptions = {
            download: true,
            thumbnail: (options.thumbnail && supports.thumbnail) ? true : false,
            keepOnCamera: (options.removeFromCamera) ? false : true
        }
    }
    //console.log("cameraOptions:", captureOptions);
    //console.log("options:", options);
    console.log("WORKER: running camera.takePicture()");
    camera.takePicture(captureOptions, function(err, photo, info) {
        console.log("WORKER: running camera.takePicture() -> callback(). File:", info);
        cameraBusy = false;
        if (!err && photo) {
            errCount = 0;
            if (options.thumbnail && supports.thumbnail) {
                sdWriting = false;
                //if (!options.index) options.index = 0;
                if(options.calculateEv) {
                    sendEvent('status', "analyzing photo");
                    var size = {
                        x: 120,
                        q: 80
                    }
                    //console.log("WORKER: downsizing preview for luminance calc...");
                    image.downsizeJpeg(photo, size, null, function(err, lowResJpg) {
                        var img;
                        if (!err && lowResJpg) {
                            console.log("WORKER: running luminance calc on low-res preview...", lowResJpg.length, "bytes");
                            img = lowResJpg;
                        } else {
                            console.log("WORKER: running luminance calc on full-res preview...");
                            img = photo;
                        }
                        var startTime = new Date() / 1000;
                        image.exposureValue(img, function(err, ev, histogram) {
                            console.log("WORKER: adjusting ev by ", options.exposureCompensation);
                            ev = ev + options.exposureCompensation;
                            var processingTime = (new Date() / 1000) - startTime;
                            console.log("WORKER: luminance calc complete. ev:", ev, "Processed in ", processingTime, "seconds");
                            sendEvent('status', "photo ev: " + (Math.round(ev * 100) / 100));
                            sendEvent('histogram', histogram);
                            //sendEvent('ev', ev);
                            if (callback) callback(err, {
                                ev: ev,
                                histogram: histogram,
                                file: info,
                                thumbnailPath: thumbnailFileFromIndex(options.index, options.cameraIndex)
                            });
                        });
                    });
                } else {
                    sendEvent('status', "photo saved to camera");
                    if (callback) callback(err, {
                        ev: null,
                        file: info,
                        thumbnailPath: options.index != null ? thumbnailFileFromIndex(options.index, options.cameraIndex) : null
                    });
                }
                var size = {
                    x: 320,
                    q: 80
                }
                image.downsizeJpeg(photo, size, null, function(err, mediumJpeg) {
                    saveThumbnail(mediumJpeg || photo, options.index, options.cameraIndex, options.exposureCompensation);
                    sendEvent('photo', {
                        jpeg: mediumJpeg || photo,
                        zoomed: false,
                        type: 'thumbnail'
                    });
                });
            } else {
                sendEvent('status', "converting photo");
                console.log("WORKER: Received photo", photo);
                processRawPath(photo, options, info, callback);
            }
        } else {
            errCount++;
            if (errCount > 5) {
                console.log("err", err);
                sdWriting = false;
                sendEvent('captureFailed', err);
                if (callback) callback(err, null);
            } else {
                console.log("WORKER: Error during capture:", err, "(retrying " + errCount + " of 5)");
                setTimeout(function() {
                    capture(options, callback);
                });
            }
        }
    });
}

/*function captureTethered(timeoutSeconds, callback) {
    var thumbnail = true;
    if (!timeoutSeconds) timeoutSeconds = 5;
    timeoutSeconds = Math.ceil(timeoutSeconds);
    if (timeoutSeconds < 0) timeoutSeconds = 1;
    console.log("WORKER: tethered capture timeout: ", timeoutSeconds);

    var startSeconds = new Date() / 1000;

    function waitEvent() {
        camera.waitEvent({
            timeoutMs: 1000
        }, function(err1, event, path) {
            if (!err1 && event == "file_added" && path) {
                console.log("WORKER: New Photo: ", path);
                camera.downloadPicture({
                    keepOnCamera: true,
                    thumbnail: thumbnail,
                    cameraPath: path,
                    targetPath: '/tmp/tmpXXXXXX'
                }, function(err2, tmp) {
                    if (!err2 && tmp) {
                        console.log("WORKER: Received image: ", err2, tmp);
                        if (thumbnail) {
                            image.getJpegBuffer(tmp, function(err3, jpg) {
                                if (!err3 && jpg) {
                                    console.log("WORKER: read to buffer");
                                    if (thumbnailPath) {
                                        fs.readFile(thumbnailPath + "/count.txt", function(err, data) {
                                            var count = 0;
                                            if (!err && data) {
                                                count = parseInt(data);
                                            }
                                            count += 1;
                                            fs.writeFile(thumbnailPath + "/count.txt", count.toString(), function() {
                                                var index = count.toString();
                                                while (index.length < 5) {
                                                    index = '0' + index;
                                                }
                                                fs.writeFile(thumbnailPath + "/img" + index + ".jpg", jpg);
                                            });
                                        });
                                    }
                                    sendEvent('status', "analyzing photo");
                                    console.log("WORKER: analyzing photo");
                                    image.exposureValue(jpg, function(err, ev, histogram) {
                                        ev = ev + options.exposureCompensation;
                                        //console.log("ev:", ev);
                                        sendEvent('status', "photo ev: " + (Math.round(ev * 100) / 100));
                                        sendEvent('ev', ev);
                                        sendEvent('histogram', histogram);
                                        if (callback) callback(null, ev);
                                    });
                                    sendEvent('photo', {
                                        jpeg: jpg,
                                        zoomed: false,
                                        type: 'thumbnail'
                                    });
                                } else {
                                    console.log("WORKER: error reading jpeg to buffer", err3);
                                    if (callback) callback(err3, null);
                                }
                                fs.unlink(tmp);
                            });
                        } else {
                            image.getJpegBuffer(tmp, function(err3, jpg) {
                                if (!err3 && jpg) {
                                    sendEvent('status', "analyzing photo");
                                    image.exposureValue(jpg, function(err4, ev, histogram) {
                                        ev = ev + options.exposureCompensation;
                                        //console.log("ev:", ev);
                                        sendEvent('status', "photo ev: " + (Math.round(ev * 100) / 100));
                                        sendEvent('histogram', histogram);
                                        if (callback) callback(null, ev);
                                    });
                                    sendEvent('photo', {
                                        jpeg: jpg,
                                        zoomed: false,
                                        type: 'thumbnail'
                                    });
                                } else {
                                    if (callback) callback(err3, null);
                                }
                                fs.unlink(tmp);
                            });
                        }
                    } else {
                        if (callback) callback(err, null);
                        console.log("WORKER: downloadFailed:", err);
                        sendEvent('downloadFailed', err);
                    }
                });
            } else {
                var seconds = new Date() / 1000;
                if (seconds - startSeconds < timeoutSeconds) {
                    setTimeout(waitEvent);
                } else {
                    console.log("WORKER: tethered capture timed out at ", seconds - startSeconds);
                    if (callback) callback("timed out", null);
                }
            }
        });
    }
    waitEvent();
}*/

liveViewTimerHandle = null;

function liveViewOff(callback) {
    console.log("WORKER: setting liveview off");
    previewCrop = null;
    if (liveViewTimerHandle != null) clearTimeout(liveViewTimerHandle);
    liveViewTimerHandle = null;

    if(camera.model.match(/fuji/i)) {
        set('movie', 0, function() {
            getConfig();
            callback && callback();
        });
    } else {
        set('liveview', 0, function() {
            getConfig();
            callback && callback();
        });
    }
}

function liveViewOffTimerReset(ms) {
    if (!ms) ms = 5000;
    if (liveViewTimerHandle != null) clearTimeout(liveViewTimerHandle);
    liveViewTimerHandle = setTimeout(liveViewOff, ms);
}

var previewTimeoutHandle = null;

function preview(callback) {
    if (cameraBusy) {
        clearTimeout(previewTimeoutHandle);
        previewTimeoutHandle = setTimeout(function() {
            preview(callback);
        }, 1000);
        return;
    }
    cameraBusy = true;
    //console.log("WORKER: preview");

    liveViewOffTimerReset(6000);

    camera.takePicture({
        preview: true,
        //        targetPath: '/media/sd/tmpXXXXXX'
        targetPath: '/tmp/tmpXXXXXX'
    }, function(err, tmp) {
        cameraBusy = false;
        liveViewOffTimerReset();
        if (callback) callback();
        if (!err && tmp) {
            var size = {
                x: 600,
                y: 400,
                q: 70
            }
            if(settings && settings.lvexposure === 'off') {
                set('lvexposure', 'on');
            }
            image.downsizeJpeg(tmp, size, previewCrop, function(err, jpg) {
                if(typeof tmp == 'string') fs.unlink(tmp);
                if (centerFaces && !previewCrop) {
                    image.faceDetection(jpg, function(jpgface) {
                        console.log("WORKER: photo length: ", jpgface.length);
                        sendEvent('photo', {
                            jpeg: jpgface,
                            zoomed: false,
                            type: 'preview',
                            centerFaces: centerFaces
                        });
                    });
                } else {
                    sendEvent('photo', {
                        jpeg: jpg,
                        zoomed: !!previewCrop,
                        type: 'preview'
                    });
                }
            });
        } else {
            sendEvent('previewFailed', err);
        }
    });
}

function set(item, value, callback) { // item can be 'iso', 'aperture', 'shutter', etc
    console.log('WORKER: setting ' + item + ' to ' + value + " (" + (typeof value) + ")");
    if(port == "SonyWifi" && item == "liveview") {
        if(value) {            
            if(!camera.lvMode) camera.startViewfinder();
        } else {
            camera.stopViewfinder();
            camera.lvMode = false;
        }
        return callback && callback();
    }
    getConfig(true, true, function() {
        if (!settings) {
            console.log('WORKER: error', "unable to retrieve camera settings");
            sendEvent('error', "unable to retrieve camera settings");
            if (callback) callback("unable to retrieve camera settings");
            return;
        }

        var list = null;
        var toggle = false;

        //console.log("checking list... (" + item + ")");
        for (var i in LISTS.paramMap) {
            var handle = LISTS.paramMap[i].name;
            if (handle == item) {
                item = settings.names[handle];
                list = settings.lists[handle];
                if (LISTS.paramMap[i].type == "toggle") {
                    toggle = true;
                }
                break;
            }
        }
        if (list) {
            if (toggle) {
                console.log("WORKER:  (set " + item + " = " + value + ") (toggle)");
                camera.setConfigValue(item, value, function(err) {
                    if (err) sendEvent('error', err);
                    if (callback) callback(err);
                });
                return;
            }
            for (var i = 0; i < list.length; i++) {
                if (list[i].cameraName == value || list[i].name == value) {
                    console.log("WORKER:  (set " + item + " = " + value + ")");
                    camera.setConfigValue(item, list[i].cameraName || value, function(err) {
                        if (err) sendEvent('error', err);
                        if (callback) callback(err);
                    });
                    return;
                }
            }
            console.log('WORKER: error', "invalid value for " + item);
            sendEvent('error', "invalid value for " + item);
            if (callback) callback("invalid value for " + item);
            return;
        } else {
            console.log('WORKER: error', "item not found in list: " + item + " = [" + value + "] (trying anyway)");
            camera.setConfigValue(item, value, function(err) {
                if (err) sendEvent('error', err);
                if (callback) callback(err);
            });
        }
    });
}

function setDirect(item, value, callback) {
    if(port == "SonyWifi") return callback && callback("not supported");
    camera.setConfigValue(item, value, function(err) {
        if (callback) callback(err);
    });
}

function mapParam(type, value, halfs) {
    if(halfs) type += "Halfs";
    var list = LISTS[type];
    if (list && value != null) {
        value = value.toString().trim().toLowerCase();
        for (var i = 0; i < list.length; i++) {
            if (value === list[i].name) {
                return list[i];
            } else {
                for (var j = 0; j < list[i].values.length; j++) {
                    if (list[i].values[j].toLowerCase() == value) {
                        return list[i];
                    }
                }
            }
        }
    }
    //console.log("list item not found:", type, "[" + value + "]");
    return null;
}

function mapCameraList(type, cameraList) {
    if (!cameraList) {
        //console.log("no camera list provided:", type);
        return [];
    }
    if (LISTS[type]) {
        //console.log("checking list:", LISTS[type]);
        var list = [];
        for (var i = 0; i < cameraList.length; i++) {
            var item = mapParam(type, cameraList[i]);
            if (item != null) {
                if (list.filter(function(item) {
                        return item.cameraName == cameraList[i];
                    }).length == 0) {
                    list.push({
                        name: item.name,
                        ev: item.ev,
                        cameraName: cameraList[i]
                    });
                }
            }
        }
        return list;
    } else {
        //console.log("list not found:", type);
        return cameraList;
    }
}

var configCache = null;
var configTimeoutHandle = null;
var cameraBusy = false;
var firstSettings = true;

function getConfig(noEvent, cached, cb) {
    if (cached && configCache) {
        console.log("WORKER: using cache for camera config");
        if (cb) cb(null, configCache);
        return;
    } 
    if (cameraBusy) {
        clearTimeout(configTimeoutHandle);
        configTimeoutHandle = setTimeout(function() {
            getConfig(noEvent, cached, cb);
        }, 100);
        return;
    }
    cameraBusy = true;
    console.log("WORKER: Worker: retrieving settings...");
    camera.getConfig(function(er, data) {
        if(firstSettings) {
            console.log("WORKER: camera config:", JSON.stringify(data));
            firstSettings = false;
        }
        cameraBusy = false;

        var getConfigStartTime = new Date() / 1000;
        
        if (data && data.main && data.main.children) {
            data = data.main.children;

            //console.log(data.capturesettings.children);
            //console.log(data.status.children);

            var mapped = {
                lists: {},
                names: {},
                details: {}
            };
            var halfsUsed = false;
            for (var i in LISTS.paramMap) {
                var handle = LISTS.paramMap[i].name;
                var maps = LISTS.paramMap[i].maps;
                var list = [];
                var value = false;
                var name = '';
                var detail = null;
                for (m in maps) {
                    var section = maps[m].section;
                    var item = maps[m].item;
                    if(section == null && data[item] && data[item].available) {
                        list = mapCameraList(handle, data[item].available);
                        var halfs = false;
                        if(list && (handle == 'shutter' || handle == 'iso' || handle == 'aperture')) {
                            var listHalfs = mapCameraList(handle + 'Halfs', data[item].available);
                            if(listHalfs && (listHalfs.length > list.length)) {
                                console.log("WORKER: using half stops for", handle);
                                halfs = true;
                                halfsUsed = true;
                                list = listHalfs; // item seems to be in half stops
                            }
                        }
                        //console.log("list:", handle, list);
                        value = data[item].current;
                        detail = mapParam(handle, value, halfs);
                        name = item;
                        if(detail) console.log(name + " = " + value + " (" + detail.name + ")");
                        break;
                    } else {
                        try {
                            //console.log("processing item", item);
                            if (item == 'shutterspeed' && data.status && data.status.children.manufacturer.value == 'Sony Corporation') {
                                console.log("WORKER: manually adding shutter speed list (" + (halfsUsed ? 'halfs' : 'thirds') + ")", data[section].children[item].choices);
                                supports.thumbnail = false; // sony USB doesn't support thumbnail-only capture
                                var l = halfsUsed ? LISTS.shutterHalfs : LISTS.shutter;
                                for (var j = 0; j < l.length; j++) {
                                    data[section].children[item].choices.push(l[j].values[0]); // sony doesn't report available shutter speeds, so define them here
                                }
                            }
                        } catch (e) {
                            console.log("WORKER: error manually adding shutter speeds:", e);
                        }
                        if (data[section] && data[section].children && data[section].children[item]) {
                            list = mapCameraList(handle, data[section].children[item].choices);
                            var halfs = false;
                            if(list && (handle == 'shutter' || handle == 'iso' || handle == 'aperture')) {
                                var listHalfs = mapCameraList(handle + 'Halfs', data[section].children[item].choices);
                                if(listHalfs && (listHalfs.length > list.length)) {
                                    console.log("WORKER: using half stops for", handle);
                                    halfs = true;
                                    halfsUsed = true;
                                    list = listHalfs; // item seems to be in half stops
                                }
                            }
                            //console.log("list:", handle, list);
                            value = data[section].children[item].value;
                            detail = mapParam(handle, value, halfs);
                            name = item;
                            if(detail) console.log("WORKER: ", name + " = " + value + " (" + detail.name + ")");
                            break;
                        }
                    }
                }
                mapped[handle] = value;
                if (detail) {
                    mapped.details[handle] = detail;
                     mapped[handle] = detail.name;
                }
                mapped.lists[handle] = list;
                mapped.names[handle] = name;
            }

            settings = mapped;

            console.log("WORKER: Mapped settings in ", (new Date() / 1000) - getConfigStartTime, "seconds");

            //console.log("mapped settings:", mapped);
            configCache = mapped;
            //if (!noEvent) 
            sendEvent('settings', settings);
            if (cb) cb(null, settings);
        } else {
            settings = null;
            if (cb) cb(er, null);
        }
    });
}

