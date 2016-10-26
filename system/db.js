var ns = require('node-serialize');
var sqlite3 = require('sqlite3');
var dbSys = new sqlite3.Database('/var/local/sqlite/view-system.db');
var dbTl = new sqlite3.Database('/var/local/sqlite/view-timelapse.db');
var dbCache = new sqlite3.Database('/tmp/view-cache.db');

dbSys.serialize(function(){
	dbSys.run("CREATE TABLE IF NOT EXISTS settings (name TEXT PRIMARY KEY, value BLOB)");
	dbSys.run("CREATE TABLE IF NOT EXISTS wifi (address TEXT PRIMARY KEY, password TEXT)");
});

dbTl.serialize(function(){
	dbTl.run("CREATE TABLE IF NOT EXISTS timelapse (id INTEGER PRIMARY KEY AUTOINCREMENT,\
													 date TEXT\
													 location TEXT\
													 direction TEXT\
													 settings BLOB\
													 )");

	dbTl.run("CREATE TABLE IF NOT EXISTS frames (id INTEGER PRIMARY KEY AUTOINCREMENT,\
													 timelapse_id INTEGER\
													 ev_correction REAL\
													 details BLOB\
													 thumbnail BLOB\
													 )");
	dbTl.run("CREATE INDEX IF NOT EXISTS tl_id ON frames (timelapse_id)");
});

dbCache.serialize(function(){
	dbCache.run("CREATE TABLE IF NOT EXISTS cache (name TEXT PRIMARY KEY, value BLOB)");
});

function serialize(object) {
	var data = {data: object};
	try {
		return ns.serialize(object).replace(/'/g, '`');
	} catch(e) {
		console.log("error serializing object", e);
		return "";
	}
}

function unserialize(string) {
	try {
		var data = ns.unserialize(string.replace(/`/g, "'"));
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