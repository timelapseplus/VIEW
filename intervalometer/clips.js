var exec = require('child_process').exec;
require('rootpath')();
var image = require('camera/image/image.js');
var core = require('intervalometer/intervalometer-client.js');
var fs = require('fs');
var async = require('async');
var TLROOT = "/root/time-lapse";

var db = require('system/db.js');

var clips = {};

function getClipFramesCount(clipNumber, callback) {
    var folder = TLROOT + "/tl-" + clipNumber;
    //console.log("reading frame count for", clipNumber);
    db.getTimelapseByName('tl-' + clipNumber, function(err, clip) {
        if(!err && clip) {
            return callback(null, clip.frames);            
        } else { // old way
            fs.readFile(folder + "/count.txt", function(err, frames) {
                if(err) {
                    //console.log("clip frames err:", clipNumber, err, frames);
                    return callback(null, null);
                } else if (!parseInt(frames)) {
                    //console.log("recovering count for " + clipNumber);
                    clips.getTimelapseData(clipNumber, 0, function(err2, data) {
                        if(!err2 && data && data.length > 0) {
                            frames = data.length;
                            fs.writeFile(folder + "/count.txt", frames.toString());
                            //console.log("clip frames recovery", clipNumber, frames);
                            return callback(null, frames);
                        } else {
                            console.log("clip frames recovery err:", clipNumber, err2, data);
                            return callback(null, null);
                        } 
                    });
                } else {
                    frames = parseInt(frames);
                    //console.log("clip frames:", clipNumber, frames);
                    return callback(null, frames);
                }
            });        
        }
    });
}

clips.getClipFramesCount = getClipFramesCount;

clips.getTimelapseClip = function(clipNumber, callback) {
    //console.log("fetching timelapse clip " + clipNumber);
    var clip = {};
    var folder = TLROOT + "/tl-" + clipNumber;
    db.getTimelapseByName('tl-' + clipNumber, function(err, dbClip) {
        if(!err && dbClip) {
            clip.index = clipNumber;
            clip.id = dbClip.id;
            clip.frames = dbClip.frames;
            clip.name = "TL-" + clipNumber;
            if(dbClip.thumbnail) {
                fs.readFile(dbClip.thumbnail, function(err, jpegData) {
                    clip.image = jpegData;
                    //if (err) console.log("clip fetch err:", err, clip);
                    callback(null, err ? null : clip);
                });
            } else {
                callback(null, null);
            }
        } else {
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
                    //if (err) console.log("clip fetch err:", err, clip);
                    callback(null, err ? null : clip);
                });
            });
        }
    });
}

clips.getLastTimelapse = function(callback) {
    fs.readFile(TLROOT + '/index.txt', function(err, tlIndex) {
        if (!tlIndex) {
            return callback(err);
        } else {
            tlIndex = parseInt(tlIndex);
        }
        return clips.getTimelapseClip(tlIndex, callback);
    });
}

clips.getRecentTimelapseClips = function(count, callback) {
    var tlIndex = fs.readFile(TLROOT + '/index.txt', function(err, tlIndex) {
        if (!tlIndex) {
            if (callback) callback(false);
            return;
        } else {
            tlIndex = parseInt(tlIndex);
        }

        var clipsResults = [];
        fs.readdir(TLROOT, function(err, files) {
            files = files.map(function(file) {
                return file.toLowerCase();
            });
            var getNextClip = function() {
                if(tlIndex > 0 && clipsResults.length < count) {
                    if(files.indexOf('tl-' + tlIndex) === -1) {
                        tlIndex--;
                        getNextClip();
                    } else {
                        clips.getTimelapseClip(tlIndex, function(err, clip) {
                            if(!err && clip && clip.name) {
                                clipsResults.push(clip);
                            }
                            tlIndex--;
                            getNextClip();
                        });
                    }
                } else {
                    setTimeout(function(){
                        //console.log("clipsResults:", clipsResults);
                        clipsResults = clipsResults.sort(function(a, b){
                            if(a.index < b.index) {
                                return 1;
                            }
                            if(a.index > b.index) {
                                return -1;
                            }
                            return 0;
                        });
                        callback(null, clipsResults); 
                    });
                }
            }
            getNextClip();
        });
    });
}

