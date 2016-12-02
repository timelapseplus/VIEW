var EventEmitter = require("events").EventEmitter;
var exec = require('child_process').exec;
require('rootpath')();
var camera = require('camera/camera.js');
var image = require('camera/image/image.js');
var exp = require('intervalometer/exposure.js');
var interpolate = require('intervalometer/interpolate.js');
var fs = require('fs');
var async = require('async');
var TLROOT = "/root/time-lapse";


var intervalometer = new EventEmitter();

var timerHandle = null;
var delayHandle = null;

intervalometer.currentProgram = {
    rampMode: "fixed",
    intervalMode: "fixed",
    interval: 5,
    dayInterval: 5,
    nightInterval: 35,
    frames: 300,
    destination: 'camera',
    nightCompensation: -1,
    maxShutterLengthEv: -11,
};

var rate = 0;
var status = {
    running: false,
    frames: 0,
    framesRemaining: 0,
    rampRate: 0,
    intervalMs: 0,
    message: "",
    rampEv: null
}

var settings = {
    paddingTimeMs: 5000
}

var nmx = null;

intervalometer.timelapseFolder = false;

intervalometer.status = status;

function fileInit() {
    fs.writeFileSync(status.timelapseFolder + "/details.csv", "frame, error, target, setting, rate, interval, timestamp, file, p, i, d\n");
}

function writeFile() {
    fs.appendFileSync(status.timelapseFolder + "/details.csv", status.frames + ", " + status.evDiff + "," + exp.status.targetEv + "," + status.rampEv + "," + exp.status.rate + "," + (status.intervalMs / 1000) + "," + status.lastPhotoTime + "," + status.path + "," + exp.status.pComponent + "," + exp.status.iComponent + "," + exp.status.dComponent + "\n");
    //image.writeXMP(name, status.evDiff);
}


var startShutterEv = -1;

function calculateIntervalMs(interval, currentEv) {
    var dayEv = 8;
    var nightEv = -2;
    if (intervalometer.currentProgram.intervalMode == 'fixed') {
        console.log("using fixed interval: ", interval);
        return interval * 1000;
    } else {
        /*if (status.frames == 0) {
            startShutterEv = shutterEv;
            if (startShutterEv < -5) startShutterEv = -5;
        }
        var thirtySecondEv = -11;
        var newInterval = interpolate.linear([{
            x: startShutterEv,
            y: parseInt(intervalometer.currentProgram.dayInterval)
        }, {
            x: thirtySecondEv,
            y: parseInt(intervalometer.currentProgram.nightInterval)
        }], shutterEv);*/

        var newInterval = interpolate.linear([{
            x: dayEv,
            y: parseInt(intervalometer.currentProgram.dayInterval)
        }, {
            x: nightEv,
            y: parseInt(intervalometer.currentProgram.nightInterval)
        }], currentEv);
        return newInterval * 1000;
    }
}

function doKeyframeAxis(axisName, axisSubIndex, setupFirst, motionFunction) {
    var keyframes = intervalometer.currentProgram.keyframes;
    if (status.running && keyframes && keyframes.length > 0 && keyframes[0][axisName] != null) {
        var kfSet = null;
        var kfCurrent = null;

        if (setupFirst) {
            keyframes[0].seconds = 0;
            if(axisSubIndex !== null) {
                keyframes[0][axisName][axisSubIndex] = 0;
            } else {
                keyframes[0][axisName] = 0;
            }
            kfSet = 0;
        } else {
            var secondsSinceStart = status.lastPhotoTime + (status.intervalMs / 1000);

            console.log("Seconds since start: " + secondsSinceStart);
            kfPoints = keyframes.map(function(kf) {
                if(axisSubIndex !== null) {
                    return {
                        x: kf.seconds,
                        y: kf[axisName][axisSubIndex] || 0
                    }
                } else {
                    return {
                        x: kf.seconds,
                        y: kf[axisName] || 0
                    }
                }
            });
            kfSet = interpolate.linear(kfPoints, secondsSinceStart);
            console.log(axisName + " target: " + kfSet);
        }
        var axisNameExtension = '';
        if(axisSubIndex !== null) axisNameExtension = '-' + axisSubIndex;
        kfCurrent = intervalometer.currentProgram[axisName + axisNameExtension + 'Pos'];

        if (kfCurrent == null) {
            motionFunction(kfSet); // absolute setting (like ev)
        } else {
            var kfTarget = Math.round(kfSet);
            if (kfTarget != intervalometer.currentProgram[axisName + axisNameExtension + 'Pos']) {
                var relativeMove = kfTarget - intervalometer.currentProgram[axisName + axisNameExtension + 'Pos'];
                motionFunction(relativeMove);
                intervalometer.currentProgram[axisName + axisNameExtension + 'Pos'] = kfTarget;
            } else {
                if (motionFunction) motionFunction();
            }
        }

    } else {
        if (motionFunction) motionFunction();
    }
}

