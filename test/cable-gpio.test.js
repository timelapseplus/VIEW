'use strict';

var assert = require('assert');
var gpio = require('../cable/gpio.js');

// A sysfs stand-in: remembers the files written and whether the gpioN directory "exists".
function fakeFs(exported) {
    var writes = [];
    var fds = {};
    var nextFd = 10;
    return {
        writes: writes,
        existsSync: function (p) {
            return exported.indexOf(p) >= 0;
        },
        writeFileSync: function (p, data) {
            if (/\/export$/.test(p)) {
                var dir = p.replace(/export$/, 'gpio' + data);
                if (exported.indexOf(dir) >= 0) {
                    var e = new Error('EBUSY');
                    e.code = 'EBUSY';
                    throw e;
                }
                exported.push(dir);
            }
            writes.push({path: p, data: String(data)});
        },
        openSync: function (p) {
            fds[nextFd] = p;
            return nextFd++;
        },
        writeSync: function (fd, data, pos, enc) {
            writes.push({path: fds[fd], data: String(data), pos: pos});
            return data.length;
        },
        closeSync: function (fd) {
            writes.push({path: fds[fd], data: 'close'});
            delete fds[fd];
        }
    };
}

describe('cable gpio', function () {
    it('AUX1 lines: export, direction "out" (released = low), closed = 1 written at offset 0', function () {
        var fs = fakeFs([]);
        var line = new gpio.Line(gpio.PORTS.AUX1.shutter, {fs: fs, base: '/g'});
        line.open();
        line.set(true);
        line.set(false);
        assert.deepEqual(fs.writes, [
            {path: '/g/export', data: '116'},
            {path: '/g/gpio116/direction', data: 'out'},
            {path: '/g/gpio116/value', data: '1', pos: 0},
            {path: '/g/gpio116/value', data: '0', pos: 0}
        ]);
    });

    it('AUX2 lines: direction "high" (released = high), closed = 0', function () {
        var fs = fakeFs(['/g/gpio111']); // already exported by someone
        var line = new gpio.Line(gpio.PORTS.AUX2.shutter, {fs: fs, base: '/g'});
        line.open();
        line.set(true);
        assert.deepEqual(fs.writes, [
            {path: '/g/gpio111/direction', data: 'high'},
            {path: '/g/gpio111/value', data: '0', pos: 0}
        ]);
    });

    it('ignores EBUSY from export and still configures the pin', function () {
        var exported = [];
        var fs = fakeFs(exported);
        fs.existsSync = function () {
            return false; // the directory check says "missing" but export says EBUSY
        };
        exported.push('/g/gpio115');
        var line = new gpio.Line(gpio.PORTS.AUX1.focus, {fs: fs, base: '/g'});
        line.open();
        assert.equal(fs.writes[0].path, '/g/gpio115/direction');
    });

    it('release writes the idle level, closes the fd and is safe to repeat', function () {
        var fs = fakeFs([]);
        var line = new gpio.Line(gpio.PORTS.AUX1.shutter, {fs: fs, base: '/g'});
        line.open();
        line.set(true);
        line.release();
        line.release();
        assert.deepEqual(fs.writes.slice(-2), [
            {path: '/g/gpio116/value', data: '0', pos: 0},
            {path: '/g/gpio116/value', data: 'close'}
        ]);
        assert.throws(function () {
            line.set(true);
        });
    });

    it('pin numbers follow port x 32 + pin', function () {
        assert.equal(gpio.PORTS.AUX1.shutter.gpio, 96 + 20);
        assert.equal(gpio.PORTS.AUX1.focus.gpio, 96 + 19);
        assert.equal(gpio.PORTS.AUX2.shutter.gpio, 96 + 15);
        assert.equal(gpio.PORTS.AUX2.focus.gpio, 96 + 14);
    });
});
