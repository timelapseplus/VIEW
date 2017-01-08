var gphoto2 = require('gphoto2');
var GPhoto = new gphoto2.GPhoto2();
var fs = require('fs');
var execFile = require('child_process').execFile;

require('rootpath')();
var LISTS = require('camera/ptp/lists.js');
var image = require('camera/image/image.js');

var camera = null;
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
    if (msg.type == 'command') {
        if (msg.do == 'exit') {
            console.log("Received message, exiting worker");
            exit();
        }
    }
    if (msg.type == 'camera' && camera) {
        if (msg.do) console.log("Worker: ", msg.do, msg.options);
        if (msg.do == 'capture') capture(msg.options, buildCB(msg.id));
        if (msg.do == 'captureTethered') captureTethered(false, buildCB(msg.id));
        if (msg.do == 'preview') preview(buildCB(msg.id));
        if (msg.do == 'lvTimerReset') liveViewOffTimerReset();
        if (msg.do == 'zoom') {
            if (msg.reset) {
                previewCrop = null;
            } else {
                previewCrop = msg.data;
                console.log("setting crop:", previewCrop);
            }
        }
        if (msg.set) set(msg.set, msg.value, buildCB(msg.id));
        if (msg.get == 'all') getConfig(false, false, buildCB(msg.id));
        if (msg.get == 'settings') getConfig(false, false, buildCB(msg.id));
    }
    if (msg.type == 'setup') {
        if (msg.set == "thumbnailPath") thumbnailPath = msg.value;
    }
});

// List cameras / assign list item to variable to use below options
console.log("Searching for cameras...");
GPhoto.list(function(list) {
    for (var i = 0; i < list.length; i++) {
        if (list[i].model != 'Mass Storage Camera') {
            camera = list[i];
            console.log("camera:", camera);
            break;
        }
    }
    if (!camera) {
        console.log("No cameras found, exiting worker");
        exit();
        return;
    }
    //waitEvent();

    console.log('Found', camera.model);

    getConfig(false, false, function() {
        sendEvent('connected', camera.model);
    });
    //setInterval(getConfig, 2000);

});

function thumbnailFileFromIndex(index) {
    if(!thumbnailPath) return "";
    var indexStr = (index + 1).toString();
    while (indexStr.length < 5) {
        indexStr = '0' + indexStr;
    }
    return thumbnailPath + "/img" + indexStr + ".jpg"
}

function saveThumbnail(jpgBuffer, index, exposureCompensation) {
    if (thumbnailPath) {
        var indexStr = (index + 1).toString();
        fs.writeFile(thumbnailPath + "/count.txt", indexStr, function() {
            var size = {
                x: 160,
                q: 80
            }
            image.downsizeJpegSharp(new Buffer(jpgBuffer), size, null, exposureCompensation, function(err, jpgBuf) {
                if (!err && jpgBuf) {
                    fs.writeFile(thumbnailFileFromIndex(index), jpgBuf);
                }
            });
        });
    }
}