function processKeyframes(setupFirst, callback) {

    var numAxes = 2;
    var axesDone = 0;

    if(intervalometer.currentProgram.keyframes && intervalometer.currentProgram.keyframes.length > 0 && intervalometer.currentProgram.keyframes[0].motor) {
        for(motorId in intervalometer.currentProgram.keyframes[0].motor) numAxes++;
    }

    var checkDone = function() {
        axesDone++;
        console.log(axesDone + " keyframe items complete");
        if (axesDone >= numAxes && callback) {
            console.log("keyframes complete, running callback");
            callback();
        }
    }

    doKeyframeAxis('ev', null, setupFirst, function(ev) {
        //if (ev !== null && camera.settings.ev != ev) camera.setEv(ev);
        checkDone();
    });

    doKeyframeAxis('focus', null, setupFirst, function(focus) {
        if (focus) {
            camera.ptp.preview(function() {
                setTimeout(function() {
                    console.log("Moving focus by " + focus + " steps");
                    var dir = focus > 0 ? 1 : -1;
                    var steps = Math.abs(focus);
                    camera.ptp.focus(dir, steps, function() {
                        checkDone();
                    });
                }, 500);
            });
        } else {
            checkDone();
        }
    });

    if(intervalometer.currentProgram.keyframes && intervalometer.currentProgram.keyframes.length > 0 && intervalometer.currentProgram.keyframes[0].motor) for(motorId in intervalometer.currentProgram.keyframes[0].motor) {
        doKeyframeAxis('motor', motorId, setupFirst, function(move) {
            var parts = motorId.split('-');
            if (move && parts.length == 2) {
                var driver = parts[0];
                var motor = parts[1];
                console.log("Moving " + motorId + " by " + move + " steps");
                if(driver == 'NMX') {
                    if (nmx && nmx.getStatus().connected) {
                        nmx.move(motor, 0 - move, function() {
                            checkDone();
                        });
                    } else {
                        console.log("error moving -- nmx not connected");
                        checkDone();
                    }
                } else {
                    checkDone();
                }
            } else {
                checkDone();
            }
        });
    }

}

var busyPhoto = false;

