var ns = require('node-serialize');
var sqlite3 = require('sqlite3');
var dbSys = new sqlite3.Database('/var/local/sqlite/view-system.db');
var dbTl = new sqlite3.Database('/var/local/sqlite/view-timelapse.db');
var dbCache = new sqlite3.Database('/tmp/view-cache.db');
var fs = require('fs');
var exec = require('child_process').exec;

var closed = false;
dbSys.serialize(function(){
	dbSys.run("CREATE TABLE IF NOT EXISTS settings (name TEXT PRIMARY KEY, value BLOB)");
	dbSys.run("CREATE TABLE IF NOT EXISTS wifi (address TEXT PRIMARY KEY, password TEXT)");
});

dbTl.serialize(function(){
	dbTl.run("CREATE TABLE IF NOT EXISTS clips (id INTEGER PRIMARY KEY AUTOINCREMENT,\
													 name TEXT,\
													 date TEXT,\
													 program BLOB,\
													 status BLOB,\
													 logfile TEXT,\
													 cameras INTEGER DEFAULT 1,\
													 primary_camera INTEGER DEFAULT 1,\
													 thumbnail TEXT,\
													 frames INTEGER\
													 )");
	dbTl.run("CREATE INDEX IF NOT EXISTS name ON clips (name)");

	dbTl.run("CREATE TABLE IF NOT EXISTS clip_frames (id INTEGER PRIMARY KEY AUTOINCREMENT,\
													 clip_id INTEGER,\
													 ev_correction REAL,\
													 details BLOB,\
													 camera INTEGER DEFAULT 1,\
													 thumbnail TEXT\
													 )");
	dbTl.run("CREATE INDEX IF NOT EXISTS clip_id ON clip_frames (clip_id)");

	try {
		dbTl.run("ALTER TABLE clips ADD COLUMN primary_camera DEFAULT 1", function(err) {
			console.log("alter clips table:", err);
		});
		dbTl.run("ALTER TABLE clips ADD COLUMN cameras DEFAULT 1", function(err) {
			console.log("alter clips table:", err);
		});
		dbTl.run("ALTER TABLE clip_frames ADD COLUMN camera DEFAULT 1", function(err) {
			console.log("alter clip_frames table:", err);
		});
	} catch(e) {
		console.log("extra columns already added");
	}
});

dbCache.serialize(function(){
	dbCache.run("CREATE TABLE IF NOT EXISTS cache (name TEXT PRIMARY KEY, value BLOB)");
});

var currentLog = null;
try {
	currentLog = fs.readFileSync("/home/view/current/logs/current.txt", {encoding:'utf8'});
} catch(e) {
	currentLog = null;
}
if(currentLog) {
	var currentPath = fs.readlinkSync('/home/view/current');
	exports.currentLogFile = currentPath + "/" + currentLog.trim();
} else {
	exports.currentLogFile = "";
}

