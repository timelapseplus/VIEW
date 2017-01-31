var https = require('https');
var fs = require('fs');
var url = require('url');
var child_process = require('child_process');
var spawn = child_process.spawn;
var exec = child_process.exec;

var apiHost = "api.github.com";
var apiEndpoint = "/repos/timelapseplus/VIEW/";
var baseInstallPath = "/home/view/";

var kernelVersion = "#51 PREEMPT Thu Jan 5 13:15:18 EST 2017";
var uBootVersion = "U-Boot SPL 2016.01 TL+ VIEW -00446-g12f229e-dirty (Dec 23 2016 - 17:47:10)";

var libgphoto2Version = "2.5.12.1";

var getLibGPhoto2Version = "/usr/local/bin/gphoto2 --version | grep \"libgphoto2 \"";
var installLibGPhoto2 = "/usr/bin/test -e /home/view/current/lib/libgphoto2_2.5.12-2-1_armhf.deb && dpkg -i /home/view/current/lib/libgphoto2_2.5.12-2-1_armhf.deb";

var getKernelVersion = "uname -v";
var doKernelUpdate = "/usr/bin/test -e /home/view/current/boot/zImage && /usr/bin/test -e /home/view/current/boot/sun5i-a13-timelapseplus-view.dtb && mount /dev/mmcblk0p1 /boot && cp /home/view/current/boot/zImage /boot/ && cp /home/view/current/boot/sun5i-a13-timelapseplus-view.dtb /boot/ && /bin/sync && umount /boot";

var getUBootVersion = "/bin/dd if=/dev/mmcblk0 bs=1024 count=32 | /usr/bin/strings | /bin/grep \"U-Boot SPL\"";
var doUBootUpdate = "/usr/bin/test -e /home/view/current/boot/u-boot-sunxi-with-spl.bin && /bin/dd if=/home/view/current/boot/u-boot-sunxi-with-spl.bin of=/dev/mmcblk0 bs=1024 seek=8";

var installIcons = "/usr/bin/test -e /home/view/current/fonts/icons.ttf && cp -u /home/view/current/fonts/icons.ttf /usr/share/fonts/truetype/";

