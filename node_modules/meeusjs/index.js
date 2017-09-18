var moment = require("moment");

var modules = [];

modules.push(require("./lib/Astro.Coord.js"));
modules.push(require("./lib/Astro.DeltaT.js"));
modules.push(require("./lib/Astro.Globe.js"));
modules.push(require("./lib/Astro.Interp.js"));
modules.push(require("./lib/Astro.JulianDay.js"));
modules.push(require("./lib/Astro.Math.js"));
modules.push(require("./lib/Astro.Moon.js"));
modules.push(require("./lib/Astro.MoonIllum.js"));
modules.push(require("./lib/Astro.Nutation.js"));
modules.push(require("./lib/Astro.Parallax.js"));
modules.push(require("./lib/Astro.Refraction.js"));
modules.push(require("./lib/Astro.Rise.js"));
modules.push(require("./lib/Astro.Sidereal.js"));
modules.push(require("./lib/Astro.Solar.js"));

// join all modules
for(var i = 0; i < modules.length; i++) {
	for(var key in modules[i]) {
		if(modules[i].hasOwnProperty(key)) {
			exports[key] = modules[i][key];
		}
	}
}

function convertTime(date, seconds) {
	return moment(date).utc().startOf('day').add(seconds, 'seconds').local();
}

exports.sunmoon = function(date, lat, lon, alt) {
	var coord = exports.EclCoord.fromWgs84(lat, lon, alt);

	var moonT = function(dateM, addDays) {
		if(!addDays) addDays = 0;
		dateM = moment(dateM).add(addDays, 'days').toDate();
		var jdoM = new exports.JulianDay(dateM); 
		var times = exports.Moon.approxTimes(jdoM, coord);
		times.rise = convertTime(dateM, times.rise);
		times.set = convertTime(dateM, times.set);
		times.transit = convertTime(dateM, times.transit);
		return times;
	}
	var sunT = function(dateM, addDays) {
		if(!addDays) addDays = 0;
		dateM = moment(dateM).add(addDays, 'days').toDate();
		var jdoM = new exports.JulianDay(dateM); 
		var times = exports.Solar.approxTimes(jdoM, coord);
		times.rise = convertTime(dateM, times.rise);
		times.set = convertTime(dateM, times.set);
		times.transit = convertTime(dateM, times.transit);
		return times;
	}


	var suntimes = sunT(date);
	if(!suntimes.rised && suntimes.rise < date) {
		//console.log("add day for sunrise");
		suntimes.rise = sunT(date, 1).rise;
	} else if(!suntimes.setd && suntimes.set < date) {
		//console.log("add day for sunset");
		suntimes.set = sunT(date, 1).set;
	}

	var moontimes = moonT(date);
	if(!moontimes.rised && moontimes.rise < date) {
		//console.log("add day for moonrise");
		moontimes.rise = moonT(date, 1).rise;
	} else if(!moontimes.setd && moontimes.set < date) {
		//console.log("add day for moonset");
		moontimes.set = moonT(date, 1).set;
	}

	var jdo = new exports.JulianDay(date); 

	var suntp = exports.Solar.topocentricPosition(jdo, coord, true);
	var moontp = exports.Moon.topocentricPosition(jdo, coord, true);
	
	var moonphase = exports.MoonIllum.phaseAngleEq2(moontp.eq, suntp.eq);
	var moonillum = exports.MoonIllum.illuminated(moonphase);
	
	return {
		suntimes: suntimes,
		moontimes: moontimes,
		sunpos: suntp.hz,
		moonpos: moontp.hz,
		mooninfo: {
			distance: moontp.delta,
			phase: moonphase,
			illumination: moonillum
		}
	}
}
