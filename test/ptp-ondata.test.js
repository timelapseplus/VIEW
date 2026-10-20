'use strict';

var assert = require('assert');
var ptp = require('../camera/ptpjs/common/ptp-functions.js');

// A fake USB camera for ptp.transaction: answers a command with a data container split over two IN transfers (as a
// large object arrives) and holds the response for responseDelayMs, like a Sony writing the RAW (doc §20).
function fakeCamera(payload, responseDelayMs, log) {
    var queue = [];
    var maxPacket = 512;
    var container = function (type, code, tid, data) {
        var b = new Buffer(12 + (data ? data.length : 0));
        b.writeUInt32LE(b.length, 0);
        b.writeUInt16LE(type, 4);
        b.writeUInt16LE(code, 6);
        b.writeUInt32LE(tid, 8);
        if (data) data.copy(b, 12);
        return b;
    };
    var cam = {
        transactionId: 0,
        ep: {
            out: {
                transfer: function (buf, cb) {
                    var opcode = buf.readUInt16LE(6), tid = buf.readUInt32LE(8);
                    log.push('cmd ' + opcode.toString(16));
                    var data = container(2, opcode, tid, payload);
                    queue.push({buf: data.slice(0, maxPacket)});
                    if (data.length > maxPacket) queue.push({buf: data.slice(maxPacket)});
                    queue.push({buf: container(3, 0x2001, tid), delay: responseDelayMs, response: true});
                    setTimeout(function () { cb(null); }, 1);
                }
            },
            in: {
                descriptor: {wMaxPacketSize: maxPacket},
                transfer: function (len, cb) {
                    var next = queue.shift();
                    setTimeout(function () {
                        if (next.response) log.push('response');
                        cb(null, next.buf.slice(0, len));
                    }, next.delay || 1);
                }
            }
        }
    };
    return cam;
}

describe('ptp transaction data before the response', function () {

    it('hands the data to onData before the response, the callback after it, the next transaction after that', function (done) {
        var payload = new Buffer(5000);
        for (var i = 0; i < payload.length; i++) payload[i] = i & 0xff;
        var log = [];
        var cam = fakeCamera(payload, 40, log);
        var log0 = console.log;
        console.log = function () {};
        ptp.transaction(cam, 0x1009, [0xffffc001], null, function (err, responseCode, data) {
            log.push('callback');
            assert.strictEqual(err, null);
            assert.strictEqual(responseCode, 0x2001);
            assert.strictEqual(data.length, payload.length);
        }, function (data) {
            log.push('data');
            assert.strictEqual(data.length, payload.length);
            assert.strictEqual(data[4999], 4999 & 0xff);
        });
        ptp.transaction(cam, 0x9209, [], null, function () {
            console.log = log0;
            // the second command goes out only after the first transaction's response
            assert.deepStrictEqual(log, ['cmd 1009', 'data', 'response', 'callback', 'cmd 9209', 'response']);
            done();
        });
    });

    it('works as before without onData', function (done) {
        var log = [];
        var cam = fakeCamera(new Buffer(300), 5, log);
        var log0 = console.log;
        console.log = function () {};
        ptp.getObject(cam, 0xffffc001, function (err, data) {
            console.log = log0;
            assert.strictEqual(err, null);
            assert.strictEqual(data.length, 300);
            assert.deepStrictEqual(log, ['cmd 1009', 'response']);
            done();
        });
    });
});
