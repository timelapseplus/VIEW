require('rootpath')();
var ptp = require('camera/ptp/ptp.js');
var lists = require('camera/ptp/lists.js');
var bulb = require('node-bulb');

var camera = {};

camera.bulb = bulb;
camera.ptp = ptp;
camera.connected = ptp.connected;
camera.lists = lists;

camera.settings = {
    brampGap: 5,
    bulbMinUs: null,
}

var cbStore = {};
var cbIndex = 0;

console.log(">>>>>>> Starting camera module >>>>>>>>");

function getCallbackId(cb) {
    if (!cb) return 0;
    cbIndex++;
    if (cbIndex > 1000) cbIndex = 1;
    cbStore[cbIndex.toString()] = cb;
    return cbIndex;
}

function runCallback(cbData) {
    if (cbData && cbData.id && cbStore[cbData.id.toString()]) {
        var cb = cbStore[cbData.id.toString()];
        cb(cbData.err, cbData.data);
        delete cbStore[cbData.id.toString()]
    }
}

function sum(arr) {
    var sum = 0;
    for (var i = 0; i < arr.length; i++) {
        sum += arr[i];
    }
    return sum;
}

function remap(method) { // remaps camera.ptp methods to use new driver if possible
    switch(method) {
        case 'camera.ptp.settings.format':
            if(camera.ptp.new.available) {
                return camera.ptp.new.cameras[0].camera.config.format;
            } else {
                return camera.ptp.settings.format;
            }
        case 'camera.ptp.model':
            if(camera.ptp.new.available) {
                return camera.ptp.new.model;
            } else {
                return camera.ptp.model;
            }
        case 'camera.ptp.supports.destination':
            if(camera.ptp.new.available) {
                return camera.ptp.new.supports.destination;
            } else {
                return camera.ptp.supports.destination;
            }
        case 'camera.ptp.connected':
            if(camera.ptp.new.available) {
                return camera.ptp.new.available;
            } else {
                return camera.ptp.connected;
            }
        case 'camera.ptp.getSettings':
            if(camera.ptp.new.available) {
                return function(callback) {callback && callback()};
            } else {
                return camera.ptp.getSettings;
            }
        case 'camera.ptp.set':
            if(camera.ptp.new.available) {
                return camera.ptp.new.set;
            } else {
                return camera.ptp.set;
            }
        case 'camera.ptp.capture':
            if(camera.ptp.new.available) {
                return function(captureOptions, callback) {
                    var options = {
                        destination: (intervalometer.currentProgram.destination == 'sd' && camera.ptp.sdPresent && camera.ptp.sdMounted) ? 'VIEW' : 'camera',
                    }
                    if(captureOptions && captureOptions.mode == 'test') {
                        options.destination = "VIEW";
                    }
                    return camera.ptp.new.capture(options, function(err, thumb, image, filename) {
                        if(captureOptions && captureOptions.mode == "test") {
                            image.exposureValue(thumb, function(err, ev, histogram) {
                                photoRes.ev = ev;
                                photoRes.histogram = histogram;
                                callback && callback(photoRes);
                            });
                        } else {
                            if(options.destination == 'sd' && captureOptions.saveRaw && image && filename) {
                                var file = captureOptions.saveRaw + filename.slice(-4);
                                var cameraIndex = 1;
                                fs.writeFile(file, image, function(err) {
                                    var photoRes = {
                                        file: filename,
                                        cameraCount: 1,
                                        cameraResults: [],
                                        thumbnailPath: thumbnailFileFromIndex(captureOptions.index),
                                        ev: null
                                    }
                                    if(captureOptions.calculateEv) {
                                        image.exposureValue(thumb, function(err, ev, histogram) {
                                            photoRes.ev = ev;
                                            photoRes.histogram = histogram;
                                            callback && callback(photoRes);
                                        });
                                    } else {
                                        callback && callback(photoRes);
                                    }

                                });
                                saveThumbnail(thumb, captureOptions.index, cameraIndex, 0);
                            }
                        }
                    });
                }
            } else {
                return camera.ptp.capture;
            }
        case 'camera.ptp.settings':
            if(camera.ptp.new.available) {
                var base = camera.ptp.new.cameras[0].camera.exposure;
                return {
                    shutter: base.shutter,
                    aperture: base.aperture,
                    iso: base.iso,
                    lists: {
                        shutter: base.shutter.list,
                        aperture: base.aperture.list,
                        iso: base.iso.list
                    }
                }
            } else {
                return camera.ptp.settings;
            }
        case 'camera.ptp.settings.details':
            if(camera.ptp.new.available) {
                var base = camera.ptp.new.cameras[0].camera.exposure;
                return {
                    shutter: base.shutter,
                    aperture: base.aperture,
                    iso: base.iso,
                    lists: {
                        shutter: base.shutter.list,
                        aperture: base.aperture.list,
                        iso: base.iso.list
                    }
                }
            } else {
                return camera.ptp.settings.details;
            }
        case 'camera.ptp.settings.focusPos':
            if(camera.ptp.new.available) {
                return camera.ptp.new.cameras[0].camera.status.focusPos || 0;
            } else {
                return camera.ptp.settings.focusPos;
            }
        case 'camera.ptp.focus':
            if(camera.ptp.new.available) {
                return function(dir, steps, callback) {
                    camera.ptp.new.moveFocus(dir * steps, 1, callback);
                }
            } else {
                return camera.ptp.focus;
            }
        case 'camera.ptp.lvOff':
            if(camera.ptp.new.available) {
                return function(callback) {
                    return camera.ptp.new.liveviewMode(false, callback);
                }
            } else {
                return camera.ptp.lvOff;
            }
        case 'camera.ptp.preview':
            if(camera.ptp.new.available) {
                return function(callback) {
                    return camera.ptp.new.liveviewMode(true, callback);
                }
            } else {
                return camera.ptp.preview;
            }
    }
}



