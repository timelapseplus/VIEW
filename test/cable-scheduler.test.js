'use strict';

var assert = require('assert');
var createScheduler = require('../cable/scheduler.js');

// A clock with its own timer queue: advance(to) runs the timers due by then, each at its own time (plus a
// fixed lateness when one is set, the way a busy CPU delays callbacks on the unit).
function FakeClock(lateness) {
    var self = this;
    this.t = 100000;
    this.queue = [];
    this.seq = 0;
    this.lateness = lateness || 0;
    this.now = function () {
        return self.t;
    };
    this.setTimeout = function (fn, ms) {
        var h = {at: self.t + ms + self.lateness, fn: fn, seq: self.seq++};
        self.queue.push(h);
        return h;
    };
    this.clearTimeout = function (h) {
        var i = self.queue.indexOf(h);
        if (i >= 0) self.queue.splice(i, 1);
    };
    this.spinUntil = function (t) {
        if (t > self.t) self.t = t;
    };
}
FakeClock.prototype.advance = function (to) {
    for (;;) {
        var next = null;
        for (var i = 0; i < this.queue.length; i++) {
            if (!next || this.queue[i].at < next.at || (this.queue[i].at == next.at && this.queue[i].seq < next.seq)) next = this.queue[i];
        }
        if (!next || next.at > to) break;
        this.queue.splice(this.queue.indexOf(next), 1);
        if (next.at > this.t) this.t = next.at;
        next.fn();
    }
    if (to > this.t) this.t = to;
};

// Records every line edge as {t, line, closed}.
function build(clock, cfgOverrides) {
    var edges = [];
    var frames = [];
    var done = null;
    var sched = createScheduler({
        now: clock.now,
        setTimeout: clock.setTimeout,
        clearTimeout: clock.clearTimeout,
        spinUntil: clock.spinUntil,
        lines: {
            shutter: function (closed) {
                edges.push({t: clock.t, line: 'shutter', closed: closed});
            },
            focus: function (closed) {
                edges.push({t: clock.t, line: 'focus', closed: closed});
            }
        },
        onFrame: function (n, info) {
            frames.push({n: n, t: info.t, late: info.late, skipped: info.skipped});
        },
        onDone: function (reason, n) {
            done = {reason: reason, frames: n};
        }
    });
    var cfg = {intervalMs: 500, releaseMs: 200, prefocusMs: 0, holdFocus: false, wakeUp: false, frames: 0, delayMs: 2000};
    for (var k in cfgOverrides) cfg[k] = cfgOverrides[k];
    return {
        sched: sched,
        cfg: cfg,
        edges: edges,
        frames: frames,
        done: function () {
            return done;
        },
        shutterCloses: function () {
            return edges.filter(function (e) {
                return e.line == 'shutter' && e.closed;
            }).map(function (e) {
                return e.t;
            });
        }
    };
}

