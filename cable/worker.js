'use strict';

// The cable release's own process: it only times the frames and toggles the two jack lines, so the UI's
// event loop (OLED redraws, Wi-Fi polls, WebSocket) cannot delay a shot. Started by cable/cable-release.js:
//   nice -n -10 node cable/worker.js
// Commands come as JSON lines on stdin, events go out as JSON lines on stdout:
//   {"cmd":"start","port":"AUX1","intervalMs":500,"releaseMs":200,"prefocusMs":0,"holdFocus":false,
//    "wakeUp":false,"frames":0,"delayMs":2000}   -> {"ev":"started"} then
//                                                   {"ev":"frame","n":1,"t":2000,"late":0.3,"skipped":0,"intervalMs":500} ...
//    (optional "ramp":{"toMs":16000,"overMs":60000,"afterMs":600000}: a ramp planned from the start)
//   {"cmd":"ramp","toMs":16000,"overMs":60000}   -> {"ev":"ramp","reason":"set","intervalMs":5000,"ramp":{...}} or
//                                                   {"ev":"ramp","error":"..."}; overMs 0 = at once
//   {"cmd":"rampStop"}                           -> {"ev":"ramp","reason":"stop","intervalMs":9800,"ramp":null}
//   (a ramp that has run its course)             -> {"ev":"ramp","reason":"done","intervalMs":16000,"ramp":null}
//   {"cmd":"stop"}                               -> {"ev":"done","reason":"stopped","frames":12}
//   {"cmd":"pulse","port":"AUX1","ms":1000}      -> {"ev":"pulse"}
//   {"cmd":"release"}, {"cmd":"quit"}
// Whatever ends this process (stop, quit, EOF on stdin because the UI died, SIGTERM from killall node, an
// exception) releases the lines first: an exported GPIO keeps its last level after the process is gone, and a
// shutter line left closed would hold the camera's button down.

var gpio = require('./gpio.js');
var createScheduler = require('./scheduler.js');

// CABLE_GPIO_BASE=/tmp/fakegpio (with gpioNNN/direction and /value files made beforehand) runs the whole thing
// against plain files instead of /sys/class/gpio — a dry run on the unit without touching the jacks.
var gpioOpts = process.env.CABLE_GPIO_BASE ? {base: process.env.CABLE_GPIO_BASE} : {};

var lines = null;   // {shutter: Line, focus: Line}
var exiting = false;

function now() {
    var t = process.hrtime();
    return t[0] * 1e3 + t[1] / 1e6;
}

function send(ev, cb) {
    process.stdout.write(JSON.stringify(ev) + '\n', cb);
}

function rampEvent(reason, state) {
    var r = state.ramp;
    return {
        ev: 'ramp',
        reason: reason,
        intervalMs: Math.round(state.intervalMs),
        ramp: r ? {fromMs: Math.round(r.fromMs), toMs: r.toMs, overMs: r.overMs, elapsedMs: Math.round(r.elapsedMs)} : null
    };
}

function releaseAll() {
    if (!lines) return;
    lines.shutter.release();
    lines.focus.release();
    lines = null;
}

function openPort(name) {
    var port = gpio.PORTS[name];
    if (!port) throw new Error('unknown port ' + name);
    releaseAll();
    lines = {shutter: new gpio.Line(port.shutter, gpioOpts), focus: new gpio.Line(port.focus, gpioOpts)};
    lines.focus.open();
    lines.shutter.open();
}

var sched = createScheduler({
    now: now,
    lines: {
        shutter: function (closed) {
            lines.shutter.set(closed);
        },
        focus: function (closed) {
            lines.focus.set(closed);
        }
    },
    onFrame: function (n, info) {
        send({ev: 'frame', n: n, t: Math.round(info.t), late: Math.round(info.late * 10) / 10, skipped: info.skipped, intervalMs: Math.round(info.intervalMs)});
    },
    onDone: function (reason, frames) {
        releaseAll();
        send({ev: 'done', reason: reason, frames: frames});
    },
    onRamp: function (state) {
        send(rampEvent('done', state));
    }
});

function shutdown(code) {
    if (exiting) return;
    exiting = true;
    try {
        sched.stop();
    } catch (e) {}
    releaseAll();
    var done = false;
    var exit = function () {
        if (done) return;
        done = true;
        process.exit(code || 0);
    };
    send({ev: 'exit'}, exit);
    setTimeout(exit, 200); // in case stdout is already gone
}

function handle(cmd) {
    switch (cmd.cmd) {
        case 'start':
            if (sched.running()) return send({ev: 'error', message: 'already running'});
            openPort(cmd.port || 'AUX1');
            var err = sched.start(cmd);
            if (err) {
                releaseAll();
                return send({ev: 'error', message: err});
            }
            send({ev: 'started', t0: Math.round(now())});
            break;
        case 'stop':
            if (sched.running()) sched.stop(); // onDone sends the event
            else send({ev: 'done', reason: 'stopped', frames: 0});
            break;
        case 'ramp':
        case 'rampStop':
            var rampErr = cmd.cmd == 'ramp' ? sched.rampTo(cmd.toMs, cmd.overMs) : sched.stopRamp();
            if (rampErr) return send({ev: 'ramp', error: rampErr});
            send(rampEvent(cmd.cmd == 'ramp' ? 'set' : 'stop', sched.state()));
            break;
        case 'pulse':
            if (sched.running()) return send({ev: 'error', message: 'running'});
            openPort(cmd.port || 'AUX1');
            sched.pulse(cmd.ms || 1000, function () {
                releaseAll();
                send({ev: 'pulse'});
            });
            break;
        case 'release':
            if (sched.running()) sched.stop();
            releaseAll();
            send({ev: 'released'});
            break;
        case 'quit':
            shutdown(0);
            break;
        default:
            send({ev: 'error', message: 'unknown command ' + cmd.cmd});
    }
}

var buffer = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', function (chunk) {
    buffer += chunk;
    var i;
    while ((i = buffer.indexOf('\n')) >= 0) {
        var line = buffer.slice(0, i).trim();
        buffer = buffer.slice(i + 1);
        if (!line) continue;
        var cmd;
        try {
            cmd = JSON.parse(line);
        } catch (e) {
            send({ev: 'error', message: 'bad command: ' + line});
            continue;
        }
        try {
            handle(cmd);
        } catch (e) {
            releaseAll();
            send({ev: 'error', message: String(e && e.message || e)});
        }
    }
});
process.stdin.on('end', function () {
    shutdown(0);
});
process.stdin.on('error', function () {
    shutdown(0);
});
process.stdin.resume();

['SIGTERM', 'SIGINT', 'SIGHUP'].forEach(function (sig) {
    process.on(sig, function () {
        shutdown(0);
    });
});
process.on('uncaughtException', function (e) {
    try {
        send({ev: 'error', message: 'crash: ' + (e && e.stack || e)});
    } catch (e2) {}
    shutdown(1);
});

send({ev: 'ready', pid: process.pid});