camera.testBulb = function() {
    var options = {
        preFocusMs: 500,
        expectSync: true,
        runTest: false
    }

    var testCount = 5;

    var testStart = [];
    var testEnd = [];
    var testMin = [];
    var testGap = [];

    var testError = null;

    var testStartTime;

    console.log("running test...");

    function testDone() {
        camera.settings.bulbMinUs = Math.max.apply(Math, testMin);
        camera.settings.bulbStartUs = sum(testStart) / testStart.length;
        camera.settings.bulbEndUs = sum(testEnd) / testEnd.length;
        camera.settings.brampGap = sum(testGap) / testGap.length;

        console.log('bulbMinUs:', camera.settings.bulbMinUs);
        console.log('bulbStartUs:', camera.settings.bulbStartUs);
        console.log('bulbEndUs:', camera.settings.bulbEndUs);
        console.log('brampGap:', camera.settings.brampGap);

    }

    function doTest() {
        if (testCount > 0) {
            testStartTime = new Date();
            testCount--;
            camera.ptp.captureTethered(function(err, res) {
                if (!err && !testError) {
                    var testEndTime = new Date();
                    testGap.push((testEndTime - testStartTime) / 1000);
                    setTimeout(doTest);
                } else {
                    testError = err;
                    console.log("error occurred during capture: (" + (err || testError) + ")!");
                }
            });
            bulb(options, function(err, start_us, end_us, actual_us) {
                if (!err && !testError) {
                    testStart.push(start_us);
                    testEnd.push(end_us);
                    testMin.push(actual_us);
                } else {
                    testError = err;
                    console.log("error occurred during test: (" + (err || testError) + ")!");
                }
            });
        } else {
            testDone();
        }

    }

    doTest();
}

camera.getEv = function(callback) {
    remap('camera.ptp.getSettings')(function() {
        var settings = remap('camera.ptp.settings.details');
        var av = (settings && settings.aperture && settings.aperture.ev != null) ? settings.aperture.ev : lists.fixedApertureEv;

        if (callback) {
            if(settings && settings.shutter && settings.iso) {
                callback(null, lists.getEv(settings.shutter.ev, av, settings.iso.ev), {
                    shutter: settings.shutter,
                    aperture: settings.aperture,
                    iso: settings.iso
                });
            } else {
                callback("error retreiving camera settings");
            }
        }
    });
}

