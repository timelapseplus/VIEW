'use strict';

// Cable Release: the VIEW as a plain shutter-release intervalometer on an AUX jack — no camera on USB, no PTP,
// nothing shared with the intervalometer. This module lives in the UI process and owns the settings, the
// worker process (cable/worker.js, which does the timing and the GPIO) and the status the menus and the app
// show. Design and measurements: docs/2026-10-19-cable-release-research.md §7.

var EventEmitter = require('events').EventEmitter;
var child_process = require('child_process');
var fs = require('fs');
var path = require('path');
var scheduler = require('./scheduler.js');

var DB_KEY = 'cableRelease';
var WORKER = path.join(__dirname, 'worker.js');
var NICE = '/usr/bin/nice';
var STATUS_EVERY_MS = 500;      // how often a running cable release reports its status (the OLED and the app)
var LOG_EVERY_FRAMES = 100;     // one log line per this many frames: at 0.3 s a line per frame would be 3 a second
var STOP_TIMEOUT_MS = 500;      // how long a stop waits for the worker before SIGTERM, then SIGKILL after as long again

var DEFAULTS = {
    intervalS: 1,       // seconds between shots
    frames: 0,          // 0 = until stopped
    durationS: 0,       // 0 = until stopped; else the run lasts this long after the first shot, whatever frames fit, and `frames` is ignored
    releaseMs: 200,     // how long the shutter line stays closed
    prefocusMs: 0,      // focus line closes this long before the shutter (0 = together)
    holdFocus: false,   // keep the focus line closed between shots
    wakeUp: false,      // close the focus line 1 s before each shot to wake a sleeping camera
    delayS: 2,          // pause before the first shot
    port: 'AUX1'        // which jack the camera cable is in
};

var cable = new EventEmitter();
cable.settings = clone(DEFAULTS);
cable.status = idleStatus();

var db = null;
var spawn = child_process.spawn;
var log = console.log;
var worker = null;          // the running child process
var workerReady = false;
var pending = {};           // callbacks waiting for a worker event: started, done, pulse
var lastStatusAt = 0;
var loggedSkipped = 0;      // the skipped count in the last frame line logged

function clone(o) {
    return JSON.parse(JSON.stringify(o));
}

function idleStatus() {
    return {
        running: false,
        frames: 0,
        total: 0,
        durationMs: 0,
        startTime: 0,
        intervalMs: 0,
        lastFrameTime: 0,
        late: 0,
        skipped: 0,
        port: '',
        reason: ''
    };
}

// opts: {db, spawn, log} — the latter two are for the tests
cable.init = function (opts) {
    opts = opts || {};
    db = opts.db || db;
    if (opts.spawn) spawn = opts.spawn;
    if (opts.log) log = opts.log;
};

cable.load = function (cb) {
    if (!db) return cb && cb();
    db.get(DB_KEY, function (err, saved) {
        if (!err && saved && typeof saved == 'object') cable.update(saved);
        cb && cb(err);
    });
};

cable.save = function (cb) {
    if (!db) return cb && cb();
    db.set(DB_KEY, cable.settings, cb);
};

// Takes the known keys from obj (the app sends whatever it has), keeps everything else as it was.
cable.update = function (obj, cb) {
    if (obj && typeof obj == 'object') {
        for (var key in DEFAULTS) {
            if (!obj.hasOwnProperty(key) || obj[key] == null) continue;
            var v = obj[key];
            if (typeof DEFAULTS[key] == 'boolean') v = (v === true || v === 'true' || v === 'yes' || v === 1);
            else if (typeof DEFAULTS[key] == 'number') v = parseFloat(v);
            else v = String(v);
            if (typeof DEFAULTS[key] == 'number' && isNaN(v)) continue;
            cable.settings[key] = v;
        }
    }
    if (cb) cable.save(cb);
};

function workerConfig(s) {
    return {
        cmd: 'start',
        port: s.port,
        intervalMs: Math.round(s.intervalS * 1000),
        releaseMs: Math.round(s.releaseMs),
        prefocusMs: Math.round(s.prefocusMs),
        holdFocus: !!s.holdFocus,
        wakeUp: !!s.wakeUp,
        frames: s.durationS > 0 ? 0 : (Math.round(s.frames) || 0), // a timed run ignores the frame limit (the menu hides it)
        durationMs: Math.round(s.durationS * 1000) || 0,
        delayMs: Math.round(s.delayS * 1000)
    };
}

