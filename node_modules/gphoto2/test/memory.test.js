var GPhoto2 = require('../build/Release/gphoto2');
var should = require('should');

var rssMemoryUsageInMB = function () {
    return (process.memoryUsage().rss / (1024 * 1024));
};

var list = function (repeatsLeft, done) {
    var gphoto2 = new GPhoto2.GPhoto2();
    gphoto2.list(function (cameraHandlers) {
        // console.log(rssMemoryUsageInMB().toFixed(5) + ' Mb');
        cameraHandlers.forEach(function (cameraHandler) {
            cameraHandler.close();
        });

        repeatsLeft--;
        if (repeatsLeft > 0) {
            list(repeatsLeft, done);
        } else {
            done();
        }
    })
};

describe('multiple calling gphoto list method', function () {
    it('should not increase memory usage that much', function (done) {
        this.timeout(20 * 1000);
        var initialMemory = rssMemoryUsageInMB();
        var repeats = 100;

        list(repeats, function () {
            var finalMemory = rssMemoryUsageInMB();
            var memoryIncrease = finalMemory - initialMemory;
            var memoryIncreasePerCall = memoryIncrease / repeats;
            console.log('Repeats: ' + repeats + '; Total memory increase: ' + memoryIncrease + ' Mb; Memory increase per call: ' + memoryIncreasePerCall + ' Mb');
            memoryIncreasePerCall.should.be.below(1, 'each call should be increasing memory usage by max 1 Mb');
            done();
        });
    });
});
