'use strict';

// The two AUX jack lines as sysfs GPIOs, written synchronously from an already open fd (one syscall per edge,
// no libuv pool). The kernel serialises sysfs writes with its own lock, unlike the /dev/mem read-modify-write
// that node-aux2out and node-bulb do on the whole port D register.
//
// Pin map (docs/2026-10-19-cable-release-research.md §5.2, verified on the unit 2026-10-21): AUX1 tip
// PD20 = 116 and ring PD19 = 115 drive their switch with a HIGH level; AUX2 tip PD15 = 111 and ring PD14 = 110
// close with a LOW level (idle high, the way node-aux2out leaves them). "closed" below always means the jack
// line is shorted to the sleeve, i.e. the camera sees the button pressed.

var fs = require('fs');

var BASE = '/sys/class/gpio';

var PORTS = {
    AUX1: {shutter: {gpio: 116, active: 1}, focus: {gpio: 115, active: 1}},
    AUX2: {shutter: {gpio: 111, active: 0}, focus: {gpio: 110, active: 0}}
};

// spec = {gpio, active}; opts.fs and opts.base are for the tests
function Line(spec, opts) {
    opts = opts || {};
    this.gpio = spec.gpio;
    this.active = spec.active ? 1 : 0;
    this.fs = opts.fs || fs;
    this.base = opts.base || BASE;
    this.fd = null;
    this.closed = false;
}

// Exports the pin if needed, sets it as an output in the released state and keeps /value open.
Line.prototype.open = function () {
    var dir = this.base + '/gpio' + this.gpio;
    if (!this.fs.existsSync(dir)) {
        try {
            this.fs.writeFileSync(this.base + '/export', String(this.gpio));
        } catch (e) {
            if (e.code != 'EBUSY') throw e; // EBUSY = exported by someone else already, that's fine
        }
    }
    // 'out' makes the pin an output driving low, 'high' an output driving high: both set the released level
    // and the direction in one write, so the line never passes through the closed state.
    this.fs.writeFileSync(dir + '/direction', this.active ? 'out' : 'high');
    this.fd = this.fs.openSync(dir + '/value', 'w');
    this.closed = false;
};

Line.prototype.set = function (closed) {
    if (this.fd == null) throw new Error('gpio ' + this.gpio + ' is not open');
    var level = closed ? this.active : 1 - this.active;
    this.fs.writeSync(this.fd, String(level), 0, 'utf8'); // always at offset 0: sysfs attributes are rewritten whole
    this.closed = !!closed;
};

// Releases the line and closes the fd; safe to call twice. Never throws: it runs on every exit path.
Line.prototype.release = function () {
    if (this.fd == null) return;
    try {
        this.set(false);
    } catch (e) {}
    try {
        this.fs.closeSync(this.fd);
    } catch (e) {}
    this.fd = null;
};

module.exports = {
    PORTS: PORTS,
    Line: Line
};