clips.getTimelapseImagesFromPaths = function(framesPaths, hq, callback) {
    if(!framesPaths || framesPaths.length == 0) return callback && callback();
    fs.readFile(framesPaths[0].replace(/\.jpg$/, "q.jpg"), function(err, jpegData) {
        if(!err && jpegData) {
            for(var i = 0; i < framesPaths.length; i++) {
                framesPaths[i] = framesPaths[i].replace(/\.jpg$/, "q.jpg");
            }
        }
        async.map(framesPaths, fs.readFile, function(err, images) {
            callback && callback(err, images);
        });
    });
}

clips.getTimelapseImagesHq = function(clipNumber, startFrame, limitFrames, callback) {
    db.getTimelapseByName('tl-' + clipNumber, function(err, dbClip) {
        if(!err && dbClip && dbClip.thumbnail) {
            var thumbnail = dbClip.thumbnail.replace(/\.jpg$/, "q.jpg"); // test if hq version is available
            fs.readFile(thumbnail, function(err, jpegData) {
                if(!err && jpegData) {
                    getTimelapseImages(clipNumber, startFrame, limitFrames, true, callback);
                } else {
                    getTimelapseImages(clipNumber, startFrame, limitFrames, false, callback);
                }
            });
        } else {
            getTimelapseImages(clipNumber, startFrame, limitFrames, false, callback);
        }
    });
}

clips.getTimelapseImages = function(clipNumber, startFrame, limitFrames, callback) {
    getTimelapseImages(clipNumber, startFrame, limitFrames, false, callback);
}

