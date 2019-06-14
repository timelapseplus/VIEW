
var requiredMethods = [
	'set',
	'init',
	'capture',
	'captureHDR',
	'liveviewMode',
	'liveviewImage',
	'moveFocus',
	'_event',
	'_error'
]

var requiredObjects = [
	'',
]


exports.driver = function(driver) {
	for(var i = 0; i < requiredMethods.length; i++) {
		if(typeof driver[requiredMethods[i]] != 'function') console.log("DRIVER TEST: missing " + requiredMethods[i] + " method");
	}
}