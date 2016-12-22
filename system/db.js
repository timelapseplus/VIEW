var ns = require('node-serialize');
var sqlite3 = require('sqlite3');
var dbSys = new sqlite3.Database('/var/local/sqlite/view-system.db');
var dbTl = new sqlite3.Database('/var/local/sqlite/view-timelapse.db');
var dbCache = new sqlite3.Database('/tmp/view-cache.db');
var fs = require('fs');
var exec = require('child_process').exec;

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
													 thumbnail TEXT,\
													 frames INTEGER\
													 )");
	dbTl.run("CREATE INDEX IF NOT EXISTS name ON clips (name)");

	dbTl.run("CREATE TABLE IF NOT EXISTS clip_frames (id INTEGER PRIMARY KEY AUTOINCREMENT,\
													 clip_id INTEGER,\
													 ev_correction REAL,\
													 details BLOB,\
													 thumbnail TEXT\
													 )");
	dbTl.run("CREATE INDEX IF NOT EXISTS clip_id ON clip_frames (clip_id)");
});

dbCache.serialize(function(){
	dbCache.run("CREATE TABLE IF NOT EXISTS cache (name TEXT PRIMARY KEY, value BLOB)");
});

var currentLog = fs.readFileSync("/home/view/current/logs/current.txt", {encoding:'utf8'});
if(currentLog) {
	exports.currentLogFile = "/home/view/current/" + currentLog.trim();
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
		if(data && data.hasOwnProperty('data')) return data.data;
		return false;
	} catch(e) {
		console.log("error unserializing object", e);
		return false;
	}
}

exports.setCache = function(key, object, callback) {
	var data = serialize(object);
	dbCache.run("INSERT OR REPLACE INTO cache (name, value) VALUES ('" + key + "', '" + data + "')", callback);
}

exports.getCache = function(key, callback) {
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
	var data = serialize(object);
	dbSys.run("INSERT OR REPLACE INTO settings (name, value) VALUES ('" + key + "', '" + data + "')", callback);
}

exports.get = function(key, callback) {
	dbSys.get("SELECT value FROM settings WHERE name = '" + key + "' LIMIT 1", function(err, data){
		if(err || !data || !data.value) {
			callback(err);
		} else {
			var object = unserialize(data.value);
			callback(err, object);
		}
	});
}

exports.setTimelapse = function(name, program, status, callback) {
	var date = (new Date()).toISOString();
	program = serialize(program);
	status = serialize(status);
	logfile = exports.currentLogFile;

	dbTl.run("INSERT INTO clips (name, date, program, status, logfile) VALUES ('" + name + "', '" + date + "', '" + program + "', '" + status + "', '" + logfile + "')", function(err) {
		callback && callback(err, this.lastID);
	});
}

exports.getTimelapse = function(id, callback) {
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

exports.setTimelapseFrame = function(clipId, evCorrection, details, thumbnail, callback) {
	var date = (new Date()).toISOString();
	details = serialize(details);
	evCorrection = evCorrection || 0;

	dbTl.get("SELECT frames, thumbnail FROM clips WHERE id = '" + clipId + "' LIMIT 1", function(err, data){
		if(err || !data) {
			callback(err);
		} else {
			var frames = 0;
			if(data.frames) frames = parseInt(data.frames);
			frames++;
			if(!data.thumbnail) {
				dbTl.run("UPDATE clips SET `frames` = '" + frames.toString() + "', `thumbnail` = '" + thumbnail + "'");
			} else {
				dbTl.run("UPDATE clips SET `frames` = '" + frames.toString() + "'");
			}
			dbTl.run("INSERT INTO clip_frames (clip_id, ev_correction, details, thumbnail) VALUES ('" + clipId.toString() + "', '" + evCorrection.toString() + "', '" + details + "', '" + thumbnail + "')", callback);
		}
	});
}

exports.getTimelapseList = function(limit, offset, callback) {
	limit = parseInt(limit);
	if(!limit) limit = 15;
	offset = parseInt(offset);
	if(!offset) offset = 0;

	dbTl.get("SELECT * FROM clips ORDER BY date DESC LIMIT " + limit + "," + offset, function(err, data){
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
	var data = serialize(password);
	dbSys.run("INSERT OR REPLACE INTO wifi (address, password) VALUES ('" + address + "', '" + data + "')", callback);
}

exports.getWifi = function(address, callback) {
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
	dbSys.close(callback);
	dbTl.close();
	dbCache.close();
}

exports.sendLog = function(clipName, callback) {
	if(clipName) {
		//todo
	} else {
		if(exports.currentLogFile) {
			var matches = exports.currentLogFile.match(/([^\/]+)$/);
			if(matches && matches.length > 1) {
				var logName = matches[1];
				var cmd = "mkdir -p /home/view/logsForUpload && /bin/bzip2 -c9 " + exports.currentLogFile + " > /home/view/logsForUpload/" + logName + ".bz2";
				exec(cmd, function(err) {
					console.log("created log for uploading: " + logName, err);
					callback && callback(err);
				});
			}
		}
	}
}