var getTimelapseImages = function(clipNumber, startFrame, limitFrames, hq, callback) {
    try {
        //console.log("fetching timelapse clip " + clipNumber);
        var clip = {};
        var folder = TLROOT + "/tl-" + clipNumber;
        db.getTimelapseByName('tl-' + clipNumber, function(err, dbClip) {
            if(!err && dbClip) {
                db.getTimelapseFrames(dbClip.id, 1, function(err, clipFrames){
                    if(!err && clipFrames) {
                        clipFrames = clipFrames.slice(startFrame, startFrame + limitFrames);
                        var framesPaths = clipFrames.map(function(frame){
                            if(hq) {
                                frame.thumbnail = frame.thumbnail.replace(/\.jpg$/, "q.jpg"); // hq version
                            }
                            return frame.thumbnail;
                        });
                        async.map(framesPaths, fs.readFile, function(err, images) {
                            callback(err, images);
                        });
                    } else {
                        callback(null, null);
                    }

                });

            } else {
                getClipFramesCount(clipNumber, function(err, frames) {
                    clip.frames = frames;
                    if (!clip.frames) {
                        //if (err) console.log("clip frames err:", err, clip);
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
                    clipImages = clipImages.slice(startFrame, startFrame + limitFrames);

                    async.map(clipImages, getTimelapseImage, function(err, images) {
                        callback(null, images.filter(function(image) {
                            return image != null;
                        }));
                    });
                });
            }
        });
    } catch (e) {
        if(callback) callback(e);
    }
}

clips.saveXMPsToCard = function(clipNumber, callback) {
    if (core.sdPresent) {
        core.mountSd(function() {
            if (core.sdMounted) {
                var destFolder = "/media/tl-" + clipNumber + "-xmp";
                console.log("writing XMPs to " + destFolder);
                fs.mkdir(destFolder, function(err) {
                    if (err) {
                        if (err.code == "EEXIST") {
                            console.log("folder 'tl-" + clipNumber + "-xmp' already exists", err);
                            callback("folder 'tl-" + clipNumber + "-xmp' already exists on SD card");
                        } else {
                            console.log("error creating folder", err);
                            callback("error creating folder on SD card");
                        }
                    } else {
                        db.getTimelapseByName('tl-' + clipNumber, function(err, clip) {
                            if(!err && clip && clip.cameras) {
                                if(clip.cameras > 1) {
                                    var createCameraSubfolder = function(cameraNumber) {
                                        var cameraFolder = destFolder + '/camera' + cameraNumber;
                                        fs.mkdir(cameraFolder, function(err) {
                                            if (err) {
                                                if (err.code == "EEXIST") {
                                                    console.log("folder '" + cameraFolder + "' already exists", err);
                                                    callback("folder 'tl-" + clipNumber + '/camera' + cameraNumber + "-xmp' already exists on SD card");
                                                } else {
                                                    console.log("error creating folder", err);
                                                    callback("error creating folder on SD card");
                                                }
                                            } else {
                                                console.log("clips.saveXMPsToCard: writing XMPs for camera", cameraNumber);
                                                clips.writeXMPs(clipNumber, cameraNumber, cameraFolder, function(){
                                                    if(cameraNumber < clip.cameras) {
                                                        setTimeout(function(){
                                                            createCameraSubfolder(cameraNumber + 1);
                                                        });
                                                    } else {
                                                        setTimeout(function() {
                                                            core.unmountSd(function() {
                                                                if(callback) callback();
                                                            });
                                                        }, 500);
                                                    }
                                                });
                                            }
                                        });
                                    }
                                    createCameraSubfolder(1);

                                } else {
                                    clips.writeXMPs(clipNumber, 1, destFolder, function(){
                                        setTimeout(function() {
                                            core.unmountSd(function() {
                                                if(callback) callback();
                                            });
                                        }, 500);
                                    });
                                }
                            } else {
                                clips.writeXMPs(clipNumber, 0, destFolder, function(){
                                    setTimeout(function() {
                                        core.unmountSd(function() {
                                            if(callback) callback();
                                        });
                                    }, 500);
                                });
                            }
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

clips.saveSpreadsheetToCard = function(clipNumber, callback) {
    if (core.sdPresent) {
        core.mountSd(function() {
            if (core.sdMounted) {
                var destPath = "/media/tl-" + clipNumber + "-data.csv";
                console.log("writing CSV to " + destPath);
                clips.getSpreadsheet(clipNumber, 0, function(err, csv){
                    if(!err && csv) {
                        fs.writeFile(destPath, csv, function(err){
                            setTimeout(function() {
                                core.unmountSd(function() {
                                    if(callback) callback(err);
                                });
                            }, 500);
                        });
                    } else {
                        if(callback) callback(err);
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

clips.eraseAll = function() {
    exec("sudo rm -rf " + TLROOT + "/*", function() {
        exec("cp -r /home/view/current/demo/* " + TLROOT + "/");
    });
}

clips.deleteTimelapseClip = function(clipNumber, callback) {
    var name = "tl-" + clipNumber;
    var folder = TLROOT + "/" + name;
    db.deleteTimelapse(name, function(err1) {
        exec("sudo rm -rf " + folder, function(err) {
            callback && callback(err);
        });
    });
}

clips.getSpreadsheet = function(clipNumber, cameraNumber, callback) {
    var name = "tl-" + clipNumber;
    var header = [];
    var rows = [];
    db.getTimelapseByName(name, function(err, clip) {
        if(err || !clip) {
            console.log("error opening clip info from db", err);
            return callback && callback("error opening clip info");
        }
        if(cameraNumber > clip.cameras) {
            console.log("camera number out of range", err);
            return callback && callback("invalid camera number");
        }
        console.log("getting frames for", name);
        db.getTimelapseFrames(clip.id, cameraNumber, function(err, clipFrames){
            if(err || !clipFrames) {
                console.log("error getting clip frames from db", err);
                return callback && callback("error opening clip frames");
            }
            console.log("retrieved " + clipFrames.length + " frames for", name);
            for(var i = 0; i < clipFrames.length; i++) {
                var details = clipFrames[i].details;
                var row = [];
                for(var key in details) {
                    if(typeof details[key] == 'object') {
                        for(var subKey in details[key]) {
                            var index = header.indexOf(key + '.' + subKey);
                            if(index === -1) {
                                header.push(key + '.' + subKey);
                                index = header.length -1;
                            }
                            row[index] = details[key][subKey];
                        }
                    } else {
                        var index = header.indexOf(key);
                        if(index === -1) {
                            header.push(key);
                            index = header.length -1;
                        }
                        if(key == 'fileName') {
                            var fileNumberString = details[key].match(/([A-Z0-9_]{8}\.[A-Z0-9]+)$/i)[1];
                            row[index] = fileNumberString;
                        } else if(details[key] != null) {
                            row[index] = details[key].toString();
                        } else {
                            row[index] = '';
                        }
                    }
                }
                rows.push(row);
            }
            var csv = header.join(',') + "\n";
            for(var i = 0; i < rows.length; i++) {
                while(rows[i].length < header.length) rows[i].push('');
                csv += rows[i].join(',') + "\n";
            }
            if (callback) callback(null, csv);
        });
    });
}

clips.getTimelapseData = function (clipNumber, cameraNumber, callback) {
    var name = "tl-" + clipNumber;
    var dataSet = [];
    if(typeof cameraNumber === 'function') {
        callback = cameraNumber;
        cameraNumber = null;
    }
    if(!cameraNumber) {
        var folder = TLROOT + "/" + name;
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
    } else {
        db.getTimelapseByName(name, function(err, clip) {
            if(err || !clip) {
                console.log("error opening clip info from db", err);
                return callback && callback("error opening clip info");
            }
            if(cameraNumber > clip.cameras) {
                console.log("camera number out of range", err);
                return callback && callback("invalid camera number");
            }
            console.log("getting frames for", name);
            db.getTimelapseFrames(clip.id, cameraNumber, function(err, clipFrames){
                if(err || !clipFrames) {
                    console.log("error getting clip frames from db", err);
                    return callback && callback("error opening clip frames");
                }
                console.log("retrieved " + clipFrames.length + " frames for", name);
                for(var i = 0; i < clipFrames.length; i++) {
                    var fileNumberString = clipFrames[i].details.fileName.match(/([A-Z0-9_]{8})\.[A-Z0-9]+$/i)[1];
                    dataSet.push({
                        fileNumberString: fileNumberString,
                        evCorrection: clipFrames[i].details.evCorrection,
                        evSetting: clipFrames[i].details.actualEv,
                        latitude: clipFrames[i].details.latitude,
                        longitude: clipFrames[i].details.longitude,
                    });
                }
                if (callback) callback(null, dataSet);
            });
        });
    }
}

clips.writeXMPs = function(clipNumber, cameraNumber, destinationFolder, callback) {
    var name = "tl-" + clipNumber.toString();
    var smoothing = 8; // blend changes across +/- 8 frames (15 frame average)

    clips.getTimelapseData(clipNumber, cameraNumber, function(err, data) {
        if (!err && data) {
            var i = 0;
            var writeXMPfile = function() {
                if(i < data.length) {
                    var smoothCorrection = 0;
                    if(smoothing && i > smoothing && i < data.length - smoothing) {
                        var evSetting = data[i].evSetting;
                        var evSum = evSetting;
                        for(var j = 0; j < smoothing; j++) evSum += data[i - j].evSetting;
                        for(var j = 0; j < smoothing; j++) evSum += data[i + j].evSetting;
                        smoothCorrection = evSum / (smoothing * 2 + 1) - evSetting;
                    }
                    var xmpFile = destinationFolder + "/" + data[i].fileNumberString + ".xmp";
                    console.log("Writing " + xmpFile, ",", data[i].evSetting, ",", data[i].evCorrection - smoothCorrection, ",", smoothCorrection);
                    var desc = name + " created with the Timelapse+ VIEW\nImage #" + data[i].fileNumberString + "\nBase Exposure: " + (data[i].evCorrection - smoothCorrection).toString();
                    image.writeXMP(xmpFile, data[i].evCorrection - smoothCorrection, desc, name, data[i].latitude, data[i].longitude);
                    i++;
                    setImmediate(writeXMPfile);
                } else {
                    if (callback) callback();
                }
            }
            writeXMPfile();
        } else {
            console.log("clips.writeXMPs: ", err);
            if (callback) callback(err);
        }
    });
}

module.exports = clips;