function processRawPath(path, options, info, callback) {
    image.getJpegFromRawFile(path, null, function(err, jpg) {
        //if (!options.index) options.index = 0;
        if(options.index || options.index===0) {
            saveThumbnail(jpg, options.index, options.exposureCompensation);
        }
        var dest;
        if (options.saveRaw) {
            dest = options.saveRaw + info.substr(-4); // get extension
            console.log("Saving RAW image " + path + " to " + dest);
            execFile('/bin/cp', ['--no-target-directory', path, dest], {}, function(err, stdout, stderr) {
                if(err) {
                    sendEvent('saveError', "Error saving RAW file " + dest);
                }
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
                image.exposureValue(img, function(err, ev) {
                    ev = ev + options.exposureCompensation;
                    console.log("ev:", ev, " (compensation: " + options.exposureCompensation + ")");
                    sendEvent('status', "photo ev: " + ev);
                    sendEvent('ev', ev);
                    if (callback) {
                        callback(err, {
                            ev: ev,
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
        sendEvent('photo', {
            jpeg: jpg,
            zoomed: false,
            type: 'image'
        });
    });
}

var errCount = 0;
var captureTimeoutHandle = null;

function capture(options, callback) {
    if (cameraBusy) {
        clearTimeout(captureTimeoutHandle);
        captureTimeoutHandle = setTimeout(function() {
            capture(options, callback);
        }, 500);
        return;
    }
    cameraBusy = true;
    sendEvent('status', "waiting on camera");
    if (!options) {
        console.log("worker: capture: initializing options");
        options = {
            thumbnail: true
        };
    }
    if (!options.exposureCompensation) options.exposureCompensation = 0;
    console.log("running camera.takePicture()");
    var captureOptions = {};
    if (options.saveRaw) {
        captureOptions = {
            targetPath: '/tmp/tmpXXXXXX',
            keepOnCamera: false,
            thumbnail: false
        }
    } else {
        captureOptions = {
            download: true,
            thumbnail: (options.thumbnail && supports.thumbnail) ? true : false,
            keepOnCamera: true
        }
    }
    console.log("cameraOptions:", captureOptions);
    camera.takePicture(captureOptions, function(err, photo, info) {
        console.log("running camera.takePicture() -> callback()");
        cameraBusy = false;
        console.log("file info:", info);
        if (!err && photo) {
            errCount = 0;
            console.log("file info:", info);
            if (options.thumbnail && supports.thumbnail) {
                //if (!options.index) options.index = 0;
                if(options.index || options.index===0) {
                    saveThumbnail(photo, options.index, options.exposureCompensation);
                    sendEvent('status', "analyzing photo");
                    image.exposureValue(photo, function(err, ev) {
                        console.log("adjusting ev by ", options.exposureCompensation);
                        ev = ev + options.exposureCompensation;
                        console.log("ev:", ev);
                        sendEvent('status', "photo ev: " + ev);
                        sendEvent('ev', ev);
                        if (callback) callback(err, {
                            ev: ev,
                            file: info,
                            thumbnailPath: thumbnailFileFromIndex(options.index)
                        });
                    });
                }
                sendEvent('photo', {
                    jpeg: photo,
                    zoomed: false,
                    type: 'thumbnail'
                });
            } else {
                sendEvent('status', "converting photo");
                console.log("Received photo", photo);
                processRawPath(photo, options, info, callback);
            }
        } else {
            errCount++;
            if (errCount > 5) {
                console.log("err", err);
                sendEvent('captureFailed', err);
                if (callback) callback(err, null);
            } else {
                console.log("Error during capture:", err, "(retrying " + errCount + " of 5)");
                setTimeout(function() {
                    capture(options, callback);
                });
            }
        }
    });
}

function captureTethered(timeoutSeconds, callback) {
    var thumbnail = true;
    if (!timeoutSeconds) timeoutSeconds = 5;
    timeoutSeconds = Math.ceil(timeoutSeconds);
    if (timeoutSeconds < 0) timeoutSeconds = 1;
    console.log("tethered capture timeout: ", timeoutSeconds);

    var startSeconds = new Date() / 1000;

    function waitEvent() {
        camera.waitEvent({
            timeoutMs: 1000
        }, function(err1, event, path) {
            if (!err1 && event == "file_added" && path) {
                console.log("New Photo: ", path);
                camera.downloadPicture({
                    keepOnCamera: true,
                    thumbnail: thumbnail,
                    cameraPath: path,
                    targetPath: '/tmp/tmpXXXXXX'
                }, function(err2, tmp) {
                    if (!err2 && tmp) {
                        console.log("Received image: ", err2, tmp);
                        if (thumbnail) {
                            image.getJpegBuffer(tmp, function(err3, jpg) {
                                if (!err3 && jpg) {
                                    console.log("read to buffer");
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
                                    console.log("analyzing photo");
                                    image.exposureValue(jpg, function(err, ev) {
                                        ev = ev + options.exposureCompensation;
                                        console.log("ev:", ev);
                                        sendEvent('status', "photo ev: " + ev);
                                        sendEvent('ev', ev);
                                        if (callback) callback(null, ev);
                                    });
                                    sendEvent('photo', {
                                        jpeg: jpg,
                                        zoomed: false,
                                        type: 'thumbnail'
                                    });
                                } else {
                                    console.log("error reading jpeg to buffer", err3);
                                    if (callback) callback(err3, null);
                                }
                                fs.unlink(tmp);
                            });
                        } else {
                            image.getJpegBuffer(tmp, function(err3, jpg) {
                                if (!err3 && jpg) {
                                    sendEvent('status', "analyzing photo");
                                    image.exposureValue(jpg, function(err4, ev) {
                                        ev = ev + options.exposureCompensation;
                                        console.log("ev:", ev);
                                        sendEvent('status', "photo ev: " + ev);
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
                        console.log("downloadFailed:", err);
                        sendEvent('downloadFailed', err);
                    }
                });
            } else {
                var seconds = new Date() / 1000;
                if (seconds - startSeconds < timeoutSeconds) {
                    setTimeout(waitEvent);
                } else {
                    console.log("tethered capture timed out at ", seconds - startSeconds);
                    if (callback) callback("timed out", null);
                }
            }
        });
    }
    waitEvent();
}

liveViewTimerHandle = null;

function liveViewOff() {
    previewCrop = null;
    if (liveViewTimerHandle != null) clearTimeout(liveViewTimerHandle);
    liveViewTimerHandle = null;
    set('liveview', 0, function() {
        getConfig();
    });
}

function liveViewOffTimerReset(ms) {
    if (!ms) ms = 2000;
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
    console.log("preview");

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
                x: 300,
                y: 200,
                q: 70
            }
            image.downsizeJpeg(tmp, size, previewCrop, function(err, jpg) {
                fs.unlink(tmp);
                if (centerFaces && !previewCrop) {
                    image.faceDetection(jpg, function(jpgface) {
                        console.log("photo length: ", jpgface.length);
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
    console.log('setting ' + item + ' to ' + value);

    getConfig(true, true, function() {
        if (!settings.mapped) {
            console.log('error', "unable to retrieve camera settings");
            sendEvent('error', "unable to retrieve camera settings");
            if (callback) callback("unable to retrieve camera settings");
            return;
        }

        var list = null;
        var toggle = false;

        console.log("checking list... (" + item + ")");
        for (var i in LISTS.paramMap) {
            var handle = LISTS.paramMap[i].name;
            if (handle == item) {
                item = settings.mapped.names[handle];
                list = settings.mapped.lists[handle];
                if (LISTS.paramMap[i].type == "toggle") {
                    toggle = true;
                }
                break;
            }
        }
        if (list) {
            if (toggle) {
                console.log("   (set " + item + " = " + value + ") (toggle)");
                camera.setConfigValue(item, value, function(err) {
                    if (err) sendEvent('error', err);
                    if (callback) callback(err);
                });
                return;
            }
            for (var i = 0; i < list.length; i++) {
                if (list[i].cameraName == value || list[i].name == value) {
                    console.log("   (set " + item + " = " + value + ")");
                    camera.setConfigValue(item, list[i].cameraName || value, function(err) {
                        if (err) sendEvent('error', err);
                        if (callback) callback(err);
                    });
                    return;
                }
            }
            console.log('error', "invalid value for " + item);
            sendEvent('error', "invalid value for " + item);
            if (callback) callback("invalid value for " + item);
            return;
        } else {
            console.log('error', "item not found in list: " + item + " = [" + value + "] (trying anyway)");
            camera.setConfigValue(item, value, function(err) {
                if (err) sendEvent('error', err);
                if (callback) callback(err);
            });
        }
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
    console.log("list item not found:", type, "[" + value + "]");
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
        console.log("list not found:", type);
        return cameraList;
    }
}

var configCache = null;
var configTimeoutHandle = null;
var cameraBusy = false;
var firstSettings = true;

function getConfig(noEvent, cached, cb) {
    if (cached && configCache) {
        if (cb) cb(null, configCache);
    } 
    if (cameraBusy) {
        if (configCache) {
            if (cb) cb(null, configCache);
        } else {
            clearTimeout(configTimeoutHandle);
            configTimeoutHandle = setTimeout(function() {
                getConfig(noEvent, cached, cb);
            }, 1000);
        }
        return;
    }
    cameraBusy = true;
    console.log("Worker: retrieving settings...");
    camera.getConfig(function(er, data) {
        if(firstSettings) {
            console.log("camera config:", JSON.stringify(data));
            firstSettings = false;
        }
        cameraBusy = false;
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
                    try {
                        console.log("processing item", item);
                        if (item == 'shutterspeed' && data.status.children.manufacturer.value == 'Sony Corporation') {
                            console.log("manually adding shutter speed list (" + (halfsUsed ? 'halfs' : 'thirds') + ")", data[section].children[item].choices);
                            supports.thumbnail = false; // sony USB doesn't support thumbnail-only capture
                            var l = halfsUsed ? LISTS.shutterHalfs : LISTS.shutter;
                            for (var j = 0; j < l.length; j++) {
                                data[section].children[item].choices.push(l[j].values[0]); // sony doesn't report available shutter speeds, so define them here
                            }
                        }
                    } catch (e) {
                        console.log("error manually adding shutter speeds:", e);
                    }
                    if (data[section] && data[section].children && data[section].children[item]) {
                        list = mapCameraList(handle, data[section].children[item].choices);
                        var halfs = false;
                        if(list && (handle == 'shutter' || handle == 'iso' || handle == 'aperture')) {
                            var listHalfs = mapCameraList(handle + 'Halfs', data[section].children[item].choices);
                            if(listHalfs && (listHalfs.length > list.length)) {
                                console.log("using half stops for", handle);
                                halfs = true;
                                halfsUsed = true;
                                list = listHalfs; // item seems to be in half stops
                            }
                        }
                        //console.log("list:", handle, list);
                        value = data[section].children[item].value;
                        detail = mapParam(handle, value, halfs);
                        name = item;
                        if(detail) console.log(name + " = " + value + " (" + detail.name + ")");
                        break;
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

            settings.mapped = mapped;
            data.mapped = mapped;

            //console.log("mapped settings:", mapped);

            if (!noEvent) sendEvent('settings', data);
            if (cb) cb(null, data);
        } else {
            settings.mapped = null;
            if (cb) cb(er, null);
        }
    });
}