function runPhoto() {
    if (busyPhoto) {
        if (status.running) setTimeout(runPhoto, 100);
        return;
    }
    busyPhoto = true;
    if (camera.ptp.connected) {
        var captureOptions = {
            thumbnail: true,
            index: status.frames
                //saveTiff: "/mnt/sd/test" + status.frames + ".tiff",
                //saveRaw: "/mnt/sd/test" + status.frames + ".cr2",
        }
        if (intervalometer.currentProgram.destination == 'sd' && camera.ptp.sdPresent && camera.ptp.sdMounted) {
            console.log("Saving timelapse to SD card");
            captureOptions.thumbnail = false;
            var framesPadded = status.frames.toString();
            while (framesPadded.length < 4) framesPadded = '0' + framesPadded;
            captureOptions.saveRaw = status.mediaFolder + "/img-" + framesPadded;
            camera.ptp.saveToCameraCard(false);
        } else {
            camera.ptp.saveToCameraCard(true);
        }

        if (intervalometer.currentProgram.rampMode == "fixed") {
            status.intervalMs = intervalometer.currentProgram.interval * 1000;
            if (status.running) timerHandle = setTimeout(runPhoto, status.intervalMs);
            status.lastPhotoTime = new Date() / 1000 - status.startTime;
            camera.ptp.capture(captureOptions, function(err, photoRes) {
                if (!err && photoRes) {
                    status.path = photoRes.file;
                    status.message = "running";
                    if (status.framesRemaining > 0) status.framesRemaining--;
                    status.frames++;
                    //writeFile();
                    intervalometer.emit("status", status);
                    console.log("program status:", status);
                }
                if (intervalometer.status.framesRemaining < 1 || status.running == false) {
                    clearTimeout(timerHandle);
                    status.running = false;
                    status.message = "done";
                    status.framesRemaining = 0;

                    setTimeout(function(){
                        intervalometer.timelapseFolder = false;
                        camera.ptp.saveThumbnails(intervalometer.timelapseFolder);
                        intervalometer.emit("status", status);
                        camera.ptp.unmountSd();
                        console.log("program:", "done");
                    }, 1000);
                }
                processKeyframes(false, function() {
                    busyPhoto = false;
                });
            });
        } else {
            camera.getEv(function(err, currentEv, params) {
                if (status.rampEv === null) status.rampEv = currentEv;
                status.intervalMs = calculateIntervalMs(intervalometer.currentProgram.interval, status.rampEv);
                console.log("Setting timer for fixed interval at ", status.intervalMs);
                if (status.running) timerHandle = setTimeout(runPhoto, status.intervalMs);
                console.log("current interval: ", status.intervalMs);
                console.log("current ev: ", currentEv);
                if (status.rampEv === null) status.rampEv = currentEv;
                var maxShutterLengthMs = status.intervalMs;
                console.log("maxShutterLengthMs", status.intervalMs);
                if (maxShutterLengthMs > settings.paddingTimeMs) maxShutterLengthMs = (status.intervalMs - settings.paddingTimeMs);
                console.log("maxShutterLengthMs", maxShutterLengthMs);
                camera.setEv(status.rampEv, {
                    maxShutterLengthMs: maxShutterLengthMs
                }, function(err, res) {

                    status.evDiff = res.ev - status.rampEv;
                    captureOptions.exposureCompensation = status.evDiff;

                    console.log("program:", "capture");
                    status.lastPhotoTime = new Date() / 1000 - status.startTime;
                    camera.ptp.capture(captureOptions, function(err, photoRes) {
                        if (!err && photoRes) {
                            //status.rampEv = exp.calculate(currentEv - status.evDiff, photoRes.ev);
                            status.rampEv = exp.calculate(status.rampEv, photoRes.ev, camera.minEv(camera.ptp.settings), camera.maxEv(camera.ptp.settings));
                            status.rampRate = exp.status.rate;
                            status.path = photoRes.file;
                            status.message = "running";
                            if (status.framesRemaining > 0) status.framesRemaining--;
                            status.frames++;
                            writeFile();
                            intervalometer.emit("status", status);
                            console.log("program status:", status);
                        }
                        if ((intervalometer.currentProgram.intervalMode == "fixed" && intervalometer.status.framesRemaining < 1) || status.running == false) {
                            clearTimeout(timerHandle);
                            status.running = false;
                            status.message = "done";
                            status.framesRemaining = 0;
                            setTimeout(function(){
                                intervalometer.timelapseFolder = false;
                                camera.ptp.saveThumbnails(intervalometer.timelapseFolder);
                                intervalometer.emit("status", status);
                                camera.ptp.unmountSd();
                                console.log("program:", "done");
                            }, 1000);
                        }
                        processKeyframes(false, function() {
                            busyPhoto = false;
                        });
                    });

                });
            });
        }
    }
}

function error(msg) {
    setTimeout(function(){
        intervalometer.emit("error", msg);
    }, 100);
}

camera.ptp.on('saveError', function(msg) {
    if (intervalometer.status.running) {
        intervalometer.cancel();
        error("Failed to save RAW image to SD card!\nTime-lapse has been stopped.\nPlease verify that the camera is set to RAW (not RAW+JPEG) and that the SD card is formatted and fully inserted into the VIEW.");
    }
});

