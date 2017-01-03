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

camera.fixedApertureEv = -4;

var cbStore = {};
var cbIndex = 0;

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

camera.autoSetEv = function() {
    camera.getEv(function(err, currentEv) {
        var expEv = camera.ptp.ev;
        console.log("currentEv EV:", currentEv);
        console.log("Exposure EV:", expEv);
        var targetEv = currentEv + expEv;
        console.log("Target EV:", targetEv);
        camera.setEv(targetEv);
        camera.ptp.getSettings();
    });
}

camera.getEvFromSettings = function(cameraSettings) {
    var settings = cameraSettings.details;
    var av = (settings.aperture && settings.aperture.ev) ? settings.aperture.ev : camera.fixedApertureEv;

    if(settings && settings.shutter && settings.iso) {
        return lists.getEv(settings.shutter.ev, av, settings.iso.ev);
    } else {
        return null;
    }
}

camera.getEv = function(callback) {
    camera.ptp.getSettings(function() {
        var settings = camera.ptp.settings.details;
        var av = (settings.aperture && settings.aperture.ev) ? settings.aperture.ev : camera.fixedApertureEv;

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

camera.setEv = function(ev, options, cb) {
    if (!options) options = {};
    var doSet = function(settings) {
        var shutter = settings.shutter;
        var aperture = settings.aperture;
        var iso = settings.iso;

        if (!aperture) {
            options.apertureEnabled = false;
            aperture = {
                ev: camera.fixedApertureEv
            };
        }


        var shutterList = camera.ptp.settings.lists.shutter;
        var apertureList = camera.ptp.settings.lists.aperture;
        var isoList = camera.ptp.settings.lists.iso;

        console.log("isoList1: ", isoList);

        if(shutterList) shutterList = lists.cleanEvCopy(shutterList);
        if(apertureList) apertureList = lists.cleanEvCopy(apertureList);
        if(isoList) isoList = lists.cleanEvCopy(isoList);

        console.log("isoList2: ", isoList);

        if (options && options.maxShutterLengthMs) {
            var maxSeconds = Math.floor(options.maxShutterLengthMs / 1000);
            if(maxSeconds < 1) maxSeconds = 1;
            console.log("MAX seconds for shutter: ", maxSeconds);
            shutterList = shutterList.filter(function(item) {
                return lists.getSecondsFromEv(item.ev) <= maxSeconds;
            });
            console.log("Filtered shutter list: ", shutterList);
        }
        if (options && options.shutterMax !== null) {
            shutterList = shutterList.filter(function(item) {
                return item.ev >= options.shutterMax;
            });
        }
        if (options && options.isoMax !== null) {
            isoList = isoList.filter(function(item) {
                return item.ev >= options.isoMax;
            });
        }
        if (options && options.isoMin !== null) {
            isoList = isoList.filter(function(item) {
                return item.ev <= options.isoMin;
            });
        }

        console.log("isoList3: ", isoList);

        var currentEv = lists.getEv(shutter.ev, aperture.ev, iso.ev);
        console.log("setEv: currentEv: ", currentEv);
        console.log("setEv: newEv: ", ev);

        if (ev === null) {
            if (cb) cb(null, {
                ev: currentEv,
                shutter: shutter,
                aperture: aperture,
                iso: iso
            });
            return;
        }

        for (var trys = 0; trys < 3; trys++) {
            while (ev < currentEv - 1 / 6) {
                //console.log("ev < currentEv");
                var s = lists.decEv(shutter, shutterList);
                if (options.apertureEnabled) var a = lists.decEv(aperture, apertureList);
                var i = lists.decEv(iso, isoList);

                if (s && shutter.ev != s.ev) {
                    shutter = s;
                } else if (options.apertureEnabled && a && aperture.ev != a.ev) {
                    aperture = a;
                } else if (i && iso.ev != i.ev) {
                    iso = i;
                } else {
                    currentEv = lists.getEv(shutter.ev, aperture.ev, iso.ev);
                    break;
                }
                currentEv = lists.getEv(shutter.ev, aperture.ev, iso.ev);
                //console.log(" update: ", currentEv);
            }

            while (ev > currentEv + 1 / 6) {
                //console.log("ev > currentEv");
                var s = lists.incEv(shutter, shutterList);
                if (options.apertureEnabled) var a = lists.incEv(aperture, apertureList);
                var i = lists.incEv(iso, isoList);

                if (i && iso.ev != i.ev) {
                    iso = i;
                } else if (options.apertureEnabled && a && aperture.ev != a.ev) {
                    aperture = a;
                } else if (s && shutter.ev != s.ev) {
                    shutter = s;
                } else {
                    currentEv = lists.getEv(shutter.ev, aperture.ev, iso.ev);
                    break;
                }
                currentEv = lists.getEv(shutter.ev, aperture.ev, iso.ev);
                //console.log(" update: ", currentEv);
            }

            if (Math.abs(ev - currentEv) <= 1 / 6) break;

        }


        console.log("   done: ", currentEv);

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

        var setQueue = [];

        if (shutter.ev != settings.shutter.ev) setQueue.push({
            name: 'shutter',
            val: shutter.cameraName || shutter.name
        });
        if (options.apertureEnabled && aperture.ev != settings.aperture.ev) setQueue.push({
            name: 'aperture',
            val: aperture.cameraName || aperture.name
        });
        if (iso.ev != settings.iso.ev) setQueue.push({
            name: 'iso',
            val: iso.cameraName || iso.name
        });

        runQueue(setQueue, function() {
            if (cb) cb(null, {
                ev: currentEv,
                shutter: shutter,
                aperture: aperture,
                iso: iso
            });

        });
    }

    if (options && options.settingsDetails) {
        doSet(options.settingsDetails);
    } else {
        camera.ptp.getSettings(function() {
            var settings = camera.ptp.settings.details;
            doSet(settings);
        });
    }

}

camera.evStats = function(settings, options) {
    var res = {};
    if (settings.details) settings = settings.details;

    var av = (settings.aperture && settings.aperture.ev !== null) ? settings.aperture.ev : camera.fixedApertureEv;

    res.ev = null;
    if (settings.shutter && settings.shutter.ev !== null && settings.iso && settings.iso.ev !== null) res.ev = lists.getEv(settings.shutter.ev, av, settings.iso.ev);

    res.shutterList = camera.ptp.settings.lists.shutter;
    res.apertureList = camera.ptp.settings.lists.aperture;
    res.isoList = camera.ptp.settings.lists.iso;

    if (options && options.maxShutterLengthMs) {
        res.shutterList = res.shutterList.filter(function(item) {
            return lists.getSecondsFromEv(item.ev) * 1000 < options.maxShutterLengthMs;
        });
    }
    if (options && options.shutterMax !== null) {
        res.shutterList = res.shutterList.filter(function(item) {
            return item.ev >= options.shutterMax;
        });
    }
    if (options && options.isoMax !== null) {
        res.isoList = res.isoList.filter(function(item) {
            return item.ev >= options.isoMax;
        });
    }
    if (options && options.isoMin !== null) {
        res.isoList = res.isoList.filter(function(item) {
            return item.ev <= options.isoMin;
        });
    }

    res.shutterEvMin = lists.getMinEv(res.shutterList);
    res.shutterEvMax = lists.getMaxEv(res.shutterList);
    res.apertureEvMin = av; //lists.getMinEv(res.apertureList);
    res.apertureEvMax = av; //lists.getMaxEv(res.apertureList);
    res.isoEvMin = lists.getMinEv(res.isoList);
    res.isoEvMax = lists.getMaxEv(res.isoList);

    // 16 = 10 + eS (6) + eI (0)
    //  3 = 10 + eS (-1) + eI (-6)

    res.minEv = res.shutterEvMin + 6 + res.apertureEvMin + 8 + res.isoEvMin;
    res.maxEv = res.shutterEvMax + 6 + res.apertureEvMax + 8 + res.isoEvMax;

    return res;
}

camera.minEv = function(settings, options) {
    var stats = camera.evStats(settings, options);
    return stats.minEv;
}

camera.maxEv = function(settings, options) {
    var stats = camera.evStats(settings, options);
    return stats.maxEv;
}

camera.captureEv = function(ev, cb) {
    var res = camera.setEv(ev);
    var evDiff = res.ev - ev;
}



module.exports = camera;