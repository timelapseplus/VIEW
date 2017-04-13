var exec = require('child_process').exec;
var processes = {};

function kill(pid) {
	delete(processes[pid])
	console.log("WATCHDOG: sending kill signal to", pid);
	exec('kill ' + pid);
	setTimeout(function(){
		exec('kill -s 9 ' + pid);
	}, 2000);
}

function timer(pid, timeout) {
	return setTimeout(function(){
		kill(pid);
	}, timeout);
}

exports.watch = function(pid, timeout) {
	if(processes[pid]) {
		clearTimeout(processes[pid].timer);
		processes[pid].timer = timer(pid, timeout || processes[pid].timeout);
	} else {
		timeout = timeout || 10000;
		processes[pid] = {
			timeout: timeout,
			timer: timer(pid, timeout)
		}
	}
}
