'use strict';

// Times the frames of a cable release: when to close the focus line, when to close the shutter line, when to
// open them again. Pure logic, no I/O: the clock, the timers and the two lines are injected, so the tests drive
// it with a fake clock and the worker with process.hrtime and sysfs.
//
// The first shot is at start + delay, each next one at the previous one's deadline + the interval at that deadline.
// The deadlines are absolute: a late callback never shifts the following shots (a chained setTimeout drifts +0.7 ms
// a step on the unit). The interval is the configured one or a ramp's, linear in time from fromMs at t0 to toMs at
// t0 + overMs, then toMs (docs/2026-10-23-cable-interval-ramp.md); a ramp is planned
// with the start (cfg.ramp) or set while running (rampTo). A shot so late that the next one could not keep its
// distance (release + gap) is skipped, and after a stall the schedule moves on to the next slot instead of firing
// the missed shots back to back.

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
    if (cfg.ramp) {
        if (cfg.ramp.afterMs < 0) return 'the ramp cannot start before the first shot';
        return validateRamp(cfg, cfg.ramp.toMs, cfg.ramp.overMs);
    }
    return null;
}

// A ramp to toMs over overMs (0 = at once) for these settings: an error string, or null.
function validateRamp(cfg, toMs, overMs) {
    if (!(toMs > 0)) return 'ramp target must be set';
    if (!(overMs >= 0)) return 'ramp time cannot be negative';
    var min = minIntervalMs(cfg);
    if (toMs < min) return 'ramp target ' + (toMs / 1000) + ' s is shorter than release + pre-focus + 50 ms = ' + (min / 1000) + ' s';
    return null;
}