intervalometer.validate = function(program) {
    var results = {
        errors: []
    };
    if (parseInt(program.delay) < 1) program.delay = 2;
    if(program.rampMode == 'fixed') {
        if (parseInt(program.frames) < 1) results.errors.push({param:'frames', reason: 'frame count not set'});
    } else {
        if(program.intervalMode == 'fixed' || program.rampMode == 'fixed') {
            if (parseInt(program.interval) < 2) results.errors.push({param:'interval', reason: 'interval not set or too short'});
        } else {
            if (parseInt(program.dayInterval) < 5) results.errors.push({param:'dayInterval', reason: 'dayInterval must be at least 5 seconds'});
            if (parseInt(program.nightInterval) < program.dayInterval) results.errors.push({param:'nightInterval', reason: 'nightInterval shorter than dayInterval'});
        }        
    }

    if(!camera.ptp.supports.destination && (program.destination != 'sd' || !camera.ptp.sdPresent)) {
        console.log("Error: SD card required");
        results.errors.push({param:false, reason: "SD card required. The connected camera (" + camera.ptp.model + ") does not support saving images to the camera.  Please insert an SD card into the VIEW and set the Destination to 'SD Card' so images can be saved to the card."});
    }

    if(!camera.ptp.settings.iso || camera.ptp.settings.iso == 'Auto') {
        console.log("Error: invalid ISO setting");
        results.errors.push({param:false, reason: "invalid ISO setting on camera."});
    }

    if(camera.ptp.settings && camera.ptp.settings.format != 'RAW' && program.destination == 'sd') {
        console.log("Error: camera not set to save in RAW");
        results.errors.push({param:false, reason: "camera must be set to save in RAW. The VIEW expects RAW files when processing images to the SD card (RAW+JPEG does not work)"});
    }

    console.log("validating program:", results);

    return results;
}
intervalometer.cancel = function() {
    if (intervalometer.status.running) {
        clearTimeout(timerHandle);
        clearTimeout(delayHandle);
        status.running = false;
        status.message = "stopped";
        status.framesRemaining = 0;
        intervalometer.emit("status", status);
        console.log("program:", "stopped");

        if(!busyPhoto) {
            intervalometer.timelapseFolder = false;
            camera.ptp.saveThumbnails(intervalometer.timelapseFolder);
            camera.ptp.unmountSd();
        }
    }
}

intervalometer.run = function(program) {
    if (intervalometer.status.running) return;

    if (camera.ptp.connected) {
        camera.ptp.getSettings(function(){
            var validationResults = intervalometer.validate(program);
            if (validationResults.errors.length == 0) {
                var tlIndex = fs.readFileSync(TLROOT + '/index.txt');
                if (!tlIndex) {
                    tlIndex = 1;
                } else {
                    tlIndex = parseInt(tlIndex) + 1;
                }
                fs.writeFileSync(TLROOT + '/index.txt', tlIndex.toString());
                status.tlName = "tl-" + tlIndex;
                intervalometer.timelapseFolder = TLROOT + "/" + status.tlName;
                fs.mkdirSync(intervalometer.timelapseFolder);
                camera.ptp.saveThumbnails(intervalometer.timelapseFolder);
                status.timelapseFolder = intervalometer.timelapseFolder;
                fileInit();

                busyPhoto = false;
                intervalometer.currentProgram = program;
                status.intervalMs = program.interval * 1000;
                status.running = true;
                status.message = "starting";
                status.frames = 0;
                status.framesRemaining = (program.intervalMode == "auto" && program.rampMode == "auto") ? 0 : program.frames;
                status.startTime = new Date() / 1000;
                status.rampEv = null;
                intervalometer.emit("status", status);
                exp.init(camera.minEv(camera.ptp.settings), camera.maxEv(camera.ptp.settings), program.nightCompensation);
                console.log("program:", "starting", program);

                function start() {
                    processKeyframes(true, function() {
                        busyPhoto = false;
                        runPhoto();
                    });
                    //delayHandle = setTimeout(function() {
                    //    runPhoto();
                    //}, program.delay * 1000);
                }

                if (program.destination && program.destination == 'sd' && camera.ptp.sdPresent) {
                    camera.ptp.mountSd(function(mountErr) {
                        if(mountErr) {
                            console.log("Error mounting SD card");
                            intervalometer.cancel();
                            error("Error mounting SD card. \nVerify the SD card is formatted and fully inserted in the VIEW, then try starting the time-lapse again.\nMessage from system: " + mountErr);
                        } else {
                            status.mediaFolder = "/media/" + status.tlName;
                            fs.mkdir(status.mediaFolder, function(folderErr) {
                                if(folderErr) {
                                    console.log("Error creating folder", status.mediaFolder);
                                    intervalometer.cancel();
                                    error("Error creating folder on SD card: /" + status.tlName + ".\nVerify the card is present and not write-protected, then try starting the time-lapse again.\nAlternatively, set the Destination to Camera instead (if supported)");
                                } else {
                                    start();
                                }
                            });
                        }
                    });
                } else {
                    start();
                }
            } else {
                var errorList = "";
                var val = "";
                for(var i = 0; i < validationResults.errors.length; i++) {
                    if(program.hasOwnProperty([validationResults.errors[0].param])) {
                        val = " (" + program[validationResults.errors[0].param] + ")";
                    } else {
                        val = "";
                    }
                    errorList += "- " + validationResults.errors[0].reason + val + "\n";
                }
                intervalometer.cancel();
                error("Failed to start time-lapse: \n" + errorList + "Please correct and try again.");
            }
        });
    } else {
        intervalometer.cancel();
        error("Camera not connected.  Please verify camera connection via USB and try again.");
        return;
    }

}


