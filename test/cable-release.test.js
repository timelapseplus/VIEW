'use strict';

var assert = require('assert');
var EventEmitter = require('events').EventEmitter;
var stream = require('stream');
var cable = require('../cable/cable-release.js');

// A stand-in for the worker process: records the commands it gets, lets the test inject events.
function fakeChild() {
    var child = new EventEmitter();
    child.commands = [];
    child.stdin = new stream.Writable({
        write: function (chunk, enc, cb) {
            String(chunk).split('\n').forEach(function (line) {
                if (line.trim()) child.commands.push(JSON.parse(line));
            });
            cb();
        }
    });
    child.stdout = new stream.PassThrough();
    child.stderr = new stream.PassThrough();
    child.kill = function (sig) {
        child.killed = sig;
    };
    child.say = function (ev) {
        child.stdout.write(JSON.stringify(ev) + '\n');
    };
    return child;
}

function fakeDb() {
    var store = {};
    return {
        store: store,
        get: function (key, cb) {
            cb(null, store[key]);
        },
        set: function (key, val, cb) {
            store[key] = JSON.parse(JSON.stringify(val));
            cb && cb(null);
        }
    };
}

var lastChildren = [];

// The module keeps its worker between tests: let the fake workers of the previous test "exit" first.
afterEach(function () {
    lastChildren.forEach(function (c) {
        c.emit('exit', 0, null);
    });
    lastChildren = [];
});

function setup() {
    var children = lastChildren = [];
    var logs = [];
    var db = fakeDb();
    cable.init({
        db: db,
        spawn: function (cmd, args) {
            var c = fakeChild();
            c.cmd = cmd;
            c.args = args;
            children.push(c);
            return c;
        },
        log: function () {
            logs.push(Array.prototype.join.call(arguments, ' '));
        }
    });
    cable.settings = JSON.parse(JSON.stringify(cable.DEFAULTS));
    cable.status.running = false;
    cable.removeAllListeners();
    return {children: children, logs: logs, db: db};
}