function checkLibGPhotoUpdate(callback) {
	exec(getLibGPhoto2Version, function(err, stdout, stderr) {
		if(!err && stdout) {
			var parts = stdout.match(/([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+)/);
			if(parts && parts.length > 1 ) {
				var version = parts[1].trim();
				exports.libgphoto2Version = version;
				if(version != libgphoto2Version) {
					console.log("libgphoto2 update required (current version = " + version + ")");
					callback(null, true);
				} else {
					console.log("libgphoto2 is up to date");
					callback(null, false);
				}
			} else {
				callback("error getting version");
			}
		} else {
			callback("error getting version");
		}
	});
}

function installLibGPhoto(callback) {
	exports.updatingLibGphoto = true;
	exec(installLibGPhoto2, function(err) {
		exports.updatingLibGphoto = false;
		callback(err);
	});
}

function apiRequest(method, callback) {
	var req = https.request({method:'get', host:apiHost, path: apiEndpoint+method, headers: {'user-agent': 'VIEW-app'}}, function(res) {
		//console.log(`STATUS: ${res.statusCode}`);
		//console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
		res.setEncoding('utf8');
		var data = "";
		res.on('data', function(chunk) {
			data += chunk;
			//console.log(`BODY: ${chunk}`);
		});
		res.on('end', function() {
			var doc = JSON.parse(data);
			//console.log(doc);
			if(callback) callback(null, doc);
		});

	});
	req.end();
	req.on('error', function(err) {
		if(callback) callback(err);
	});
}

function download(href, path, callback) {
	var options = url.parse(href);
	options.headers = {'user-agent': 'VIEW-app'};
	options.method = "GET";
	//options.auth = username+':'+accessToken;

	var req = https.get(options, function(res) {
		//console.log(`STATUS: ${res.statusCode}`);
		//console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
		if(res.statusCode == 302 && res.headers.location) {
			download(res.headers.location, path, callback);
			return;
		}
		var fd = fs.openSync(path, 'w');
		if(!fd) callback("error creating " + path);
		res.on('data', function(chunk) {
			var bytes = 0;
			if(fd) bytes = fs.writeSync(fd, chunk, 0, chunk.length);
			//console.log("Writing " + bytes + " bytes to file ", fd, chunk.length);
		});
		res.on('end', function() {
			if(fd) {
				fs.closeSync(fd);
				callback(null, path);
			}
		});

	});
	req.end();
	req.on('error', function(err) {
		callback(err);
	});
}

function extract(zipPath, destFolder, callback) {
	var unzip = spawn('unzip', ['-q', zipPath, '-d', destFolder + '_zip_extract']);
	console.log("extracting...");
	unzip.once('close', function(code) {
		fs.readdir(destFolder + '_zip_extract', function(err, files) {
			console.log(err, files);
			if(files && files.length > 0) {
				fs.rename(destFolder + '_zip_extract' + '/' + files[0], destFolder, function(){
					fs.rmdir(destFolder + '_zip_extract');
					console.log("done extracting");
					callback(err, destFolder);
				});
			} else {
				callback(err, destFolder);
			}
		});
	});
}

function checkKernel(callback) {
	exec(getKernelVersion, function(err, stdout, stderr) {
		if(!err && stdout) {
			var currentKernel = stdout.trim();
			if(currentKernel == kernelVersion) {
				callback(null, false);
			} else {
				console.log("Current KERNEL:", currentKernel)
				callback(null, true);
			}
		} else {
			callback(err, false);
		}
	});
}

exports.updatingKernel = false;
function updateKernel(callback) {
	checkKernel(function(err1, needUpdate) {
		if(needUpdate) {
			console.log("KERNEL UPDATE REQUIRED");
			exports.updatingKernel = true;
			exec(doKernelUpdate, function(err, stdout, stderr) {
				exports.updatingKernel = false;
				if(err) {
					if(callback) callback(err);
					console.log("KERNEL UPDATE FAILED", err, stdout, stderr);
				} else {
					console.log("KERNEL UPDATE SUCCESS, running call back for reboot", err, stdout, stderr);
					if(callback) callback(false, true);
				}
			});
		} else {
			if(callback) callback(false);
			console.log("KERNEL UP TO DATE");
		}
	});
}

function checkUBoot(callback) {
	exec(getUBootVersion, function(err, stdout, stderr) {
		if(!err && stdout) {
			var currentUBoot = stdout.trim();
			if(currentUBoot == uBootVersion) {
				callback(null, false);
			} else {
				console.log("Current U-BOOT:", currentUBoot)
				callback(null, true);
			}
		} else {
			callback(err, false);
		}
	});
}

function updateUBoot(callback) {
	checkUBoot(function(err1, needUpdate) {
		if(needUpdate) {
			console.log("U-BOOT UPDATE REQUIRED");
			exec(doUBootUpdate, function(err, stdout, stderr) {
				if(err) {
					console.log("U-BOOT UPDATE FAILED", err, stdout, stderr);
				}
				if(callback) callback(err);
			});
		} else {
			if(callback) callback(false);
			console.log("U-BOOT UP TO DATE");
		}
	});
}

exports.version = "";
var installs = fs.readdirSync(baseInstallPath);
var current = "";
if(installs.indexOf('current') !== -1) {
	current = fs.readlinkSync(baseInstallPath + 'current');
	current = current.match(/[^\/]+$/)[0];
	console.log("current version:", current);
	exports.version = current;
}

exports.developerMode = false;
var cachedVersions = null;
exports.getVersions = function(callback){
	if(cachedVersions) {
		callback(null, cachedVersions);
	} else {
		apiRequest('releases', function(err, res) {
			if(!err && res) {
				var installs = fs.readdirSync(baseInstallPath);
				var current = "";
				console.log(installs);
				if(installs.indexOf('current') !== -1) {
					current = fs.readlinkSync(baseInstallPath + 'current');
					current = current.match(/[^\/]+$/)[0];
					console.log("current version:", current);
				}
				var list = [];
				for(var i = 0; i < res.length; i++) {
					if(!res[i].prerelease || exports.developerMode) list.push({
						version: res[i].tag_name,
						description: res[i].name,
						notes: res[i].body,
						url: res[i].zipball_url,
						pre: res[i].prerelease,
						date: res[i].published_at,
						installed: installs.indexOf(res[i].tag_name) !== -1,
						current: res[i].tag_name == current
					});
				}
				cachedVersions = list;
				setTimeout(function(){
					cachedVersions = null; // clear cache after 5 minutes
				}, 1000*60*5);
				callback(null, list);
			} else {
				callback(err);
			}
		});		
	}
};

exports.installing = false;
exports.installStatus = null;
exports.installVersion = function(versionInfo, callback, statusCallback) {
	exports.installing = true;
	var updateStatus = function(status) {
		console.log("INSTALL:", status);
		exports.installStatus = status;
		if(statusCallback) statusCallback(status);
	}
	if(versionInfo.version && versionInfo.url) {
		updateStatus('downloading...');
		download(versionInfo.url, baseInstallPath + "tmp.zip", function(err, info){
			if(err) {
				updateStatus('download failed.');
				exports.installing = false;
				callback(err);
			} else {
				updateStatus('extracting...');
				extract(baseInstallPath + "tmp.zip", baseInstallPath + versionInfo.version, function(err) {
					if(err) {
						updateStatus('extract failed.');
						exports.installing = false;
						callback(err);
					} else {
						fs.unlink(baseInstallPath + "tmp.zip");
						fs.writeFile(baseInstallPath + versionInfo.version + "/version.json", JSON.stringify(versionInfo), function(){
							updateStatus('done.');
							exports.installing = false;
							callback();
						});
					}
				});
			}
		});
	} else {
		callback("invalid version object");
	}
}

exports.setVersion = function(versionInfo, callback) {
	var installs = fs.readdirSync(baseInstallPath);
	console.log(installs);
	if(installs.indexOf('current') !== -1) {
		fs.unlinkSync(baseInstallPath + 'current');
	}
	fs.symlink(baseInstallPath + versionInfo.version, baseInstallPath + 'current', function(err) {
		callback && callback(err);
		console.log(err);
	});
} 

exports.installIcons = function(callback) {
	exec(installIcons, callback);
}

exports.download = download;
exports.extract = extract;
exports.apiRequest = apiRequest;

exports.checkLibGPhotoUpdate = checkLibGPhotoUpdate;
exports.installLibGPhoto = installLibGPhoto;

exports.updateKernel = updateKernel;
exports.updateUBoot = updateUBoot;

