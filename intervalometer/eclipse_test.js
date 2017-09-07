var eclipse = require('./eclipse.js');
//var suncalc = require('suncalc');

var inputs = {};

//inputs.eclipse_index = 39; 39 = Aug 21 2017, found in eclipse.list.  If not provided, the next upcoming eclipse will be selected.

inputs.lat = 43.60824;
inputs.lon = -110.68726;

//inputs.latd = 43;
//inputs.latm = 27.10967;
//inputs.latx = 1; // N = 1, S = -1
//inputs.lond = 110;
//inputs.lonm = 3.7655;
//inputs.lonx = 1; // W = 1, E = -1

inputs.alt = 600; // altitude in meters

//console.log(eclipse.list);

eclipse.calculate(inputs, function(err, result) {
	console.log(err, result);
	//var sunPos = suncalc.getPosition(new Date(result.c1_timestamp), result.lat, result.lon);

	//console.log(sunPos.altitude * (180 / Math.PI), sunPos.azimuth * (180 / Math.PI) + 180);
});
