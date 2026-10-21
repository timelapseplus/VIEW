'use strict';

// The device menus of the cable release (main menu > Cable Release): the settings list, the status screen that
// replaces it while a run is on (the way the time-lapse menu does), the stop confirmation. The logic is in
// cable-release.js; this file only builds the menu programs for interface/ui.js. main.js wires it in with
//   var cableMenu = require('./cable/menu.js')({ui: ui, help: help, core: core, cable: cable});

module.exports = function (deps) {
    var ui = deps.ui;
    var help = deps.help;
    var core = deps.core;
    var cable = deps.cable;

    // one options screen per setting: the value is saved as soon as it is picked
    var optionsMenu = function (title, key, values, format, helpText) {
        return {
            name: title,
            type: "options",
            items: values.map(function (v) {
                return {
                    name: title,
                    value: format(v),
                    help: helpText,
                    action: ui.set(cable.settings, key, v, function (cb) {
                        cable.save();
                        cb && cb();
                    })
                };
            })
        };
    };

    var seconds = function (v) {
        return v + " seconds";
    };
    var millis = function (v) {
        return v + "ms";
    };
    var yesNo = function (v) {
        return v ? "yes" : "no";
    };

    var clock = function (secs) { // 0:05, 12:34, 1:02:03
        secs = Math.max(0, Math.round(secs));
        var h = Math.floor(secs / 3600);
        var m = Math.floor(secs / 60) % 60;
        var s = secs % 60;
        return (h ? h + ":" + (m < 10 ? "0" : "") : "") + m + ":" + (s < 10 ? "0" : "") + s;
    };

    var duration = function (v) {
        if (!v) return "unlimited";
        if (v < 60) return v + " seconds";
        if (v < 3600) return (v / 60) + " minutes";
        return (v / 3600) + (v == 3600 ? " hour" : " hours");
    };

    var stopConfirm = {
        name: "stop cable release?",
        type: "options",
        items: [{
            name: "stop cable release?",
            value: "no",
            action: {
                type: 'function',
                fn: function (arg, cb) {
                    cb();
                }
            }
        }, {
            name: "stop cable release?",
            value: "yes",
            action: {
                type: 'function',
                fn: function (arg, cb) {
                    cable.stop(function () {
                        cb();
                    });
                }
            }
        }]
    };

    var noAction = {
        type: 'function',
        fn: function (arg, cb) {
            cb();
        }
    };

    // Four lines: the OLED shows a menu of up to four items whole, without scrolling (hardware/oled.js writeMenu).
    var statusMenu = function () {
        var st = cable.status;
        var elapsed = st.running ? (Date.now() - st.startTime) / 1000 : 0;
        return {
            name: "cable status",
            type: "menu",
            items: [{
                name: "Frames~" + st.frames + (st.total ? "/" + st.total : ""),
                help: help.cableStatus,
                action: noAction
            }, {
                name: "Time~" + clock(elapsed) + (st.durationMs ? "/" + clock(st.durationMs / 1000) : ""),
                help: help.cableStatus,
                action: noAction
            }, {
                name: "Interval~" + (st.intervalMs / 1000) + "s " + st.port,
                help: help.cableStatus,
                action: noAction
            }, {
                name: "Stop Cable Release",
                help: help.cableStop,
                action: stopConfirm
            }]
        };
    };

    var cableMenu = {
        name: "cable release",
        type: "menu",
        alternate: function () {
            return cable.status.running ? statusMenu() : false;
        },
        items: [{
            name: function () {
                return "Interval~" + cable.settings.intervalS + "s";
            },
            help: help.cableInterval,
            action: optionsMenu("Interval", 'intervalS', [0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10, 15, 20, 30, 45, 60, 90, 120, 180, 300, 600], seconds, help.cableInterval)
        }, {
            name: function () {
                return "Duration~" + (cable.settings.durationS ? clock(cable.settings.durationS) : "unlimited");
            },
            help: help.cableDuration,
            action: optionsMenu("Duration", 'durationS', [0, 30, 60, 120, 180, 300, 600, 900, 1200, 1800, 2700, 3600, 5400, 7200, 10800, 14400, 21600, 28800, 43200, 86400], duration, help.cableDuration)
        }, {
            name: function () {
                return "Frames~" + (cable.settings.frames || "unlimited");
            },
            help: help.cableFrames,
            condition: function () { // one limit at a time: with a Duration set, the run is timed and Frames is out of the way
                return !cable.settings.durationS;
            },
            action: optionsMenu("Frames", 'frames', [0, 10, 25, 50, 100, 200, 300, 500, 1000, 2000, 5000, 10000], function (v) {
                return v ? String(v) : "unlimited";
            }, help.cableFrames)
        }, {
            name: function () {
                return "Release Time~" + cable.settings.releaseMs + "ms";
            },
            help: help.cableReleaseTime,
            action: optionsMenu("Release Time", 'releaseMs', [50, 100, 150, 200, 300, 500, 1000], millis, help.cableReleaseTime)
        }, {
            name: function () {
                return "Pre-focus~" + cable.settings.prefocusMs + "ms";
            },
            help: help.cablePrefocus,
            action: optionsMenu("Pre-focus", 'prefocusMs', [0, 50, 100, 200, 300, 500, 1000], millis, help.cablePrefocus)
        }, {
            name: function () {
                return "Hold Focus~" + yesNo(cable.settings.holdFocus);
            },
            help: help.cableHoldFocus,
            action: optionsMenu("Hold Focus", 'holdFocus', [false, true], yesNo, help.cableHoldFocus)
        }, {
            name: function () {
                return "Wake-up~" + yesNo(cable.settings.wakeUp);
            },
            help: help.cableWakeUp,
            action: optionsMenu("Wake-up", 'wakeUp', [false, true], yesNo, help.cableWakeUp)
        }, {
            name: function () {
                return "Start Delay~" + cable.settings.delayS + "s";
            },
            help: help.cableDelay,
            action: optionsMenu("Start Delay", 'delayS', [0, 1, 2, 3, 5, 10, 30], seconds, help.cableDelay)
        }, {
            name: function () {
                return "Port~" + cable.settings.port;
            },
            help: help.cablePort,
            action: optionsMenu("Port", 'port', ['AUX1', 'AUX2'], String, help.cablePort)
        }, {
            name: "Test Pulse (1s)",
            help: help.cablePulse,
            action: {
                type: "function",
                fn: function (arg, cb) {
                    cable.pulse(1000, function (err) {
                        if (err) {
                            ui.back();
                            ui.alert('Error', "Test pulse failed:\n" + err);
                        } else {
                            cb();
                        }
                    });
                }
            }
        }, {
            name: "START",
            help: help.cableStart,
            condition: function () {
                return !core.intervalometerStatus.running;
            },
            action: {
                type: "function",
                fn: function (arg, cb) {
                    var err = cable.validate(cable.settings);
                    if (err) {
                        ui.back();
                        ui.alert('Error', err + "\n(shortest interval for these settings: " + cable.minIntervalS() + " s)");
                        return;
                    }
                    cable.start(function (startErr) {
                        if (startErr) {
                            ui.back();
                            ui.alert('Error', "Cable release failed to start:\n" + startErr);
                        } else {
                            // back to the cable menu, which now shows the status screen; loaded again with the
                            // cursor on its first line (going back alone would leave it on START's index = the last line)
                            ui.back();
                            ui.load(cableMenu, true, 0);
                        }
                    });
                }
            }
        }]
    };

    return cableMenu;
};