// null when the settings can run, otherwise the reason
cable.validate = function (s) {
    s = s || cable.settings;
    if (s.port != 'AUX1' && s.port != 'AUX2') return 'port must be AUX1 or AUX2';
    return scheduler.validate(workerConfig(s));
};

cable.minIntervalS = function (s) {
    return scheduler.minIntervalMs(workerConfig(s || cable.settings)) / 1000;
};

function emitStatus(force) {
    var t = Date.now();
    if (!force && t - lastStatusAt < STATUS_EVERY_MS) return;
    lastStatusAt = t;
    cable.emit('status', cable.status);
}

function describe(s) {
    return 'interval ' + s.intervalS + ' s, release ' + s.releaseMs + ' ms, pre-focus ' + s.prefocusMs + ' ms' +
        (s.holdFocus ? ', hold focus' : '') + (s.wakeUp ? ', wake-up' : '') + ', frames ' + (s.frames || 'unlimited') +
        ', duration ' + (s.durationS ? s.durationS + ' s' : 'unlimited') + ', delay ' + s.delayS + ' s, port ' + s.port;
}

function handleEvent(ev) {
    var cb;
    switch (ev.ev) {
        case 'ready':
            workerReady = true;
            cb = pending.ready;
            delete pending.ready;
            if (cb) cb(null);
            break;
        case 'started':
            cb = pending.started;
            delete pending.started;
            if (cb) cb(null);
            break;
        case 'frame':
            cable.status.frames = ev.n;
            cable.status.lastFrameTime = Date.now();
            cable.status.late = ev.late;
            cable.status.skipped = ev.skipped;
            if (ev.n == 1 || ev.n % LOG_EVERY_FRAMES == 0 || ev.skipped != loggedSkipped) {
                log('CABLE: frame ' + ev.n + (cable.status.total ? '/' + cable.status.total : '') + ' at ' + (ev.t / 1000).toFixed(1) +
                    ' s, late ' + ev.late + ' ms' + (ev.skipped ? ', skipped ' + ev.skipped : ''));
                loggedSkipped = ev.skipped;
            }
            cable.emit('frame', ev);
            emitStatus(ev.n == 1);
            break;
        case 'done':
            finish(ev.reason, ev.frames);
            cb = pending.done;
            delete pending.done;
            if (cb) cb(null);
            break;
        case 'pulse':
            cb = pending.pulse;
            delete pending.pulse;
            if (cb) cb(null);
            break;
        case 'error':
            log('CABLE: worker error: ' + ev.message);
            cable.emit('error', ev.message);
            var waiting = pending;
            pending = {};
            for (var k in waiting) waiting[k](ev.message);
            break;
        case 'exit':
        case 'released':
            break;
        default:
            log('CABLE: unknown worker event', ev);
    }
}

function finish(reason, frames) {
    if (!cable.status.running) return;
    cable.status.running = false;
    cable.status.reason = reason;
    if (frames != null) cable.status.frames = frames;
    var seconds = (Date.now() - cable.status.startTime) / 1000;
    log('CABLE: done (' + reason + '): ' + cable.status.frames + ' frames in ' + seconds.toFixed(1) + ' s' +
        (cable.status.skipped ? ', skipped ' + cable.status.skipped : ''));
    cable.emit('done', reason, cable.status);
    emitStatus(true);
}

function startWorker(cb) {
    if (worker) return cb(null);
    var cmd = process.execPath;
    var args = [WORKER];
    if (fs.existsSync(NICE)) { // ahead of the UI and the core in the run queue: a frame's edge waits for nobody
        cmd = NICE;
        args = ['-n', '-10', process.execPath, WORKER];
    }
    var child;
    try {
        child = spawn(cmd, args, {stdio: ['pipe', 'pipe', 'pipe']});
    } catch (e) {
        return cb(e);
    }
    worker = child;
    workerReady = false;
    pending.ready = cb;
    var buffer = '';
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', function (chunk) {
        buffer += chunk;
        var i;
        while ((i = buffer.indexOf('\n')) >= 0) {
            var line = buffer.slice(0, i).trim();
            buffer = buffer.slice(i + 1);
            if (!line) continue;
            var ev;
            try {
                ev = JSON.parse(line);
            } catch (e) {
                log('CABLE: worker said: ' + line);
                continue;
            }
            handleEvent(ev);
        }
    });
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', function (chunk) {
        log('CABLE: worker stderr: ' + chunk.trim());
    });
    child.stdin.on('error', function () {}); // EPIPE when the worker is already gone: the exit handler deals with it
    child.on('error', function (err) {
        log('CABLE: worker failed to start: ' + err);
        var waiting = pending;
        pending = {};
        worker = null;
        for (var k in waiting) waiting[k](err);
    });
    child.on('exit', function (code, signal) {
        if (worker !== child) return;
        worker = null;
        workerReady = false;
        if (cable.status.running) {
            log('CABLE: worker exited (' + (signal || code) + ') while running');
            finish('interrupted');
        }
        var waiting = pending;
        pending = {};
        for (var k in waiting) waiting[k]('worker exited');
    });
}