intervalometer.getLastTimelapse = function(callback) {
    fs.readFile(TLROOT + '/index.txt', function(err, tlIndex) {
        if (!tlIndex) {
            return callback(err);
        } else {
            tlIndex = parseInt(tlIndex);
        }
        return intervalometer.getTimelapseClip(tlIndex, callback);
    });
}

function getClipFramesCount(clipNumber, callback) {
    var folder = TLROOT + "/tl-" + clipNumber;
    console.log("reading frame count for", clipNumber);
    fs.readFile(folder + "/count.txt", function(err, frames) {
        if(err) {
            console.log("clip frames err:", clipNumber, err, frames);
            return callback(null, null);
        } else if (!parseInt(frames)) {
            console.log("recovering count for " + clipNumber);
            intervalometer.getTimelapseData(clipNumber, function(err2, data) {
                if(!err2 && data && data.length > 0) {
                    frames = data.length;
                    fs.writeFile(folder + "/count.txt", frames.toString());
                    console.log("clip frames recovery", clipNumber, frames);
                    return callback(null, frames);
                } else {
                    console.log("clip frames recovery err:", clipNumber, err2, data);
                    return callback(null, null);
                } 
            });
        } else {
            frames = parseInt(frames);
            console.log("clip frames:", clipNumber, frames);
            return callback(null, frames);
        }
    });        
}

intervalometer.getTimelapseClip = function(clipNumber, callback) {
    console.log("fetching timelapse clip " + clipNumber);
    var clip = {};
    var folder = TLROOT + "/tl-" + clipNumber;
    getClipFramesCount(clipNumber, function(err, frames) {
        clip.frames = frames;
        if (!clip.frames) {
            if (err) console.log("clip frames err:", err, clip);
            return callback(null, null);
        }
        clip.index = clipNumber;
        clip.name = "TL-" + clipNumber;
        clip.path = folder + "/img%05d.jpg";
        fs.readFile(folder + "/img00001.jpg", function(err, jpegData) {
            clip.image = jpegData;
            if (err) console.log("clip fetch err:", err, clip);
            callback(null, err ? null : clip);
        });
    });
}

intervalometer.getRecentTimelapseClips = function(count, callback) {
    var tlIndex = fs.readFile(TLROOT + '/index.txt', function(err, tlIndex) {
        if (!tlIndex) {
            if (callback) callback(false);
            return;
        } else {
            tlIndex = parseInt(tlIndex);
        }

        var clips = [];
        var getNextClip = function() {
            if(tlIndex > 0 && clips.length < count) {
                intervalometer.getTimelapseClip(tlIndex, function(err, clip) {
                    if(!err && clip && clip.name) {
                        clips.push(clip);
                    }
                    tlIndex--;
                    getNextClip();
                });
            } else {
                callback(clips);
            }
        }
        getNextClip();
    });
}

intervalometer.getTimelapseImages = function(clipNumber, callback) {
    try {
        console.log("fetching timelapse clip " + clipNumber);
        var clip = {};
        var folder = TLROOT + "/tl-" + clipNumber;
        getClipFramesCount(clipNumber, function(err, frames) {
            clip.frames = frames;
            if (!clip.frames) {
                if (err) console.log("clip frames err:", err, clip);
                return callback(null, null);
            }
            clip.name = "TL-" + clipNumber;
            clip.path = folder + "/img%05d.jpg";

            function getTimelapseImage(index, cb) {
                index++;
                indexString = index.toString();
                while (indexString.length < 5) indexString = "0" + indexString;
                fs.readFile(folder + "/img" + indexString + ".jpg", function(err, jpegData) {
                    cb(null, err ? null : jpegData);
                });
            }

            var clipImages = [];
            for (var i = 0; i < clip.frames; i++) clipImages.push(i);

            async.map(clipImages, getTimelapseImage, function(err, images) {
                callback(null, images.filter(function(image) {
                    return image !== null;
                }));
            });
        });
    } catch (e) {
        if(callback) callback(e);
    }
}

