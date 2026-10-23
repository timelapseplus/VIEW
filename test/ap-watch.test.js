'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');
var apWatch = require('../system/ap-watch.js');

var PHONE = 'd6:10:bb:ae:81:17';
var LAPTOP = '3c:22:fb:01:02:03';
var MIN = 60 * 1000;

function joinLine(mac) {
    return '[ 6568.1] RTL871X: set pairwise key camid:4, addr:' + mac + ', kid:0, type:AES';
}
function leaveLine(mac) {
    return '[ 6568.1] RTL871X: clear key for addr:' + mac + ', camid:4';
}

// Feeds timed lines and calls check() every 30 s like wifi.js does; returns the times onIdle fired.
function run(events, untilMs, apMode) {
    var fired = [];
    var now = 0;
    var w = apWatch(function (minutes) {
        fired.push({at: now, minutes: minutes});
    });
    var i = 0;
    for (now = 0; now <= untilMs; now += 1000) {
        while (i < events.length && events[i].t <= now) w.line(events[i++].line, apMode !== false, now);
        if (now % 30000 === 0) w.check(apMode !== false, now);
    }
    return fired;
}

describe('ap-watch', function () {
    it('fires once the hotspot has been empty for 5 minutes after a client left', function () {
        var fired = run([{t: 0, line: joinLine(PHONE)}, {t: 10 * MIN, line: leaveLine(PHONE)}], 16 * MIN);
        assert.equal(fired.length, 1);
        assert.equal(fired[0].at, 15 * MIN);
        assert.equal(fired[0].minutes, 5);
    });

    it('stays quiet when the client comes back within 5 minutes', function () {
        var fired = run([
            {t: 0, line: joinLine(PHONE)},
            {t: 10 * MIN, line: leaveLine(PHONE)},
            {t: 13 * MIN, line: joinLine(PHONE)}
        ], 60 * MIN);
        assert.equal(fired.length, 0);
    });

    it('never fires if no client has used the hotspot', function () {
        assert.equal(run([{t: 0, line: leaveLine(PHONE)}], 3 * 60 * MIN).length, 0);
    });

    it('ignores driver lines outside AP mode', function () {
        var fired = run([{t: 0, line: joinLine(PHONE)}, {t: MIN, line: leaveLine(PHONE)}], 60 * MIN, false);
        assert.equal(fired.length, 0);
    });

    it('does not count the group key as a client', function () {
        var fired = run([{t: 0, line: 'RTL871X: set group key camid:2, addr:00:00:00:00:00:00, kid:2, type:AES'}], 60 * MIN);
        assert.equal(fired.length, 0);
    });

    it('stays quiet while another client is still connected', function () {
        var fired = run([
            {t: 0, line: joinLine(PHONE)},
            {t: 0, line: joinLine(LAPTOP)},
            {t: MIN, line: leaveLine(PHONE)}
        ], 60 * MIN);
        assert.equal(fired.length, 0);
    });

    it('backs off 5, 10, 20, 40, 60, 60 min while nobody returns', function () {
        var fired = run([{t: 0, line: joinLine(PHONE)}, {t: 0, line: leaveLine(PHONE)}], 4 * 60 * MIN);
        var gaps = fired.map(function (f, k) {
            return (f.at - (k ? fired[k - 1].at : 0)) / MIN;
        });
        assert.deepEqual(gaps, [5, 10, 20, 40, 60, 60]);
    });

    it('resets the backoff when a client joins again', function () {
        var fired = run([
            {t: 0, line: joinLine(PHONE)},
            {t: 0, line: leaveLine(PHONE)},          // fires at 5 and 15 min
            {t: 16 * MIN, line: joinLine(PHONE)},
            {t: 20 * MIN, line: leaveLine(PHONE)}    // back to 5 min: fires at 25
        ], 26 * MIN);
        assert.deepEqual(fired.map(function (f) { return f.at / MIN; }), [5, 15, 25]);
    });

    // Real driver lines from the night of 2026-08-15: the phone was dropped at 21:02:31 and the hotspot
    // stayed silent until it was restarted by hand at 21:24 (the phone rejoined at 21:25:40).
    it('would have restarted the silent hotspot ~5 min after the 21:02 drop on 2026-08-15', function () {
        function at(hhmmss) {
            var p = hhmmss.split(':');
            return Date.UTC(2026, 7, 15, +p[0], +p[1], +p[2]);
        }
        var events = fs.readFileSync(path.join(__dirname, 'fixtures/kern-2026-08-15-rtl871x.log'), 'utf8')
            .split('\n').filter(Boolean).map(function (line) {
                var m = line.match(/^Aug +(\d+) (\d\d):(\d\d):(\d\d)/);
                return {t: Date.UTC(2026, 7, +m[1], +m[2], +m[3], +m[4]), line: line};
            });
        var start = events[0].t;
        var fired = run(events.map(function (e) {
            return {t: e.t - start, line: e.line};
        }), events[events.length - 1].t - start + MIN).map(function (f) {
            return f.at + start;
        });
        var shown = fired.map(function (t) { return new Date(t).toISOString().slice(11, 19); }).join(', ');

        var drop = at('21:02:31');
        var restart = fired.filter(function (t) { return t > drop; })[0];
        assert.ok(restart >= drop + 5 * MIN && restart < drop + 5.5 * MIN, 'fired at ' + shown);
        assert.ok(restart < at('21:24:32'), 'before the manual restart: ' + shown);
        assert.ok(fired.every(function (t) { return t < at('22:45:00') || t > at('23:05:00'); }),
            'no restart for the short drops at 22:49 and 22:56: ' + shown);
    });
});
