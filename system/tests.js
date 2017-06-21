var exec = require("child_process").exec
var Button = require('gpio-button');

var tests = [
	{
		description: "i2c-2 bus",
		command: "i2cdetect -y 2",
		output: function(stdout) {
			var messages = [];
			var passed = true;
			if(stdout && stdout.indexOf("29") === -1) {
				passed = false;
				messages.push("Light Sensor");
			}
			if(stdout && stdout.indexOf("39") === -1) {
				passed = false;
				messages.push("Gesture Sensor");
			}
			if(stdout && stdout.indexOf("68") === -1) {
				passed = false;
				messages.push("IMU");
			}
			var res = {err: !passed, message: messages.join(",")};
			//console.log(res);
			return res;
		}
	},
	{
		description: "wifi module",
		command: "lsusb | grep 0bda:b720",
		output: "Bus 003 Device 002: ID 0bda:b720 Realtek Semiconductor Corp."
	},
	{
		description: "ddr3",
		command: "cat /proc/meminfo | grep MemTotal",
		output: "MemTotal:         512032 kB"
	},
]


function runTest(test, callback) {
	exec(test.command, function(err, stdout, stderr) {
		if(typeof(test.output) == "function") {
			var res = test.output(stdout, stderr);
			return callback && callback(res.pass, res.message);
		} else if(stdout.trim() == test.output) {
			return callback && callback();
		} else {
			return callback(err || -1, stdout, stderr)
		}
	});
}

function runTests(testArray, callback) {
	var results = [];
	var index = 0;
	var pass = true;

	exec("echo 0 > /sys/class/leds/view-button-1/brightness");
	exec("echo 0 > /sys/class/leds/view-button-2/brightness");
	exec("echo 0 > /sys/class/leds/view-button-3/brightness");
	powerLight = true;
	var powerButtonInterval = setInterval(function(){
		if(powerLight) {
			powerLight = false;
			exec("echo 0 > /sys/class/leds/view-button-power/brightness");
		} else {
			powerLight = true;
			exec("echo 1 > /sys/class/leds/view-button-power/brightness");
		}
	}, 1000);

	function done() {
		clearInterval(powerButtonInterval);
		exec("echo 0 > /sys/class/leds/view-button-power/brightness");
		if(pass) {
			exec("echo 1 > /sys/class/leds/view-button-1/brightness");
			exec("echo 1 > /sys/class/leds/view-button-2/brightness");
			exec("echo 1 > /sys/class/leds/view-button-3/brightness");
		} else {
			if(results[0].indexOf(": PASSED") > 0) {
				exec("echo 1 > /sys/class/leds/view-button-1/brightness");
			}
			if(results[1].indexOf(": PASSED") > 0) {
				exec("echo 1 > /sys/class/leds/view-button-2/brightness");
			}
			if(results[2].indexOf(": PASSED") > 0) {
				exec("echo 1 > /sys/class/leds/view-button-3/brightness");
			}
		}
		var text = "";
		text += "Test results: " + (pass ? "PASSED" : "FAILED") + "\n\n";
		for(var i = 0; i < results.length; i++) {
			text += results[i] + "\n";
		}
		text += "\nTo run tests again manually, run: \"node /root/VIEW/system/tests.js\"\n";
		//console.log("done!");
		if(callback) {
			callback(text);
		} else {
			console.log(text);
		}
	}

	function run() {
		runTest(testArray[index], function(err, stdout, stderr) {
			if(err) {
				pass = false;
				results.push(testArray[index].description + ": FAILED (err " + err + ", [" + stdout + "], [" + stderr + "])");
			} else {
				results.push(testArray[index].description + ": PASSED");
			}
			//console.log("(pre) ", results[index]);
			index++;
			if(index < testArray.length) {
				//console.log("running next index:", index);
				run();
			} else {
				done();
			}
		});
	}
	run();
}

runTests(tests, function(results) {
	console.log(results)
	console.log("\n\nCtrl-C to exit, or press power button to shutdown...");
	var powerButton = new Button("1c2ac00.i2c-platform-axp20x-pek");
	powerButton.on('press', function(code) {
		console.log("power button pressed! shutting down...");
		exec("init 0 &", function(){
			process.exit();
		});
	});
});