function serialize(object) {
	var data = {data: object};
	try {
		return ns.serialize(data).replace(/'/g, '`~`');
	} catch(e) {
		console.log("error serializing object", e);
		return "";
	}
}

function unserialize(string) {
	try {
		var data = ns.unserialize(string.replace(/`~`/g, "'"));
		if(data && data.hasOwnProperty('data')) {
			var res = data.data;
			for(var key in res) {
				if(res.hasOwnProperty(key) && typeof res[key] == 'object') { // recover arrays
				}
			}
		} else {
			return false;
		}
	} catch(e) {
		console.log("error unserializing object", e);
		return false;
	}
}

exports.setCache = function(key, object, callback) {
	if(closed) return callback && callback(true);
	var data = serialize(object);
	dbCache.run("INSERT OR REPLACE INTO cache (name, value) VALUES ('" + key + "', '" + data + "')", callback);
}

exports.getCache = function(key, callback) {
	if(closed) return callback && callback(true);
	dbCache.get("SELECT value FROM cache WHERE name = '" + key + "' LIMIT 1", function(err, data){
		if(err || !data || !data.value) {
			callback(err);
		} else {
			var object = unserialize(data.value);
			callback(err, object);
		}
	});
}

exports.set = function(key, object, callback) {
	if(closed) return callback && callback(true);
	var data = serialize(object);
	dbSys.run("INSERT OR REPLACE INTO settings (name, value) VALUES ('" + key + "', '" + data + "')", callback);
}

exports.get = function(key, callback) {
	if(closed) return callback && callback(true);
	dbSys.get("SELECT value FROM settings WHERE name = '" + key + "' LIMIT 1", function(err, data){
		if(err || !data || !data.value) {
			callback(err);
		} else {
			var object = unserialize(data.value);
			callback(err, object);
		}
	});
}

exports.setTimelapse = function(name, program, cameras, primaryCamera, status, callback) {
	if(closed) return callback && callback(true);
	var date = (new Date()).toISOString();
	name = name.toLowerCase();
	program = serialize(program);
	status = serialize(status);
	logfile = exports.currentLogFile;
	cameras = parseInt(cameras);
	cameras = cameras || 1;
	primaryCamera = parseInt(primaryCamera);
	primaryCamera = primaryCamera || 1;

	dbTl.run("INSERT INTO clips (name, date, program, cameras, primary_camera, status, logfile) VALUES ('" + name + "', '" + date + "', '" + program + "', '" + cameras + "', '" + primaryCamera + "', '" + status + "', '" + logfile + "')", function(err) {
		callback && callback(err, this.lastID);
	});
}

exports.getTimelapse = function(id, callback) {
	if(closed) return callback && callback(true);
	dbTl.get("SELECT * FROM clips WHERE id = '" + id + "' LIMIT 1", function(err, data){
		if(err || !data) {
			callback(err);
		} else {
			if(data.program) data.program = unserialize(data.program);
			if(data.status) data.status = unserialize(data.status);
			callback(err, data);
		}
	});
}

function deleteTimelapse(id, callback) {
	if(closed) return callback && callback(true);
	dbTl.get("SELECT * FROM clips WHERE id = '" + id + "' LIMIT 1", function(err, data){
		if(err || !data) {
			callback(err);
		} else {
			if(data.program) data.program = unserialize(data.program);
			if(data.status) data.status = unserialize(data.status);
			callback(err, data);
		}
	});
}

exports.deleteTimelapse = function(tlName, callback) {
	if(closed) return callback && callback(true);
	exports.getTimelapseByName(tlName, function(err, clip) {
		if(!err && clip) {
			dbTl.run("DELETE FROM clips WHERE id = '" + clip.id + "'", function(err) {
				if(err) console.log("error deleting clip:", err);
			});
			dbTl.run("DELETE FROM clip_frames WHERE clip_id = '" + clip.id + "'", function(err) {
				if(err) console.log("error deleting clip_frames:", err);
				if(callback) callback(err);
			});
		} else {
			if(callback) callback(err);
		}
	});
}

exports.getTimelapseByName = function(tlName, callback) {
	if(closed) return callback && callback(true);
	//console.log("db.getTimelapseByName: fetching " + tlName);
	dbTl.get("SELECT * FROM clips WHERE name = '" + tlName.toLowerCase() + "'", function(err, data){
		if(err || !data) {
			callback(err);
		} else {
			if(data.program) data.program = unserialize(data.program);
			if(data.status) data.status = unserialize(data.status);
			callback(err, data);
		}
	});
}

exports.getTimelapseFrames = function(tlId, cameraNumber, callback) {
	if(closed) return callback && callback(true);
	if(!cameraNumber) cameraNumber = 1;
	console.log("query= SELECT * FROM clip_frames WHERE clip_id = '" + tlId + "' AND camera = '" + cameraNumber + "'");
	dbTl.all("SELECT * FROM clip_frames WHERE clip_id = '" + tlId + "' AND camera = '" + cameraNumber + "'", function(err, data){
		if(err || !data) {
			callback(err);
		} else {
			for(var i = 0; i < data.length; i++) {
				if(data[i].details) data[i].details = unserialize(data[i].details);
			}
			callback(err, data);
		}
	});
}

exports.setTimelapseFrame = function(clipId, evCorrection, details, cameraNumber, thumbnail, callback) {
	if(closed) return callback && callback(true);
	var date = (new Date()).toISOString();
	details = serialize(details);
	console.log("cameraNumber:", cameraNumber);
	evCorrection = evCorrection || 0;
	cameraNumber = parseInt(cameraNumber);
	cameraNumber = cameraNumber || 0;

	dbTl.get("SELECT frames, thumbnail, primary_camera FROM clips WHERE id = '" + clipId + "'", function(err, data){
		if(err || !data) {
			callback(err);
		} else {
			var frames = 0;
			if(data.frames) frames = parseInt(data.frames);
			frames++;
			if(!data.thumbnail && thumbnail && data.primary_camera == cameraNumber) {
				console.log("setting clip thumbnail to:", thumbnail);
				dbTl.run("UPDATE clips SET `frames` = '" + frames.toString() + "', `thumbnail` = '" + thumbnail + "' WHERE id = '" + clipId + "'");
			} else {
				dbTl.run("UPDATE clips SET `frames` = '" + frames.toString() + "' WHERE id = '" + clipId + "'");
			}
			console.log("FRAME clip:", clipId, "camera:", cameraNumber, "thumbnail:", thumbnail, " clip thumbnail:'" + data.thumbnail + "'");
			dbTl.run("INSERT INTO clip_frames (clip_id, ev_correction, details, camera, thumbnail) VALUES ('" + clipId.toString() + "', '" + evCorrection.toString() + "', '" + details + "', '" + cameraNumber.toString() + "', '" + thumbnail + "')", callback);
		}
	});
}

exports.getTimelapseList = function(limit, offset, callback) {
	if(closed) return callback && callback(true);
	limit = parseInt(limit);
	if(!limit) limit = 15;
	offset = parseInt(offset);
	if(!offset) offset = 0;

	dbTl.all("SELECT * FROM clips ORDER BY date DESC LIMIT " + limit + "," + offset, function(err, data){
		if(err || !data) {
			callback(err);
		} else {
			var clips = [];
			for(var i = 0; i < data.length; i++) {
				var clip = {};
				if(data[i].id) {
					clip.id = data[i].id;
					if(data[i].name) clip.name = data[i].name;
					if(data[i].date) clip.date = new Date(data[i].date);
					if(data[i].thumbnail) clip.date = data[i].thumbnail;
					clips.push(clip);
				}
			}
			callback(err, clips);
		}
	});
}

exports.setWifi = function(address, password, callback) {
	if(closed) return callback && callback(true);
	var data = serialize(password);
	dbSys.run("INSERT OR REPLACE INTO wifi (address, password) VALUES ('" + address + "', '" + data + "')", callback);
}

exports.getWifi = function(address, callback) {
	if(closed) return callback && callback(true);
	dbSys.get("SELECT password FROM wifi WHERE address = '" + address + "' LIMIT 1", function(err, data){
		if(err || !data || !data.password) {
			callback(err);
		} else {
			var password = unserialize(data.password);
			callback(err, password);
		}
	});
}

// WARNING! This erases all saved settings! //
exports.eraseAll = function() {
	if(closed) return callback && callback(true);
	dbSys.run("DELETE FROM wifi WHERE 1");
	dbSys.run("DELETE FROM settings WHERE 1");
}


var testObject = {
	int: 1,
	str: "testing",
	float: 22.1347775
}

exports.setCache('test', testObject, function() {
	exports.getCache('test', function(err, obj) {
		if(testObject.int === obj.int && testObject.str === obj.str && testObject.float === obj.float) {
			console.log("cache test result: PASSED");
		} else {
			console.log("cache test result: FAILED", err, obj);
		}

	});
});

exports.close = function(callback) {
	if(closed) return callback && callback(true);
	dbSys.close();
	dbTl.close();
	dbCache.close();
	closed = true;
	if(callback) setTimeout(callback, 1000);
}

function sendLog(logPath, tlName, reasonCode, callback) {
	if(logPath) {
		var matches = logPath.match(/([^\/]+)$/);
		if(matches && matches.length > 1) {
			if(!reasonCode) reasonCode = "000";
			var logName = matches[1].replace(/\.txt$/, "") + '-' + reasonCode;
			if(tlName) logName = tlName + "-" + logName;
			var cmd = "mkdir -p /home/view/logsForUpload && /usr/bin/tail -n 500000 " + logPath + " | /bin/bzip2 -c6 > /home/view/logsForUpload/" + logName + ".txt.bz2";
			exec(cmd, function(err) {
				if(err) {
					console.log("error compressing log: ", err);
					exec("rm /home/view/logsForUpload/" + logName + "*");
				}
				console.log("created log for uploading: " + logName, err);
				callback && callback(err);
			});
		} else {
			callback && callback(true);
		}
	} else {
		callback && callback(true);
	}
}

exports.sendLog = function(clipName, reasonCode, callback) {
	console.log("Preparing log to send", clipName);
	if(clipName) {
		exports.getTimelapseByName(clipName, function(err, clip) {
			console.log("clipInfo", clip, err);
			if(!err && clip && clip.logfile) {
				console.log("creating log for " + clipName + "...", clip.logfile);
				sendLog(clip.logfile, clipName, reasonCode, callback);
			} else {
				callback && callback(err || true);
			}
		});
	} else {
		sendLog(exports.currentLogFile, "", reasonCode, callback);
	}
}