var lastParam = null;
camera.setEv = function(ev, options, cb) {
    if (!options) options = {};
    var doSet = function(settings) {
        var shutter = settings.details ? settings.details.shutter : settings.shutter;
        var aperture = settings.details ? settings.details.aperture : settings.aperture;
        var iso = settings.details ? settings.details.iso : settings.iso;

        var apertureEnabled = false;
        //var shutterEnabled = true; //to be added
        if(options && options.parameters && options.parameters.indexOf('A') !== -1) apertureEnabled = true
        // if(options.parameters && options.parameters.indexOf('I') === -1) shutterEnabled = false // defaults to enabled

        if (!aperture) {
            apertureEnabled = false;
            aperture = {
                ev: lists.fixedApertureEv
            };
        }

        console.log("current shutter", shutter);
        console.log("current aperture", aperture);
        console.log("current iso", iso);

        var shutterList = settings.lists ? settings.lists.shutter : settings.shutter.list;
        var apertureList = settings.lists ? settings.lists.aperture : settings.aperture.list;
        var isoList = settings.lists ? settings.lists.iso : settings.iso.list;

        //console.log("options: ", options);
        //console.log("isoList: ", isoList);

        if(shutterList) shutterList = lists.cleanEvCopy(shutterList);
        if(apertureList) apertureList = lists.cleanEvCopy(apertureList);
        if(isoList) isoList = lists.cleanEvCopy(isoList);

        //console.log("isoList2: ", isoList);

        if (shutterList && options && options.maxShutterLengthMs) {
            var maxSeconds = Math.floor(options.maxShutterLengthMs / 1000);
            if(maxSeconds < 1) maxSeconds = 1;
            //console.log("MAX seconds for shutter: ", maxSeconds);
            shutterList = shutterList.filter(function(item) {
                return lists.getSecondsFromEv(item.ev) <= maxSeconds;
            });
            //console.log("Filtered shutter list: ", shutterList);
        }
        if (shutterList && options && options.shutterMax != null) {
            shutterList = shutterList.filter(function(item) {
                return item.ev >= options.shutterMax;
            });
        }
        if (isoList && options && options.isoMax != null) {
            isoList = isoList.filter(function(item) {
                return item.ev >= options.isoMax;
            });
        }
        if (isoList && options && options.isoMin != null) {
            isoList = isoList.filter(function(item) {
                return item.ev <= options.isoMin;
            });
        }
        if (apertureList && options && options.apertureMax != null) {
            apertureList = apertureList.filter(function(item) {
                return item.ev <= options.apertureMax;
            });
        }
        if (apertureList && options && options.apertureMin != null) {
            apertureList = apertureList.filter(function(item) {
                return item.ev >= options.apertureMin;
            });
        }

        //console.log("apertureList: ", apertureList);

        var currentEv = null;
        if(shutter && aperture && iso && shutter.ev != null && aperture.ev != null && iso.ev != null) {
            currentEv = lists.getEv(shutter.ev, aperture.ev, iso.ev);
        }
        console.log("setEv: currentEv: ", currentEv, "targetEv:", ev);

        console.log("setEv: list lengths: s:", shutterList ? shutterList.length : -1, "i:", isoList ? isoList.length : -1, "a:", apertureList ? apertureList.length : -1);

        if (ev === null || currentEv === null) {
            console.log("setEv: unable to set ev, insufficient settings available");
            if (cb) cb("unable to set ev, insufficient settings available", {
                ev: currentEv,
                shutter: shutter,
                aperture: aperture,
                iso: iso
            });
            return;
        }

        if(!options.blendParams) lastParam = null;

        for (var trys = 0; trys < 3; trys++) {
            while (ev < currentEv - 1 / 4) {
                //console.log("ev < currentEv");
                var s = lists.decEv(shutter, shutterList);
                if (apertureEnabled) var a = lists.decEv(aperture, apertureList);
                var i = lists.decEv(iso, isoList);

                if (s && shutter.ev != s.ev && lastParam != 's') {
                    shutter = s;
                    if(options.blendParams) lastParam = 's';
                } else if (apertureEnabled && a && aperture.ev != a.ev && lastParam != 'a') {
                    aperture = a;
                    if(options.blendParams) lastParam = 'a';
                } else if (i && iso.ev != i.ev && lastParam != 'i') {
                    iso = i;
                    if(options.blendParams) lastParam = 'i';
                } else {
                    lastParam = null;
                    currentEv = lists.getEv(shutter.ev, aperture.ev, iso.ev);
                    break;
                }
                currentEv = lists.getEv(shutter.ev, aperture.ev, iso.ev);
                //console.log(" update: ", currentEv);
            }

            while (ev > currentEv + 1 / 4) {
                //console.log("ev > currentEv");
                var s = lists.incEv(shutter, shutterList);
                if (apertureEnabled) var a = lists.incEv(aperture, apertureList);
                var i = lists.incEv(iso, isoList);

                if (i && iso.ev != i.ev && lastParam != 'i') {
                    iso = i;
                    if(options.blendParams) lastParam = 'i';
                } else if (apertureEnabled && a && aperture.ev != a.ev && lastParam != 'a') {
                    aperture = a;
                    if(options.blendParams) lastParam = 'a';
                } else if (s && shutter.ev != s.ev && lastParam != 's') {
                    shutter = s;
                    if(options.blendParams) lastParam = 's';
                } else {
                    lastParam = null;
                    currentEv = lists.getEv(shutter.ev, aperture.ev, iso.ev);
                    break;
                }
                currentEv = lists.getEv(shutter.ev, aperture.ev, iso.ev);
                //console.log(" update: ", currentEv);
            }

            if (Math.abs(ev - currentEv) <= 1 / 4) break;

        }


        console.log("setEv: finalEv: ", currentEv);

        function runQueue(queue, callback) {
            set = queue.pop();
            if (set) {
                console.log("setEv: setting", set.name, "to", set.val);
                remap('camera.ptp.set')(set.name, set.val, function() {
                    setTimeout(function() {
                        runQueue(queue, callback)
                    });
                });
            } else {
                if (callback) callback();
                return;
            }
        }

        if(options.doNotSet) {
            console.log("setEv: done, not applying changes.");
            if (cb) return cb(null, {
                ev: currentEv,
                shutter: shutter,
                aperture: aperture,
                iso: iso
            }); else return;
        }

        var setQueue = [];

        if (shutter.ev != (settings.details ? settings.details.shutter.ev : settings.shutter.ev)) setQueue.push({
            name: 'shutter',
            val: shutter.cameraName || shutter.name
        });
        if (apertureEnabled && aperture.ev != (settings.details ? settings.details.aperture.ev : settings.aperture.ev)) setQueue.push({
            name: 'aperture',
            val: aperture.cameraName || aperture.name
        });
        if (iso.ev != (settings.details ? settings.details.iso.ev : settings.iso.ev)) setQueue.push({
            name: 'iso',
            val: iso.cameraName || iso.name
        });

        runQueue(setQueue, function() {
            console.log("setEv: done.");
            if (cb) cb(null, {
                ev: currentEv,
                shutter: shutter,
                aperture: aperture,
                iso: iso
            });

        });
    }

    if (options && options.cameraSettings) {
        console.log("setEv: using provided settings");
        doSet(options.cameraSettings);
    } else {
        remap('camera.ptp.getSettings')(function() {
            console.log("setEv: retreived settings from camera");
            var settings = remap('camera.ptp.settings');
            doSet(settings);
        });
    }

}

