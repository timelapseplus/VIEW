var fs = require('fs');
var child_process = require('child_process');
var spawn = child_process.spawn;
var exec = child_process.exec;

var baseInstallPath = "/home/view/";
var current = fs.readlinkSync(baseInstallPath + 'current');
current = current.match(/[^\/]+$/)[0];

cleanup();

function doInstall() {
	var sdContents = fs.readdirSync("/media/");
	console.log('sdContents', sdContents);
	var versions = sdContents.filter(function(item){
		return item.match(/^VIEW-[0-9]+\.[0-9]+(-beta)?[0-9.]*(-beta)?\.zip$/);
	});
	console.log('versions', versions);
	if(versions.length > 0) {
		versions = versions.map(function(item){
			return item.replace('VIEW-', 'v');
		});
		versions = sortInstalls(versions, true);
		var installVersion = versions[0];
		var installZip = '/media/' + installVersion.replace('v', 'VIEW-');
		console.log("installing", installZip);
		extract(installZip, baseInstallPath + installVersion, function(err, destFolder) {
			if(err) {
				console.log("extract failed");
				process.exit(1);
			} else {
				fs.writeFile(baseInstallPath + installVersion + "/version.json", JSON.stringify({version: installVersion}), function(){
					setVersion(installVersion, function(err){
						console.log("installation complete!");
						process.exit(0);
					});
				});
			}
		});
	}
}

doInstall();

function setVersion(versionName, callback) {
	var installs = fs.readdirSync(baseInstallPath);
	if(installs.indexOf('current') !== -1) {
		fs.unlinkSync(baseInstallPath + 'current');
	}
	fs.symlink(baseInstallPath + versionName, baseInstallPath + 'current', function(err) {
		callback && callback(err);
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

function cleanup() {
	try {
		var maxKeep = 5;
		var maxBeta = Math.floor(maxKeep / 2);

		var list = fs.readdirSync(baseInstallPath);
		var installs = list.filter(function(item){return item.match(/^v[0-9]+\.[0-9]+/)});

		if(installs.length > maxKeep) {
			var betaInstalls = sortInstalls(installs.filter(function(item){return item.match(/beta/)})).slice(0, maxBeta - 1);
			var stableInstalls = sortInstalls(installs.filter(function(item){return item.match(/^(?:(?!beta).)+$/)})).slice(0, maxKeep - 1);

			var keepInstalls = sortInstalls(stableInstalls.concat(betaInstalls)).slice(0, maxKeep - 1);

			var deleteInstalls = installs.filter(function(item){
				return keepInstalls.indexOf(item) === -1 && item != current;
			});

			if(deleteInstalls.length > 0) {
				for(var i = 0; i < deleteInstalls.length; i++) {
					if(deleteInstalls[i].length > 5) {
						var deleteCommand = "rm -rf " + baseInstallPath + deleteInstalls[i];
						console.log("UPDATES: cleaning up: ", deleteCommand);
						exec(deleteCommand);
					}
				}
			}
		}
	} catch(e) {
		console.log("UPDATES: error while cleaning up", e);
	}
}

function versionParse(item) {
	var numbers = item.split(/[\-.]/);
	if(numbers.length >= 3) {
		var n1 = 0, n2 = 0, n3 = 0, n4 = 0;
		n1 = parseInt(numbers[0].substr(1));
		n2 = parseInt(numbers[1]);
		bMatches = numbers[2].match(/(beta)?([0-9]+)/);
		if(bMatches[1]) {
			n3 = 0;
			if(bMatches[2]) {
				n4 = parseInt(bMatches[2]);
			}
		} else {
			n3 = parseInt(bMatches[2]);
			if(numbers[3]) {
				bMatches = numbers[3].match(/(beta)?([0-9]+)/);
				if(bMatches[1]) {
					if(bMatches[2]) {
						n4 = parseInt(bMatches[2]);
					}
				}
			} else {
				n4 = 0;
			}
		}
		//console.log("item = ", n1, n2, n3, n4);
		return [n1, n2, n3, n4]; 
	} else {
		return null;
	}
}

function sortInstalls(list, reverse){
	return list.sort(function(a, b) {
		var a = versionParse(a);
		var b = versionParse(b);
		if(a && b) {
			for(var i = 0; i < 4; i++) {
				if(a[i] > b[i]) return reverse ? -1 : 1;
				if(a[i] < b[i]) return reverse ? 1 : -1;
			}
			return 0;
		} else {
			if(a && !b) return reverse ? -1 : 1;
			if(!a && b) return reverse ? 1 : -1;
			return 0;
		}
	});
}

