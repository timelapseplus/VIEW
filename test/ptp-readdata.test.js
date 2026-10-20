'use strict';

var assert = require('assert');
var ptp = require('../camera/ptpjs/common/ptp-functions.js');

// A fake USB camera with node-usb's makeTransfer()/submit(): a command queues the data container and the response as
// 512-byte packets; each queued IN transfer fills the buffer it was given until it is full or a short packet (or a zero-
// length one, after data that ends on a packet boundary) ends it, in order, and a packet that would not fit is an overflow.
// sendLess: bytes of the data the camera announces but never sends.
function fakeCamera(payload, sendLess) {
    var maxPacket = 512, packets = [], queue = [], busy = false;
    var cam = {transactionId: 0, inFlight: 0, maxInFlight: 0, overflow: false};
    var container = function (type, code, tid, data, declared) {
        var b = new Buffer(12 + (data ? data.length : 0));
        b.writeUInt32LE(declared || b.length, 0);
        b.writeUInt16LE(type, 4);
        b.writeUInt16LE(code, 6);
        b.writeUInt32LE(tid, 8);
        if (data) data.copy(b, 12);
        return b;
    };
    var queuePackets = function (b) {
        for (var i = 0; i < b.length; i += maxPacket) packets.push(b.slice(i, Math.min(i + maxPacket, b.length)));
        if (b.length % maxPacket == 0) packets.push(new Buffer(0));
    };
    var serve = function () {
        if (busy || !queue.length || !packets.length) return;
        busy = true;
        setTimeout(function () {
            busy = false;
            var t = queue.shift(), filled = 0, err = null;
            while (packets.length && filled < t.buf.length) {
                var p = packets[0];
                if (p.length > t.buf.length - filled) {
                    err = new Error('overflow');
                    cam.overflow = true;
                    break;
                }
                p.copy(t.buf, filled);
                filled += p.length;
                packets.shift();
                if (p.length < maxPacket) break;
            }
            cam.inFlight--;
            t.cb(err, t.buf, filled);
            serve();
        }, 1);
    };
    var makeTransfer = function (timeout, cb) {
        return {
            submit: function (buf) {
                cam.inFlight++;
                if (cam.inFlight > cam.maxInFlight) cam.maxInFlight = cam.inFlight;
                queue.push({buf: buf, cb: cb});
                serve();
            }
        };
    };
    cam.ep = {
        out: {
            transfer: function (buf, cb) {
                var tid = buf.readUInt32LE(8), opcode = buf.readUInt16LE(6);
                var sent = sendLess ? payload.slice(0, payload.length - sendLess) : payload;
                queuePackets(container(2, opcode, tid, sent, 12 + payload.length));
                queuePackets(container(3, 0x2001, tid));
                setTimeout(function () { cb(null); }, 1);
            }
        },
        in: {
            descriptor: {wMaxPacketSize: maxPacket},
            makeTransfer: makeTransfer,
            transfer: function (length, cb) { // what InEndpoint.transfer() does in node-usb 1.2.0
                var buffer = new Buffer(length);
                makeTransfer(1000, function (err, buf, actual) { cb(err, buffer.slice(0, actual)); }).submit(buffer);
            }
        }
    };
    return cam;
}

function pattern(n) {
    var b = new Buffer(n);
    for (var i = 0; i < n; i++) b[i] = (i * 7 + (i >> 9)) & 0xff;
    return b;
}

function getObject(cam, callback) {
    var log = console.log, seen = null;
    console.log = function () {};
    ptp.transaction(cam, 0x1009, [0xffffc001], null, function (err, responseCode, data) {
        console.log = log;
        callback(err, responseCode, data, seen);
    }, function (data) {
        seen = data.length;
    });
}

describe('ptp data phase straight into one buffer', function () {
    this.timeout(20000);

    it('reads a RAW-sized object in 6 MB chunks, two in flight, without overflow', function (done) {
        var payload = pattern(13000000); // three chunks after the first packet
        var cam = fakeCamera(payload);
        getObject(cam, function (err, code, data, seen) {
            assert.ifError(err);
            assert.strictEqual(code, 0x2001);
            assert.strictEqual(data.length, payload.length);
            assert.ok(data.equals ? data.equals(payload) : data.toString('hex') === payload.toString('hex'), 'data differs');
            assert.strictEqual(seen, payload.length, 'onData got the whole object');
            assert.strictEqual(cam.maxInFlight, 2);
            assert.strictEqual(cam.overflow, false);
            done();
        });
    });

    it('reads an object that ends on a packet boundary, with its zero-length packet', function (done) {
        var payload = pattern(512 * 3000 - 12);
        var cam = fakeCamera(payload);
        getObject(cam, function (err, code, data) {
            assert.ifError(err);
            assert.strictEqual(code, 0x2001);
            assert.strictEqual(data.length, payload.length);
            assert.strictEqual(data[data.length - 1], payload[payload.length - 1]);
            assert.strictEqual(cam.overflow, false);
            done();
        });
    });

    it('takes the response from the queued read when the camera sends less than it announced', function (done) {
        var payload = pattern(13000000);
        var cam = fakeCamera(payload, 6000000); // the second chunk comes short, the third read gets the response
        getObject(cam, function (err, code, data) {
            assert.ifError(err);
            assert.strictEqual(code, 0x2001);
            assert.strictEqual(data.length, payload.length - 6000000);
            assert.strictEqual(data[data.length - 1], payload[payload.length - 6000001]);
            done();
        });
    });

    it('reads the response itself when the last chunk comes short', function (done) {
        var payload = pattern(7000000);
        var cam = fakeCamera(payload, 1000);
        getObject(cam, function (err, code, data) {
            assert.ifError(err);
            assert.strictEqual(code, 0x2001);
            assert.strictEqual(data.length, payload.length - 1000);
            done();
        });
    });

    it('reads a small object in one chunk', function (done) {
        var payload = pattern(1700);
        var cam = fakeCamera(payload);
        getObject(cam, function (err, code, data) {
            assert.ifError(err);
            assert.strictEqual(code, 0x2001);
            assert.strictEqual(data.toString('hex'), payload.toString('hex'));
            assert.strictEqual(cam.maxInFlight, 1);
            done();
        });
    });
});