function sendCommand(cmd) {
    if (!worker) return false;
    try {
        worker.stdin.write(JSON.stringify(cmd) + '\n');
        return true;
    } catch (e) {
        return false;
    }
}

function stopWorker() {
    var child = worker;
    if (!child) return;
    sendCommand({cmd: 'quit'});
    var term = setTimeout(function () {
        if (worker === child) child.kill('SIGTERM');
    }, STOP_TIMEOUT_MS);
    var kill = setTimeout(function () {
        if (worker === child) child.kill('SIGKILL');
    }, STOP_TIMEOUT_MS * 2);
    child.on('exit', function () {
        clearTimeout(term);
        clearTimeout(kill);
    });
}

cable.start = function (cb) {
    cb = cb || function () {};
    if (cable.status.running) return cb('already running');
    var err = cable.validate(cable.settings);
    if (err) return cb(err);
    var s = clone(cable.settings);
    startWorker(function (err) {
        if (err) return cb(err);
        var cfg = workerConfig(s);
        pending.started = function (err) {
            if (err) {
                cable.status = idleStatus();
                return cb(err);
            }
            log('CABLE: started: ' + describe(s));
            cable.emit('start', cable.status);
            emitStatus(true);
            cb(null, cable.status);
        };
        cable.status = idleStatus();
        loggedSkipped = 0;
        cable.status.running = true;
        cable.status.total = cfg.frames;
        cable.status.durationMs = cfg.durationMs;
        cable.status.intervalMs = cfg.intervalMs;
        cable.status.startTime = Date.now() + cfg.delayMs;
        cable.status.port = cfg.port;
        if (!sendCommand(cfg)) {
            cable.status = idleStatus();
            delete pending.started;
            return cb('worker is not running');
        }
    });
};

cable.stop = function (cb) {
    cb = cb || function () {};
    if (!cable.status.running) return cb(null);
    pending.done = function (err) {
        stopWorker();
        cb(err || null);
    };
    if (!sendCommand({cmd: 'stop'})) {
        delete pending.done;
        finish('interrupted');
        return cb(null);
    }
    setTimeout(function () { // the worker did not answer: it is killed and the status closed here
        if (!pending.done) return;
        delete pending.done;
        finish('stopped');
        stopWorker();
        cb(null);
    }, STOP_TIMEOUT_MS);
};

// Closes both lines of the selected port for ms, for checks with a meter and the first try with a camera.
cable.pulse = function (ms, cb) {
    cb = cb || function () {};
    if (cable.status.running) return cb('running');
    if (cable.settings.port != 'AUX1' && cable.settings.port != 'AUX2') return cb('port must be AUX1 or AUX2');
    ms = parseInt(ms) || 1000;
    startWorker(function (err) {
        if (err) return cb(err);
        pending.pulse = function (err) {
            stopWorker();
            cb(err || null);
        };
        log('CABLE: test pulse ' + ms + ' ms on ' + cable.settings.port);
        if (!sendCommand({cmd: 'pulse', port: cable.settings.port, ms: ms})) {
            delete pending.pulse;
            cb('worker is not running');
        }
    });
};

// Called when the UI shuts down or reboots: the worker gets its stop and its signal before `killall node`.
cable.shutdown = function () {
    if (!worker) return;
    sendCommand({cmd: 'stop'});
    stopWorker();
    if (cable.status.running) finish('interrupted');
};

cable.DEFAULTS = DEFAULTS;
cable.DB_KEY = DB_KEY;

module.exports = cable;