camera.setExposure = function(shutterEv, apertureEv, isoEv, cb) {
    function runQueue(queue, callback) {
        set = queue.pop();
        if (set) {
            console.log("setEv: setting ", set.name);
            camera.ptp.set(set.name, set.val, function() {
                setTimeout(function() {
                    runQueue(queue, callback)
                });
            });
        } else {
            if (callback) callback();
            return;
        }
    }
    function getItemFromEvList(list, ev) {
        if(!list) return null;
        list = lists.cleanEvCopy(list);
        var minDiff = Infinity;
        var correction = 0;
        var item = null;
        for(var i = 0; i < list.length; i++) {
            var diff = Math.abs(ev - list[i].ev);
            if(diff < minDiff) {
                correction = ev - list[i].ev;
                minDiff = diff;
                item = list[i];
            }
        }
        if(item) {
            return { item: item, correction: correction };
        } else {
            return null;
        }
    }

    var setQueue = [];

    var correction = 0;

    if (shutterEv != null && (!camera.ptp.settings.details || (camera.ptp.settings.details.shutter && shutterEv != camera.ptp.settings.details.shutter.ev))) {
        var res = getItemFromEvList(camera.ptp.settings.lists.shutter, shutterEv);
        if(res != null) {
            correction = res.correction;
            setQueue.push({
                name: 'shutter',
                val: res.item.cameraName || res.item.name
            });
        }
    }
    if (apertureEv != null && (!camera.ptp.settings.details || (camera.ptp.settings.details.aperture && apertureEv != camera.ptp.settings.details.aperture.ev))) {
        var res = getItemFromEvList(camera.ptp.settings.lists.aperture, apertureEv + correction);
        if(res != null) {
            correction = res.correction;
            setQueue.push({
                name: 'aperture',
                val: res.item.cameraName || res.item.name
            });
        }
    }
    if (isoEv != null && (!camera.ptp.settings.details || (camera.ptp.settings.details.iso && isoEv != camera.ptp.settings.details.iso.ev))) {
        var res = getItemFromEvList(camera.ptp.settings.lists.iso, isoEv + correction);
        if(res != null) {
            correction = res.correction;
            setQueue.push({
                name: 'iso',
                val: res.item.cameraName || res.item.name
            });
        }
    }

    runQueue(setQueue, function() {
        if (cb) camera.getEv(cb);
    });
}

camera.minEv = function(settings, options) {
    var stats = lists.evStats(settings, options);
    return stats.minEv;
}

camera.maxEv = function(settings, options) {
    var stats = lists.evStats(settings, options);
    return stats.maxEv;
}

camera.captureEv = function(ev, cb) {
    var res = camera.setEv(ev);
    var evDiff = res.ev - ev;
}


module.exports = camera;