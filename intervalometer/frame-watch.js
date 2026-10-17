'use strict';

// Notices a running time-lapse that has stopped producing frames. In 2026-08 the camera powered off
// right while the next exposure was being set: TL-440 stayed "running" for 5 h after its last frame
// with nothing logged and nothing sent to the app. Used from the UI process, so it still fires when
// the core process itself is stuck.

var MIN_STALL_MS = 2 * 60 * 1000;

// onStall(minutes, frames) is called once per stall; a new frame re-arms it.
module.exports = function (onStall) {
    var last = null;
    var lastFrameAt = 0;
    var reported = false;

    return {
        status: function (s, now) {
            if (!s || !s.running) {
                last = null;
                return;
            }
            // only "running" means a frame is due every interval (not scheduled waits, AUX, start-up)
            if (!last || s.frames !== last.frames || (s.message == 'running' && last.message != 'running')) {
                lastFrameAt = now;
                reported = false;
            }
            last = s;
        },
        check: function (now) {
            if (!last || reported || last.message != 'running') return;
            if (now - lastFrameAt < Math.max(3 * (last.intervalMs || 0), MIN_STALL_MS)) return;
            reported = true;
            onStall(Math.round((now - lastFrameAt) / 60000), last.frames);
        }
    };
};
