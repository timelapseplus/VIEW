var fs = require('fs');
var exec = require('child_process').exec;

var baseInstallPath = "/home/view/";
var current = fs.readlinkSync(baseInstallPath + 'current');
current = current.match(/[^\/]+$/)[0];

cleanup();

function checkInstall() {
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
		var installZip = '/media/' + versions[0].replace('v', 'VIEW-');
		console.log("installing", installZip);
	}
}

checkInstall();

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