describe('cable release controller', function () {
    it('starts the worker, sends the start command after ready and reports running on started', function (done) {
        var t = setup();
        cable.settings.intervalS = 0.5;
        cable.settings.frames = 10;
        var events = [];
        cable.on('start', function () {
            events.push('start');
        });
        cable.start(function (err, status) {
            assert.strictEqual(err, null);
            assert.equal(status.running, true);
            assert.equal(status.total, 10);
            assert.equal(status.intervalMs, 500);
            assert.deepEqual(events, ['start']);
            var cmd = t.children[0].commands[0];
            assert.deepEqual(cmd, {cmd: 'start', port: 'AUX1', intervalMs: 500, releaseMs: 200, prefocusMs: 0, holdFocus: false, wakeUp: false, frames: 10, durationMs: 0, delayMs: 2000});
            assert.ok(/started: interval 0.5 s/.test(t.logs.join('\n')));
            done();
        });
        assert.equal(t.children.length, 1);
        assert.equal(t.children[0].commands.length, 0, 'nothing is sent before the worker is ready');
        t.children[0].say({ev: 'ready', pid: 1});
        setTimeout(function () {
            t.children[0].say({ev: 'started', t0: 0});
        }, 5);
    });

    it('counts frames, logs the first and every 100th, and finishes on done', function (done) {
        var t = setup();
        var statuses = 0;
        cable.on('status', function () {
            statuses++;
        });
        cable.on('done', function (reason, status) {
            assert.equal(reason, 'frames');
            assert.equal(status.running, false);
            assert.equal(status.frames, 150);
            var frameLines = t.logs.filter(function (l) {
                return /CABLE: frame/.test(l);
            });
            assert.equal(frameLines.length, 2, frameLines.join('\n'));
            assert.ok(/CABLE: done \(frames\): 150 frames/.test(t.logs.join('\n')));
            assert.ok(statuses >= 2);
            done();
        });
        cable.start(function () {
            var c = t.children[0];
            for (var n = 1; n <= 150; n++) c.say({ev: 'frame', n: n, t: n * 500, late: 0.3, skipped: 0});
            c.say({ev: 'done', reason: 'frames', frames: 150});
        });
        t.children[0].say({ev: 'ready'});
        t.children[0].say({ev: 'started'});
    });

    it('stop sends stop, then quit once the worker reports done', function (done) {
        var t = setup();
        cable.start(function () {
            var c = t.children[0];
            cable.stop(function (err) {
                assert.strictEqual(err, null);
                assert.equal(cable.status.running, false);
                assert.equal(cable.status.reason, 'stopped');
                var cmds = c.commands.map(function (x) {
                    return x.cmd;
                });
                assert.deepEqual(cmds, ['start', 'stop', 'quit']);
                done();
            });
            c.say({ev: 'done', reason: 'stopped', frames: 3});
        });
        t.children[0].say({ev: 'ready'});
        t.children[0].say({ev: 'started'});
    });

    it('a worker that dies mid-run ends the run as interrupted', function (done) {
        var t = setup();
        cable.on('done', function (reason) {
            assert.equal(reason, 'interrupted');
            assert.equal(cable.status.running, false);
            done();
        });
        cable.start(function () {
            t.children[0].emit('exit', null, 'SIGKILL');
        });
        t.children[0].say({ev: 'ready'});
        t.children[0].say({ev: 'started'});
    });

    it('refuses settings the scheduler cannot run, before any worker is started', function (done) {
        var t = setup();
        cable.settings.intervalS = 0.3;
        cable.settings.prefocusMs = 100;
        assert.ok(/shorter/.test(cable.validate()));
        assert.equal(cable.minIntervalS(), 0.4);
        cable.start(function (err) {
            assert.ok(err);
            assert.equal(t.children.length, 0);
            done();
        });
    });

    it('update takes known keys with type coercion, saves them, and load restores them', function (done) {
        var t = setup();
        cable.update({intervalS: '0.7', frames: 25, holdFocus: 'yes', port: 'AUX2', bogus: 1}, function () {
            assert.deepEqual(t.db.store.cableRelease, {intervalS: 0.7, frames: 25, durationS: 0, releaseMs: 200, prefocusMs: 0, holdFocus: true, wakeUp: false, delayS: 2, port: 'AUX2'});
            cable.settings = JSON.parse(JSON.stringify(cable.DEFAULTS));
            cable.load(function () {
                assert.equal(cable.settings.intervalS, 0.7);
                assert.equal(cable.settings.port, 'AUX2');
                assert.strictEqual(cable.settings.holdFocus, true);
                done();
            });
        });
    });

    it('a timed run ignores the frame limit', function (done) {
        var t = setup();
        cable.settings.frames = 25;
        cable.settings.durationS = 600;
        cable.start(function () {
            var cmd = t.children[0].commands[0];
            assert.equal(cmd.frames, 0);
            assert.equal(cmd.durationMs, 600000);
            assert.equal(cable.status.durationMs, 600000);
            assert.equal(cable.status.total, 0);
            done();
        });
        t.children[0].say({ev: 'ready'});
        t.children[0].say({ev: 'started'});
    });

    it('a test pulse starts a worker, sends pulse with the port, and quits it afterwards', function (done) {
        var t = setup();
        cable.settings.port = 'AUX2';
        cable.pulse(1000, function (err) {
            assert.strictEqual(err, null);
            var cmds = t.children[0].commands;
            assert.deepEqual(cmds[0], {cmd: 'pulse', port: 'AUX2', ms: 1000});
            assert.equal(cmds[1].cmd, 'quit');
            done();
        });
        t.children[0].say({ev: 'ready'});
        setTimeout(function () {
            t.children[0].say({ev: 'pulse'});
        }, 5);
    });
});
