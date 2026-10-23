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

    // The times every list here offers, the interval and the ramp's alike: the steps of the time-lapse menu's interval
    // list (main.js), from 0.3 s and up to 2 hours, 116 values; "Custom..." takes any other value to 0.1 s.
    var TIMES = (function () {
        var t = [], i;
        for (i = 3; i < 50; i++) t.push(i / 10);    // 0.3 - 4.9 s by 0.1
        for (i = 10; i < 24; i++) t.push(i / 2);    // 5 - 11.5 s by 0.5
        for (i = 12; i < 35; i++) t.push(i);        // 12 - 34 s by 1
        for (i = 35; i < 90; i += 5) t.push(i);     // 35 - 85 s by 5
        t.push(90);
        for (i = 2; i < 15; i++) t.push(i * 60);    // 2 - 14 min by 1
        [15, 20, 30, 45, 60, 90, 120].forEach(function (m) {
            t.push(m * 60);
        });
        return t;
    })();

    // An options screen that sets target[key]: after() runs once a value is picked (the settings save themselves).
    // With custom, the last item opens a digit-by-digit entry in seconds (numberInput, like the coordinates).
    var pickMenu = function (title, target, key, values, format, helpText, custom, after) {
        var items = values.map(function (v) {
            return {
                name: title,
                value: format(v),
                help: helpText,
                action: ui.set(target, key, v, function (cb) {
                    if (after) after();
                    cb && cb();
                })
            };
        });
        if (custom) {
            items.push({
                name: title,
                value: "Custom...",
                help: helpText,
                action: {
                    type: 'function',
                    fn: function (arg, cb) {
                        cb(null, {
                            name: title + " (seconds)",
                            type: "numberInput",
                            value: target[key] || 0,
                            help: helpText,
                            onSave: function (v) { // the entry goes back to the menu the list was opened from
                                v = Math.round(parseFloat(v) * 10) / 10;
                                if (!(v > 0)) return;
                                target[key] = v;
                                if (after) after();
                            }
                        });
                    }
                }
            });
        }
        return {
            name: title,
            type: "options",
            items: items
        };
    };

    // one options screen per setting: the value is saved as soon as it is picked
    var optionsMenu = function (title, key, values, format, helpText, custom) {
        return pickMenu(title, cable.settings, key, values, format, helpText, custom, function () {
            cable.save();
        });
    };

    var seconds = function (v) {
        return v + " seconds";
    };
    var timeValue = function (v) { // a list value: 4.5 seconds, 1.5 minutes, 2 hours
        if (v < 90) return v + " seconds";
        if (v >= 3600 && v % 3600 == 0) return (v / 3600) + (v == 3600 ? " hour" : " hours");
        return (v / 60) + " minutes";
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

    var shortTime = function (secs) { // a menu line's value: 4.5s, 1:00, 1:00:00
        return secs < 60 ? secs + "s" : clock(secs);
    };

    var tenths = function (ms) {
        return Math.round(ms / 100) / 10;
    };

    // The status screen's interval line (redrawn every second while it runs): "Interval 5s AUX1"; with a ramp the
    // interval now, the target and the time left, "Ramp 5.9s>16s 0:42", or "Ramp 5s>16s in 9:41" while a planned one
    // waits for its start. "Ramp" instead of "Interval" keeps the line inside the 160 px of the screen.
    var intervalLine = function (st) {
        var r = st.ramp;
        if (!r) return "Interval~" + tenths(st.intervalMs) + "s " + st.port;
        var change = shortTime(tenths(st.intervalMs)) + ">" + shortTime(tenths(r.toMs));
        var wait = (r.startTime - Date.now()) / 1000;
        if (wait > 0) return "Ramp~" + change + " in " + clock(Math.ceil(wait));
        return "Ramp~" + change + " " + clock(Math.ceil(Math.max(0, wait + r.overMs / 1000)));
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

    // The ramp started from the status screen: target and time are
    // picked first, kept for the run, and start from the planned ramp's or the interval's values.
    var live = {toS: 1, overS: 60};
    cable.on('start', function () {
        live.toS = cable.settings.rampToS || cable.settings.intervalS;
        live.overS = cable.settings.rampOverS || 60;
    });

    // Starts the ramp (overS 0 = at once) and goes back to the status screen, two levels up.
    var rampAction = function (overS) {
        return {
            type: 'function',
            fn: function (arg, cb) {
                cable.ramp(live.toS, overS == null ? live.overS : overS, function (err) {
                    ui.back();
                    if (err) return ui.alert('Error', "Interval ramp failed:\n" + err);
                    ui.back();
                });
            }
        };
    };

    var liveRampMenu = {
        name: "interval ramp now",
        type: "menu",
        items: [{
            name: function () {
                return "Ramp To~" + shortTime(live.toS);
            },
            help: help.cableRampLive,
            action: pickMenu("Ramp To", live, 'toS', TIMES, timeValue, help.cableRampLive, true)
        }, {
            name: function () {
                return "Ramp Time~" + shortTime(live.overS);
            },
            help: help.cableRampLive,
            action: pickMenu("Ramp Time", live, 'overS', TIMES, timeValue, help.cableRampLive, true)
        }, {
            name: "Start Ramp",
            help: help.cableRampLive,
            action: rampAction()
        }, {
            name: "Set Now",
            help: help.cableRampNow,
            action: rampAction(0)
        }, {
            name: "Stop Ramp",
            help: help.cableRampStop,
            condition: function () {
                return !!cable.status.ramp;
            },
            action: {
                type: 'function',
                fn: function (arg, cb) {
                    cable.stopRamp(function (err) {
                        ui.back();
                        if (err) return ui.alert('Error', "Stopping the ramp failed:\n" + err);
                        ui.back();
                    });
                }
            }
        }]
    };

    // The ramp planned with the start, in the settings.
    var rampSettingsMenu = {
        name: "interval ramp",
        type: "menu",
        items: [{
            name: function () {
                return "Ramp To~" + (cable.settings.rampToS ? shortTime(cable.settings.rampToS) : "off");
            },
            help: help.cableRampTo,
            action: optionsMenu("Ramp To", 'rampToS', [0].concat(TIMES), function (v) {
                return v ? timeValue(v) : "off";
            }, help.cableRampTo, true)
        }, {
            name: function () {
                return "Ramp Time~" + shortTime(cable.settings.rampOverS);
            },
            help: help.cableRampTime,
            condition: function () {
                return cable.settings.rampToS > 0;
            },
            action: optionsMenu("Ramp Time", 'rampOverS', TIMES, timeValue, help.cableRampTime, true)
        }, {
            name: function () {
                return "Ramp After~" + (cable.settings.rampAfterS ? shortTime(cable.settings.rampAfterS) : "first shot");
            },
            help: help.cableRampAfter,
            condition: function () {
                return cable.settings.rampToS > 0;
            },
            action: optionsMenu("Ramp After", 'rampAfterS', [0].concat(TIMES), function (v) {
                return v ? timeValue(v) : "at the first shot";
            }, help.cableRampAfter, true)
        }]
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
                name: intervalLine(st),
                help: help.cableRampLive,
                action: liveRampMenu
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
            action: optionsMenu("Interval", 'intervalS', TIMES, timeValue, help.cableInterval, true)
        }, {
            name: function () {
                return "Interval Ramp~" + (cable.settings.rampToS > 0 ? "to " + shortTime(cable.settings.rampToS) : "off");
            },
            help: help.cableIntervalRamp,
            action: rampSettingsMenu
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
