
var requiredMethods = [
	'set',
	'init',
	'capture',
	'liveviewMode',
	'liveviewImage',
	'_event',
	'_error'
]

var optionalMethods = [
	'af',
	'setFocusPoint',
	'captureHDR',
	'moveFocus',
	'lvZoom',
]

var requiredObjects = [
	'supportedCameras',
	'properties',
]

var requiredProperties = [
	'name',
]

var requiredExposureSettings = [
	{ name: 'shutter', values: [
	    { name: "30s",     ev: -11,         required: true },
	    { name: "25s",     ev: -10 - 2 / 3, required: true },
	    { name: "20s",     ev: -10 - 1 / 3, required: true },
	    { name: "15s",     ev: -10,         required: true },
	    { name: "13s",     ev: -9 - 2 / 3,  required: true },
	    { name: "10s",     ev: -9 - 1 / 3,  required: true },
	    { name: "8s",      ev: -9,          required: true },
	    { name: "6s",      ev: -8 - 2 / 3,  required: true },
	    { name: "5s",      ev: -8 - 1 / 3,  required: true },
	    { name: "4s",      ev: -8,          required: true },
	    { name: "3s",      ev: -7 - 2 / 3,  required: true },
	    { name: "2.5s",    ev: -7 - 1 / 3,  required: true },
	    { name: "2s",      ev: -7,          required: true },
	    { name: "1.6s",    ev: -6 - 2 / 3,  required: true },
	    { name: "1.3s",    ev: -6 - 1 / 3,  required: true },
	    { name: "1s",      ev: -6,          required: true },
	    { name: "0.8s",    ev: -5 - 2 / 3,  required: true },
	    { name: "0.6s",    ev: -5 - 1 / 3,  required: true },
	    { name: "1/2",     ev: -5,          required: true },
	    { name: "0.4s",    ev: -4 - 2 / 3,  required: true },
	    { name: "1/3",     ev: -4 - 1 / 3,  required: true },
	    { name: "1/4",     ev: -4,          required: true },
	    { name: "1/5",     ev: -3 - 2 / 3,  required: true },
	    { name: "1/6",     ev: -3 - 1 / 3,  required: true },
	    { name: "1/8",     ev: -3,          required: true },
	    { name: "1/10",    ev: -2 - 2 / 3,  required: true },
	    { name: "1/13",    ev: -2 - 1 / 3,  required: true },
	    { name: "1/15",    ev: -2,          required: true },
	    { name: "1/20",    ev: -1 - 2 / 3,  required: true },
	    { name: "1/25",    ev: -1 - 1 / 3,  required: true },
	    { name: "1/30",    ev: -1,          required: true },
	    { name: "1/40",    ev: 0 - 2 / 3,   required: true },
	    { name: "1/50",    ev: 0 - 1 / 3,   required: true },
	    { name: "1/60",    ev: 0,           required: true },
	    { name: "1/80",    ev: 0 + 1 / 3,   required: true },
	    { name: "1/100",   ev: 0 + 2 / 3,   required: true },
	    { name: "1/125",   ev: 1,           required: true },
	    { name: "1/160",   ev: 1 + 1 / 3,   required: true },
	    { name: "1/200",   ev: 1 + 2 / 3,   required: true },
	    { name: "1/250",   ev: 2,           required: true },
	    { name: "1/320",   ev: 2 + 1 / 3,   required: true },
	    { name: "1/400",   ev: 2 + 2 / 3,   required: true },
	    { name: "1/500",   ev: 3,           required: true },
	    { name: "1/640",   ev: 3 + 1 / 3,   required: true },
	    { name: "1/800",   ev: 3 + 2 / 3,   required: true },
	    { name: "1/1000",  ev: 4,           required: true },
	    { name: "1/1250",  ev: 4 + 1 / 3,   required: true },
	    { name: "1/1600",  ev: 4 + 2 / 3,   required: true },
	    { name: "1/2000",  ev: 5,           required: true },
	]},
	{ name: 'iso', values: [
	    { name: "200",      ev: -1,         required: true },
	    { name: "250",      ev: -1 - 1 / 3, required: true },
	    { name: "320",      ev: -1 - 2 / 3, required: true },
	    { name: "400",      ev: -2,         required: true },
	    { name: "500",      ev: -2 - 1 / 3, required: true },
	    { name: "640",      ev: -2 - 2 / 3, required: true },
	    { name: "800",      ev: -3,         required: true },
	    { name: "1000",     ev: -3 - 1 / 3, required: true },
	    { name: "1250",     ev: -3 - 2 / 3, required: true },
	    { name: "1600",     ev: -4,         required: true },
	    { name: "2000",     ev: -4 - 1 / 3, required: true },
	    { name: "2500",     ev: -4 - 2 / 3, required: true },
	    { name: "3200",     ev: -5,         required: true },
	]},
	{ name: 'aperture', values: [
	    { name: "1.8",      ev: -6 - 1 / 3, required: true },
	    { name: "2.0",      ev: -6,         required: true },
	    { name: "2.2",      ev: -5 - 2 / 3, required: true },
	    { name: "2.5",      ev: -5 - 1 / 3, required: true },
	    { name: "2.8",      ev: -5,         required: true },
	    { name: "3.2",      ev: -4 - 2 / 3, required: true },
	    { name: "3.5",      ev: -4 - 1 / 3, required: true },
	    { name: "3.6",      ev: -4 - 1 / 3, required: true },
	    { name: "4.0",      ev: -4,         required: true },
	    { name: "4.5",      ev: -3 - 2 / 3, required: true },
	    { name: "5.0",      ev: -3 - 1 / 3, required: true },
	    { name: "5.6",      ev: -3,         required: true },
	    { name: "6.3",      ev: -2 - 2 / 3, required: true },
	    { name: "6.3",      ev: -2 - 2 / 3, required: true },
	    { name: "7.1",      ev: -2 - 1 / 3, required: true },
	    { name: "8",        ev: -2,         required: true },
	    { name: "9",        ev: -1 - 2 / 3, required: true },
	    { name: "10",       ev: -1 - 1 / 3, required: true },
	    { name: "11",       ev: -1,         required: true },
	    { name: "13",       ev: -0 - 2 / 3, required: true },
	    { name: "14",       ev: -0 - 1 / 3, required: true },
	    { name: "16",       ev:  0,         required: true },
	    { name: "18",       ev:  0 + 1 / 3, required: true },
	    { name: "20",       ev:  0 + 2 / 3, required: true },
	    { name: "22",       ev:  1,         required: true },
	]}
]