// opts: now() ms, setTimeout, clearTimeout, spinUntil(t), lines {shutter(closed), focus(closed)},
//       onFrame(n, info), onDone(reason, frames), onRamp(state) when a ramp has run its course
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
    var onRamp = opts.onRamp || function () {};

    var cfg = null;
    var running = false;
    var timers = [];
    var t0 = 0;          // when start() was called
    var first = 0;       // the first shot's deadline
    var taken = 0;       // shots taken
    var skipped = 0;     // shots skipped because the schedule was too far behind
    var intervalMs = 0;  // the interval outside a ramp
    var ramp = null;     // {fromMs, toMs, t0, overMs}: planned or under way
    var lastSlot = null; // deadline of the last shot taken or skipped: the next one counts from it
    var pending = null;  // {shot, timers} of the shot waiting for its time; null while one is being taken
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
        return handle;
    }

    function cancel(handle) {
        var i = timers.indexOf(handle);
        if (i >= 0) timers.splice(i, 1);
        clearT(handle);
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
        pending = null;
        releaseLines();
        onDone(reason, taken);
    }

    function intervalAt(t) {
        if (!ramp) return intervalMs;
        if (t <= ramp.t0) return ramp.fromMs;
        if (t >= ramp.t0 + ramp.overMs) return ramp.toMs;
        return ramp.fromMs + (ramp.toMs - ramp.fromMs) * (t - ramp.t0) / ramp.overMs;
    }

    function state() {
        var t = now();
        return {
            intervalMs: intervalAt(t),
            ramp: ramp ? {fromMs: ramp.fromMs, toMs: ramp.toMs, overMs: ramp.overMs, elapsedMs: t - ramp.t0} : null
        };
    }

    // The gap from the slot at deadline d to the next one; a ramp whose end it reaches is over from then on.
    function gapAfter(d) {
        var gap = intervalAt(d);
        if (ramp && d >= ramp.t0 + ramp.overMs) {
            intervalMs = ramp.toMs;
            ramp = null;
            onRamp(state());
        }
        return gap;
    }

    function scheduleShot(shot) {
        while (now() - shot > intervalAt(shot)) { // more than a whole interval late: move on to the next slot
            lastSlot = shot;
            shot += gapAfter(shot);
            skipped++;
        }
        if (cfg.durationMs && shot - first > cfg.durationMs) { // the run is timed: the last shot is the last one inside it
            finish('time');
            return;
        }
        // the wake-up lead has to fit into the gap before the shot (the one after it decides whether it is too late)
        var lead = focusLeadMs({
            prefocusMs: cfg.prefocusMs,
            releaseMs: cfg.releaseMs,
            wakeUp: cfg.wakeUp,
            holdFocus: cfg.holdFocus,
            intervalMs: lastSlot == null ? intervalAt(shot) : shot - lastSlot
        });
        var p = pending = {shot: shot, timers: []};
        if (lead > 0 && !cfg.holdFocus) {
            p.timers.push(at(shot - lead, function () {
                focus(true);
            }, false));
        }
        p.timers.push(at(shot, function () {
            pending = null;
            var late = now() - shot;
            // a shot this late would leave the next one less than release + gap away: skip it rather than bunch them
            if (late > intervalAt(shot) - cfg.releaseMs - MIN_GAP_MS) {
                skipped++;
                if (!cfg.holdFocus) focus(false);
                lastSlot = shot;
                scheduleShot(shot + gapAfter(shot));
                return;
            }
            focus(true); // AF-time 0: both lines close together, Sony needs the focus line for a release
            shutter(true);
            at(shot + cfg.releaseMs, function () {
                shutter(false);
                if (!cfg.holdFocus) focus(false);
                taken++;
                lastSlot = shot;
                var next = shot + gapAfter(shot);
                onFrame(taken, {t: shot - t0, late: late, skipped: skipped, intervalMs: next - shot});
                if (cfg.frames && taken >= cfg.frames) {
                    finish('frames');
                } else {
                    scheduleShot(next);
                }
            }, false);
        }, true));
    }

    // The interval changed under the shot waiting for its time: that shot now follows the previous one by the interval
    // in force at the change, but not before now (a change from 10 min to 5 s does not wait out the 10 min). Nothing
    // moves for a ramp that starts from the current interval. The first shot keeps the start delay.
    function replan() {
        if (!pending || lastSlot == null) return;
        var shot = Math.max(lastSlot + intervalAt(now()), now());
        if (shot == pending.shot) return;
        pending.timers.forEach(cancel);
        pending = null;
        if (!cfg.holdFocus) focus(false); // a wake-up or pre-focus lead may have closed it already
        scheduleShot(shot);
    }

    return {
        validate: validate,
        minIntervalMs: minIntervalMs,
        focusLeadMs: focusLeadMs,

        // cfg: {intervalMs, releaseMs, prefocusMs, holdFocus, wakeUp, frames (0 = unlimited), durationMs (0 = unlimited;
        //       shots are taken while shot - first <= durationMs), delayMs, ramp (optional: {toMs, overMs, afterMs},
        //       afterMs counted from the first shot)}; frames and duration both apply, whichever ends first
        start: function (config) {
            if (running) return 'already running';
            var err = validate(config);
            if (err) return err;
            cfg = config;
            running = true;
            taken = 0;
            skipped = 0;
            lastSlot = null;
            pending = null;
            t0 = now();
            first = t0 + (cfg.delayMs || 0);
            intervalMs = cfg.intervalMs;
            ramp = cfg.ramp ? {fromMs: cfg.intervalMs, toMs: cfg.ramp.toMs, t0: first + (cfg.ramp.afterMs || 0), overMs: cfg.ramp.overMs} : null;
            if (cfg.holdFocus) focus(true);
            scheduleShot(first);
            return null;
        },

        stop: function () {
            finish('stopped');
        },

        // Ramps the interval from what it is now to toMs over overMs (0 = at once); replaces any ramp, planned or
        // under way. An error string, or null.
        rampTo: function (toMs, overMs) {
            if (!running) return 'not running';
            overMs = overMs || 0;
            var err = validateRamp(cfg, toMs, overMs);
            if (err) return err;
            var t = now();
            if (overMs > 0) {
                ramp = {fromMs: intervalAt(t), toMs: toMs, t0: t, overMs: overMs};
            } else {
                intervalMs = toMs;
                ramp = null;
            }
            replan();
            return null;
        },

        // Stops a ramp where it is: the interval stays at its current value.
        stopRamp: function () {
            if (!running) return 'not running';
            intervalMs = intervalAt(now());
            ramp = null;
            replan();
            return null;
        },

        // {intervalMs: the interval now, ramp: {fromMs, toMs, overMs, elapsedMs (< 0 while it waits)} or null}
        state: state,

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
module.exports.validateRamp = validateRamp;
module.exports.minIntervalMs = minIntervalMs;
module.exports.focusLeadMs = focusLeadMs;