intervalometer.saveXMPsToCard = function(clipNumber, callback) {
    if (camera.ptp.sdPresent) {
        camera.ptp.mountSd(function() {
            if (camera.ptp.sdMounted) {
                var destDolder = "/media/tl-" + clipNumber + "-xmp";
                console.log("writing XMPs to " + destDolder);
                fs.mkdir(destDolder, function(err) {
                    if (err) {
                        if (err.code == "EEXIST") {
                            console.log("folder 'tl-" + clipNumber + "-xmp' already exists", err);
                            callback("folder 'tl-" + clipNumber + "-xmp' already exists on SD card");
                        } else {
                            console.log("error creating folder", err);
                            callback("error creating folder on SD card");
                        }
                    } else {
                        intervalometer.writeXMPs(clipNumber, destDolder, function(){
                            setTimeout(function() {
                                camera.ptp.unmountSd(function() {
                                    if(callback) callback();
                                });
                            }, 500);
                        });
                    }
                });
            } else {
                callback("SD card error");
            }
        });
    } else {
        callback("SD card not present");
    }
}

intervalometer.eraseAll = function() {
    exec("sudo rm -rf " + TLROOT + "/*", function() {
        exec("cp -r /home/view/current/demo/* " + TLROOT + "/");
    });
}

intervalometer.deleteTimelapseClip = function(clipNumber, callback) {
    var name = "tl-" + clipNumber;
    var folder = TLROOT + "/" + name;
    exec("sudo rm -rf " + folder, function(err) {
        callback && callback(err);
    });
}

intervalometer.getTimelapseData = function (clipNumber, callback) {
    var name = "tl-" + clipNumber;
    var folder = TLROOT + "/" + name;
    var dataSet = [];
    fs.readFile(folder + "/details.csv", function(err, details) {
        if (!err && details) {
            var detailsLines = details.toString().split('\n');
            for (var i = 1; i < detailsLines.length; i++) {
                var data = detailsLines[i].split(',');
                if (data && data.length >= 2 && parseInt(data[0].trim()) != NaN) {
                    var fileNumberString = data[7].match(/([A-Z0-9_]{8})\.[A-Z0-9]+$/i)[1];
                    dataSet.push({
                        fileNumberString: fileNumberString,
                        evCorrection: parseFloat(data[1]),
                        evSetting: parseFloat(data[3])
                    });
                }
            }
            if (callback) callback(null, dataSet);
        } else {
            console.log("error opening clip info", err);
            if (callback) callback("error opening clip info");
        }
    });
}

intervalometer.writeXMPs = function(clipNumber, destinationFolder, callback) {
    var name = "tl-" + clipNumber;
    var smoothing = 5; // blend changes across +/- 5 frames (11 frame average)

    intervalometer.getTimelapseData(clipNumber, function(err, data) {
        if (!err && data) {
            for (var i = 1; i < data.length; i++) {
                var smoothCorrection = 0;
                if(smoothing && i > smoothing && i < data.length - smoothing) {
                    var evSetting = data[i].evSetting;
                    var evSum = evSetting;
                    for(var j = 0; j < smoothing; j++) evSum += data[i - j].evSetting;
                    for(var j = 0; j < smoothing; j++) evSum += data[i + j].evSetting;
                    smoothCorrection = evSum / (smoothing * 2 + 1) - evSetting;
                }
                var xmpFile = destinationFolder + "/" + data[i].fileNumberString + ".xmp";
                console.log("Writing " + xmpFile);
                var desc = name + " created with the Timelapse+ VIEW\nImage #" + data[i].fileNumberString + "\nBase Exposure: " + data[i].evCorrection - smoothCorrection;
                image.writeXMP(xmpFile, data[i].evCorrection - smoothCorrection, desc, name);
            }
            if (callback) callback();
        } else {
            if (callback) callback(err);
        }
    });
}

intervalometer.addNmx = function(nmxObject) {
    nmx = nmxObject;
}

module.exports = intervalometer;