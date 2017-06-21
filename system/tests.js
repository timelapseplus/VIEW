var exec = require("child_process").exec

var tests = [
	{
		description: "i2c-2 bus",
		command: "i2cdetect -y 2",
		output: "0  1  2  3  4  5  6  7  8  9  a  b  c  d  e  f\
00:          -- -- -- -- -- -- -- -- -- -- -- -- -- \
10: -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- \
20: -- -- -- -- -- -- -- -- -- 29 -- -- -- -- -- -- \
30: -- -- -- -- -- -- -- -- -- 39 -- -- -- -- -- -- \
40: -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- \
50: -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- \
60: -- -- -- -- -- -- -- -- 68 -- -- -- -- -- -- -- \
70: -- -- -- -- -- -- -- --"
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
		if(stdout.trim() == test.output) {
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
			if(results[0].indexOf(": PASSED")) {
				exec("echo 1 > /sys/class/leds/view-button-1/brightness");
			}
			if(results[1].indexOf(": PASSED")) {
				exec("echo 1 > /sys/class/leds/view-button-2/brightness");
			}
			if(results[1].indexOf(": PASSED")) {
				exec("echo 1 > /sys/class/leds/view-button-2/brightness");
			}
		}
		results = "";
		results += "Test results: " + (pass ? "PASSED" : "FAILED") + "\n\n";
		for(var i = 0; i < results.length; i++) {
			results += results[i] + "\n";
		}
		results += "\nTo run tests again manually, run: \"node /root/VIEW/system/tests.js\"\n";
		if(callback) {
			callback(results);
		} else {
			console.log(results);
		}
	}

	function run() {
		runTest(testArray[index], function(err, stdout, stderr) {
			if(err) {
				pass = false;
				results[index] = testArray[index].description + ": FAILED (err " + err + ", [" + stdout + "], [" + stderr + "])";
			} else {
				results[index] = testArray[index].description + ": PASSED";
			}
			console.log("(pre) ", results[index]);
			index++;
			if(index < testArray.length) {
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
});