exports.driver = function(driver) {
	var name = driver.name || "(missing name)";
	for(var i = 0; i < requiredMethods.length; i++) {
		if(typeof driver[requiredMethods[i]] != 'function') console.log("DRIVER TEST: missing required '" + requiredMethods[i] + "' method in driver", name);
	}

	for(var i = 0; i < optionalMethods.length; i++) {
		if(typeof driver[optionalMethods[i]] != 'function') console.log("DRIVER TEST: missing optional '" + optionalMethods[i] + "' method in driver", name);
	}

	for(var i = 0; i < requiredObjects.length; i++) {
		if(typeof driver[requiredObjects[i]] != 'object') console.log("DRIVER TEST: missing required '" + requiredObjects[i] + "' object in driver", name);
	}

	for(var i = 0; i < requiredProperties.length; i++) {
		if(driver[requiredProperties[i]] == null) console.log("DRIVER TEST: missing required '" + requiredProperties[i] + "' property in driver", name);
	}

	if(!driver.properties) return;

	for(var i = 0; i < requiredExposureSettings.length; i++) {
		if(typeof driver.properties[requiredExposureSettings[i].name] == 'object') {
			var setting = driver.properties[requiredExposureSettings[i].name];
			if(!setting.ev) console.log("DRIVER TEST: setting '" + requiredExposureSettings[i].name + "' should have ev flag set in driver", name);
			if(setting.category != "exposure") console.log("DRIVER TEST: setting '" + requiredExposureSettings[i].name + "' category must be 'exposure' in driver", name);
			if(Array.isArray(setting.values) && setting.values.length > 1) {
				for(j = 0; j < requiredExposureSettings[i].values.length; j++) {
					var testVal = requiredExposureSettings[i].values[j];
					var foundVal = null;
					for(var k = 0; k < setting.values.length; k++) {
						if(testVal.name == setting.values[k].name) {
							foundVal = setting.values[k];
							break;
						}
					}
					if(foundVal) {
						if(foundVal.ev != testVal.ev) {
							console.log("DRIVER TEST: setting '" + requiredExposureSettings[i].name + "' ev should be '" + testVal.ev + "' in driver", name);							
						}
					} else if(testVal.required) {
						console.log("DRIVER TEST: setting '" + requiredExposureSettings[i].name + "' missing value for '" + testVal.name + "' in driver", name);
					}
				}
			} else {
				console.log("DRIVER TEST: setting '" + requiredExposureSettings[i] + "' missing 'values' array in driver", name);
			}
		} else {
			console.log("DRIVER TEST: missing required '" + requiredExposureSettings[i] + "' exposure setting in driver", name);
		}
	}
}


