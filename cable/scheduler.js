'use strict';

// Times the frames of a cable release: when to close the focus line, when to close the shutter line, when to
// open them again. Pure logic, no I/O: the clock, the timers and the two lines are injected, so the tests drive
// it with a fake clock and the worker with process.hrtime and sysfs.
//
// Shot n (counted from 0) happens at first + n * interval, where first = start + delay. The deadlines are
// absolute: a late callback never shifts the following shots (a chained setTimeout drifts +0.7 ms a step on the
// unit). A shot so late that the next one could not keep its distance (release + gap) is skipped, and after a
// stall the schedule moves on to the next slot instead of firing the missed shots back to back.

var MIN_GAP_MS = 50;         // dark time left after the release and the focus lead
var WAKE_LEAD_MS = 1000;     // "wake-up" = the focus line closes this long before the shot
var EARLY_MS = 2;            // the shot timer fires this early and the rest is waited out on the clock

// Effective focus lead for one shot: the configured pre-focus, or the wake-up lead when that is on and fits.
function focusLeadMs(cfg) {
    var lead = cfg.prefocusMs || 0;
    if (cfg.wakeUp && !cfg.holdFocus && cfg.intervalMs - cfg.releaseMs - WAKE_LEAD_MS >= MIN_GAP_MS) {
        lead = Math.max(lead, WAKE_LEAD_MS);
    }
    return lead;
}

// Shortest interval the settings allow, in ms: release + pre-focus + the gap, rounded up to 100 ms.
function minIntervalMs(cfg) {
    var ms = (cfg.releaseMs || 0) + (cfg.prefocusMs || 0) + MIN_GAP_MS;
    return Math.ceil(ms / 100) * 100;
}

// Returns an error string for a bad configuration, null when it can run.
function validate(cfg) {
    if (!cfg) return 'no settings';
    if (!(cfg.intervalMs > 0)) return 'interval must be set';
    if (!(cfg.releaseMs > 0)) return 'release time must be set';
    if (cfg.prefocusMs < 0) return 'pre-focus cannot be negative';
    var min = minIntervalMs(cfg);
    if (cfg.intervalMs < min) return 'interval ' + (cfg.intervalMs / 1000) + ' s is shorter than release + pre-focus + 50 ms = ' + (min / 1000) + ' s';
    if (cfg.frames < 0) return 'frames cannot be negative';
    if (cfg.durationMs < 0) return 'duration cannot be negative';
    return null;
}

// opts: now() ms, setTimeout, clearTimeout, spinUntil(t), lines {shutter(closed), focus(closed)},
//       onFrame(n, info), onDone(reason, frames)
module.exports = function createScheduler(opts) {
    var now = opts.now;
    var setT = opts.setTimeout || setTimeout;
    var clearT = opts.clearTimeout || clearTimeout;
    var spinUntil = opts.spinUntil || function (t) {
        while (now() < t) {}
    };
    var lines = opts.lines;
    var onFrame = opts.onFrame || function () {};
    var onDone = opts.onDone || function () {};

    var cfg = null;
    var running = false;
    var timers = [];
    var t0 = 0;          // when start() was called
    var first = 0;       // the first shot's deadline
    var taken = 0;       // shots taken
    var skipped = 0;     // shots skipped because the schedule was too far behind
    var focusClosed = false;
    var shutterClosed = false;

    function at(t, fn, precise) {
        var delay = t - now() - (precise ? EARLY_MS : 0);
        var handle = setT(function () {
            timers.splice(timers.indexOf(handle), 1);
            if (!running) return;
            if (precise && now() < t) spinUntil(t);
            fn();
        }, delay > 0 ? delay : 0);
        timers.push(handle);
    }

    function focus(closed) {
        if (focusClosed == closed) return;
        lines.focus(closed);
        focusClosed = closed;
    }

    function shutter(closed) {
        if (shutterClosed == closed) return;
        lines.shutter(closed);
        shutterClosed = closed;
    }

    function releaseLines() {
        shutter(false);
        focus(false);
    }

    function finish(reason) {
        if (!running) return;
        running = false;
        for (var i = 0; i < timers.length; i++) clearT(timers[i]);
        timers = [];
        releaseLines();
        onDone(reason, taken);
    }

    // A shot this late would leave the next one less than release + gap away: skip it rather than bunch them.
    function tooLate(late) {
        return late > cfg.intervalMs - cfg.releaseMs - MIN_GAP_MS;
    }

    function scheduleShot(n) {
        var shot = first + n * cfg.intervalMs;
        var behind = now() - shot;
        if (behind > cfg.intervalMs) { // more than a whole interval late: move on to the next slot
            var skip = Math.floor(behind / cfg.intervalMs);
            n += skip;
            skipped += skip;
            shot = first + n * cfg.intervalMs;
        }
        if (cfg.durationMs && shot - first > cfg.durationMs) { // the run is timed: the last shot is the last one inside it
            finish('time');
            return;
        }
        var lead = focusLeadMs(cfg);
        if (lead > 0 && !cfg.holdFocus) {
            at(shot - lead, function () {
                focus(true);
            }, false);
        }
        at(shot, function () {
            var late = now() - shot;
            if (tooLate(late)) {
                skipped++;
                if (!cfg.holdFocus) focus(false);
                scheduleShot(n + 1);
                return;
            }
            focus(true); // AF-time 0: both lines close together, Sony needs the focus line for a release
            shutter(true);
            at(shot + cfg.releaseMs, function () {
                shutter(false);
                if (!cfg.holdFocus) focus(false);
                taken++;
                onFrame(taken, {t: shot - t0, late: late, skipped: skipped});
                if (cfg.frames && taken >= cfg.frames) {
                    finish('frames');
                } else {
                    scheduleShot(n + 1);
                }
            }, false);
        }, true);
    }

    return {
        validate: validate,
        minIntervalMs: minIntervalMs,
        focusLeadMs: focusLeadMs,

        // cfg: {intervalMs, releaseMs, prefocusMs, holdFocus, wakeUp, frames (0 = unlimited), durationMs (0 = unlimited;
        //       shots are taken while shot - first <= durationMs), delayMs}; frames and duration both apply, whichever ends first
        start: function (config) {
            if (running) return 'already running';
            var err = validate(config);
            if (err) return err;
            cfg = config;
            running = true;
            taken = 0;
            skipped = 0;
            t0 = now();
            first = t0 + (cfg.delayMs || 0);
            if (cfg.holdFocus) focus(true);
            scheduleShot(0);
            return null;
        },

        stop: function () {
            finish('stopped');
        },

        // One closure of both lines for ms, e.g. the "Test pulse" menu item; cb() when the lines are open again.
        pulse: function (ms, cb) {
            if (running) return cb('running');
            focus(true);
            shutter(true);
            setT(function () {
                releaseLines();
                cb(null);
            }, ms);
        },

        running: function () {
            return running;
        },

        frames: function () {
            return taken;
        }
    };
};

module.exports.validate = validate;
module.exports.minIntervalMs = minIntervalMs;
module.exports.focusLeadMs = focusLeadMs;
