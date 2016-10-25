var GPhoto2 = require('../build/Release/gphoto2');
var should = require('should');
var _ = require('lodash');
var child_process = require('child_process');

var obj = {};

describe('gphoto library', function () {
    before(function () {
        child_process.exec('killall PTPCamera');
    });

    it('should list multiple cameras', function (done) {
        this.timeout(1000);
        var gphoto2 = new GPhoto2.GPhoto2();
        gphoto2.list(function (cameraHandlers) {
            cameraHandlers.length.should.be.above(1);
            obj.cameraHandlers = cameraHandlers;
            done();
        });
    });

    it('should get serial number of each camera', function (done) {
        this.timeout(1000);
        var doneCount = obj.cameraHandlers.length;
        obj.cameraHandlers.forEach(function (cameraHandler) {
            cameraHandler.getConfig(function (error, settings) {
                should.equal(error, undefined, 'error occurred while getting camera config');
                var serialNumber = _.get(settings, 'main.children.status.children.serialnumber.value', null);
                should.notEqual(serialNumber, null, 'serial number is in settings');
                should.ok(typeof serialNumber === 'string' && serialNumber !== '', 'serial number isn\'t non-empty string');

                cameraHandler.close();
                doneCount--;
                if (doneCount === 0) {
                    done();
                }
            });
        });
    });
});