describe('cable scheduler', function () {
    it('shoots on absolute deadlines: first shot after the delay, then every interval', function () {
        var clock = new FakeClock();
        var s = build(clock);
        var t0 = clock.t;
        assert.equal(s.sched.start(s.cfg), null);
        clock.advance(t0 + 2000 + 500 * 5 + 300);
        assert.deepEqual(s.shutterCloses(), [t0 + 2000, t0 + 2500, t0 + 3000, t0 + 3500, t0 + 4000, t0 + 4500]);
        assert.equal(s.frames.length, 6);
        assert.equal(s.frames[0].n, 1);
        assert.equal(s.frames[5].t, 4500);
    });

    it('does not drift when every callback is late (the shots stay on the grid)', function () {
        var clock = new FakeClock(7); // every timer fires 7 ms late
        var s = build(clock);
        var t0 = clock.t;
        s.sched.start(s.cfg);
        clock.advance(t0 + 2000 + 500 * 20 + 300);
        var shots = s.shutterCloses();
        assert.equal(shots.length, 21);
        // the shot timer fires 2 ms early and the spin covers up to that; a 7 ms late timer lands 5 ms late,
        // but always relative to the grid, never to the previous shot
        for (var n = 0; n < shots.length; n++) {
            assert.equal(shots[n] - (t0 + 2000 + n * 500), 5, 'shot ' + n);
        }
        assert.equal(s.frames[20].late, 5);
    });

    it('releases the shutter after the release time and both lines close together without pre-focus', function () {
        var clock = new FakeClock();
        var s = build(clock, {frames: 1});
        var t0 = clock.t;
        s.sched.start(s.cfg);
        clock.advance(t0 + 3000);
        assert.deepEqual(s.edges, [
            {t: t0 + 2000, line: 'focus', closed: true},
            {t: t0 + 2000, line: 'shutter', closed: true},
            {t: t0 + 2200, line: 'shutter', closed: false},
            {t: t0 + 2200, line: 'focus', closed: false}
        ]);
        assert.deepEqual(s.done(), {reason: 'frames', frames: 1});
    });

    it('closes the focus line pre-focus ms before the shot', function () {
        var clock = new FakeClock();
        var s = build(clock, {prefocusMs: 100, frames: 2});
        var t0 = clock.t;
        s.sched.start(s.cfg);
        clock.advance(t0 + 4000);
        var focusCloses = s.edges.filter(function (e) {
            return e.line == 'focus' && e.closed;
        }).map(function (e) {
            return e.t;
        });
        assert.deepEqual(focusCloses, [t0 + 1900, t0 + 2400]);
        assert.deepEqual(s.shutterCloses(), [t0 + 2000, t0 + 2500]);
    });

    it('holds the focus line from start to stop when holdFocus is on', function () {
        var clock = new FakeClock();
        var s = build(clock, {holdFocus: true, prefocusMs: 100});
        var t0 = clock.t;
        s.sched.start(s.cfg);
        assert.deepEqual(s.edges, [{t: t0, line: 'focus', closed: true}]);
        clock.advance(t0 + 3100);
        var focusEdges = s.edges.filter(function (e) {
            return e.line == 'focus';
        });
        assert.equal(focusEdges.length, 1);
        s.sched.stop();
        focusEdges = s.edges.filter(function (e) {
            return e.line == 'focus';
        });
        assert.deepEqual(focusEdges[1], {t: t0 + 3100, line: 'focus', closed: false});
        assert.equal(s.done().reason, 'stopped');
    });

    it('wake-up closes the focus line 1 s before the shot when the interval leaves room', function () {
        var clock = new FakeClock();
        var s = build(clock, {intervalMs: 5000, wakeUp: true, prefocusMs: 100, frames: 1});
        var t0 = clock.t;
        s.sched.start(s.cfg);
        clock.advance(t0 + 3000);
        assert.equal(s.edges[0].t, t0 + 1000);
        assert.equal(s.edges[0].line, 'focus');
        // and is ignored when it does not fit
        var s2 = build(clock, {intervalMs: 500, wakeUp: true, prefocusMs: 0});
        assert.equal(s2.sched.focusLeadMs(s2.cfg), 0);
    });

    it('skips the missed shots after a stall instead of firing them back to back', function () {
        var clock = new FakeClock();
        var s = build(clock);
        var t0 = clock.t;
        s.sched.start(s.cfg);
        clock.advance(t0 + 2200); // first shot done, shot 1 is armed for t0 + 2500
        clock.t = t0 + 2000 + 500 * 4 + 50; // the process stalled for two seconds
        clock.advance(t0 + 2000 + 500 * 6 + 300);
        var shots = s.shutterCloses();
        assert.equal(shots[0], t0 + 2000);
        // shot 1 fires 1550 ms late and is skipped; shots 2 and 3 are already past; shot 4 (due 50 ms ago)
        // is taken, shot 5 keeps the grid
        assert.deepEqual(shots.slice(1), [t0 + 4050, t0 + 4500, t0 + 5000]);
        assert.equal(s.frames[1].late, 50);
        assert.equal(s.frames[1].skipped, 3);
        assert.equal(s.frames[1].t, 4000);
    });

    it('a shot too late for the next one to keep its distance is skipped', function () {
        var clock = new FakeClock(260); // timers 260 ms late: more than interval - release - gap = 250
        var s = build(clock, {frames: 0});
        var t0 = clock.t;
        s.sched.start(s.cfg);
        clock.advance(t0 + 5000);
        assert.equal(s.shutterCloses().length, 0);
        clock.lateness = 100;
        clock.advance(t0 + 6000);
        assert.ok(s.shutterCloses().length > 0);
        assert.ok(s.frames[0].skipped >= 5);
    });

    it('stops: timers cleared, lines released, done reported once', function () {
        var clock = new FakeClock();
        var s = build(clock);
        var t0 = clock.t;
        s.sched.start(s.cfg);
        clock.advance(t0 + 2050); // mid-release: shutter closed
        s.sched.stop();
        s.sched.stop();
        assert.deepEqual(s.edges.slice(-2), [
            {t: t0 + 2050, line: 'shutter', closed: false},
            {t: t0 + 2050, line: 'focus', closed: false}
        ]);
        assert.equal(clock.queue.length, 0);
        assert.deepEqual(s.done(), {reason: 'stopped', frames: 0});
        clock.advance(t0 + 10000);
        assert.equal(s.shutterCloses().length, 1);
    });

    it('a timed run takes every shot inside the duration and ends with reason "time"', function () {
        var clock = new FakeClock();
        var s = build(clock, {intervalMs: 300, durationMs: 1200, frames: 0});
        var t0 = clock.t;
        s.sched.start(s.cfg);
        clock.advance(t0 + 10000);
        // shots at 0, 300, 600, 900 and 1200 ms after the first: five of them, the one at 1500 is outside
        assert.deepEqual(s.shutterCloses(), [t0 + 2000, t0 + 2300, t0 + 2600, t0 + 2900, t0 + 3200]);
        assert.deepEqual(s.done(), {reason: 'time', frames: 5});
        // the frame limit still wins when it comes first
        var s2 = build(clock, {intervalMs: 300, durationMs: 1200, frames: 2});
        s2.sched.start(s2.cfg);
        clock.advance(clock.t + 10000);
        assert.deepEqual(s2.done(), {reason: 'frames', frames: 2});
    });

    it('refuses an interval shorter than release + pre-focus + 50 ms, rounded up to 100 ms', function () {
        var v = createScheduler.validate;
        assert.equal(v({intervalMs: 300, releaseMs: 200, prefocusMs: 0, frames: 0}), null);
        assert.ok(/shorter/.test(v({intervalMs: 300, releaseMs: 200, prefocusMs: 100, frames: 0})));
        assert.equal(createScheduler.minIntervalMs({releaseMs: 200, prefocusMs: 100}), 400);
        assert.equal(createScheduler.minIntervalMs({releaseMs: 100, prefocusMs: 0}), 200);
        assert.ok(v({intervalMs: 0, releaseMs: 200}));
        assert.ok(v(null));
    });

    it('a test pulse closes both lines for the given time', function () {
        var clock = new FakeClock();
        var s = build(clock);
        var t0 = clock.t;
        var result = 'not called';
        s.sched.pulse(1000, function (err) {
            result = err;
        });
        clock.advance(t0 + 1500);
        assert.strictEqual(result, null);
        assert.deepEqual(s.edges.map(function (e) {
            return e.t + e.line + e.closed;
        }), [t0 + 'focustrue', t0 + 'shuttertrue', (t0 + 1000) + 'shutterfalse', (t0 + 1000) + 'focusfalse']);
    });
});
