'use strict';

var assert = require('assert');
var frameWatch = require('../intervalometer/frame-watch.js');

var MIN = 60 * 1000;

function status(frames, interval, message, running) {
    return {
        running: running !== false,
        frames: frames,
        message: message || 'running',
        intervalMs: interval
    };
}

// one frame every `interval` ms starting at `fromT`, numbered from `firstFrame`
function frames(fromT, count, interval, firstFrame) {
    var out = [];
    for (var k = 0; k < count; k++) {
        out.push({t: fromT + k * interval, s: status((firstFrame || 1) + k, interval)});
    }
    return out;
}

// Feeds timed statuses and calls check() every 30 s like main.js does; returns the stall reports.
function run(events, untilMs) {
    var stalls = [];
    var now = 0;
    var w = frameWatch(function (minutes, frameCount) {
        stalls.push({at: now, minutes: minutes, frames: frameCount});
    });
    var i = 0;
    for (now = 0; now <= untilMs; now += 1000) {
        while (i < events.length && events[i].t <= now) w.status(events[i++].s, now);
        if (now % 30000 === 0) w.check(now);
    }
    return stalls;
}

describe('frame-watch', function () {
    // 2026-08-16 00:14:56: TL-440's camera powered off after frame 219 (22 s interval) and the core hung.
    it('reports a stalled time-lapse once, about 2 minutes after the last frame', function () {
        var lastT = 218 * 22000;
        var stalls = run(frames(0, 219, 22000), lastT + 30 * MIN);
        assert.equal(stalls.length, 1);
        assert.ok(stalls[0].at - lastT >= 2 * MIN && stalls[0].at - lastT <= 2.5 * MIN, 'after ' + (stalls[0].at - lastT) + ' ms');
        assert.equal(stalls[0].frames, 219);
    });

    it('stays quiet while frames keep coming', function () {
        assert.equal(run(frames(0, 100, 22000), 99 * 22000 + 20000).length, 0);
    });

    it('waits three intervals when the interval is long', function () {
        var stalls = run(frames(0, 5, 60000), 14 * MIN);
        assert.equal(stalls.length, 1);
        assert.ok(stalls[0].at - 4 * MIN >= 3 * MIN);
    });

    it('stays quiet during a scheduled wait and right after it', function () {
        var events = frames(0, 3, 22000).concat([
            {t: 70000, s: status(3, 22000, 'starting in 5 hours, 0 minutes...')},
            {t: 5 * 60 * MIN, s: status(3, 22000, 'running')}
        ]);
        assert.equal(run(events, 5 * 60 * MIN + MIN).length, 0);
    });

    it('stays quiet once the time-lapse is stopped', function () {
        var events = frames(0, 3, 22000).concat([{t: 70000, s: status(3, 22000, 'time-lapse canceled', false)}]);
        assert.equal(run(events, 60 * MIN).length, 0);
    });

    it('reports again after frames resumed and stalled a second time', function () {
        var events = frames(0, 3, 22000).concat(frames(10 * MIN, 3, 22000, 4));
        assert.equal(run(events, 10 * MIN + 2 * 22000 + 10 * MIN).length, 2);
    });
});
