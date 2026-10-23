'use strict';

// AP watchdog. In 2026-08 the RTL8723BU hotspot twice went silent: the driver dropped the phone, phones
// could no longer see the SSID, and nothing was logged until the AP was restarted by hand. Clients are
// tracked from the driver's key events in dmesg; once one has used the AP and it has stayed empty for a
// while, onIdle fires (the caller decides whether to restart). The wait doubles after each firing and
// resets when a client joins, so a VIEW left without its phone is not power-cycling its WiFi every 5 min.

var IDLE_MIN_MS = 5 * 60 * 1000;
var IDLE_MAX_MS = 60 * 60 * 1000;

// onIdle(emptyMinutes) is called from check().
module.exports = function (onIdle) {
    var clients = {};
    var hadClient = false;
    var emptySince = null;
    var idleMs = IDLE_MIN_MS;

    return {
        // one RTL871X dmesg line; only meaningful while in AP mode
        line: function (text, apMode, now) {
            if (!apMode) return;
            var joined = text.match(/set pairwise key .*addr:([0-9a-f:]{17})/);
            var left = text.match(/clear key for addr:([0-9a-f:]{17})/);
            if (joined) {
                clients[joined[1]] = true;
                hadClient = true;
                emptySince = null;
                idleMs = IDLE_MIN_MS;
            } else if (left) {
                delete clients[left[1]];
                if (Object.keys(clients).length == 0) emptySince = now;
            }
        },
        check: function (apMode, now) {
            if (!apMode || !hadClient || emptySince == null) return;
            if (now - emptySince < idleMs) return;
            var minutes = Math.round((now - emptySince) / 60000);
            clients = {}; // a restart drops everyone anyway
            emptySince = now;
            idleMs = Math.min(idleMs * 2, IDLE_MAX_MS);
            onIdle(minutes);
        }
    };
};
