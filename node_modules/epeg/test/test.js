var assert = require('assert');
var expect = require('expect.js');
var fs = require('fs');
var epeg = require('../index');

var output_path = "test/fixtures/output.jpg";

describe('epeg.Image', function(){
    beforeEach(function(done){
        if (fs.existsSync(output_path)) {
            fs.unlinkSync(output_path);
        }
        done();
    });

    describe('#new()', function(){
        it('should throw an exception when parameters are wrong', function(){
            expect(function() { new epeg.Image(); }).to.throwException();
            expect(function() { new epeg.Image({}); }).to.throwException();
            expect(function() { new epeg.Image({lol: "whatever"}); }).to.throwException();
        })

        it('should throw an exception when the path is not valid', function(){
            expect(function() { new epeg.Image({path: "whatever"}); }).to.throwException();
        });

        it('should throw an exception when the buffer is not valid', function(){
            buffer = new Buffer("");
            expect(function() { new epeg.Image({data: buffer}); }).to.throwException();
        });

        it('should open valid image path', function(){
            expect(new epeg.Image({path: "test/fixtures/test.jpg"})).to.be.ok();
        });

        it('should parse valid buffers', function() {
            fs.readFile("test/fixtures/test.jpg", function(err, data) {
                expect(new epeg.Image({data: data})).to.be.ok();
            });
        });
    });
    describe("#width and #height", function() {
        it('should get image size', function(){
            var image = new epeg.Image({path: "test/fixtures/test.jpg"});
            assert.equal(image.width, 500);
            assert.equal(image.height, 500);
        });
    });
    describe("#downsize", function() {
        it('downsize image', function(){
            var image = new epeg.Image({path: "test/fixtures/test.jpg"});
            image.downsize(100, 100).saveTo(output_path);

            var output = new epeg.Image({path: output_path});
            assert.equal(output.width, 100);
            assert.equal(output.height, 100);
        });

        it('thrown an exception when parameters are negative', function() {
            var image = new epeg.Image({path: "test/fixtures/test.jpg"});
            expect(function() { image.downsize(-100, -100); }).to.throwException();
        });
        it('thrown an exception when parameters are bigger than the image size', function() {
            var image = new epeg.Image({path: "test/fixtures/test.jpg"});
            expect(function() { image.downsize(600, 600); }).to.throwException
        });
        it('thrown an exception when parameters are missing', function() {
            var image = new epeg.Image({path: "test/fixtures/test.jpg"});
            expect(function() { image.downsize(); }).to.throwException();
        });
        it('thrown an exception when parameters are not numbers', function() {
            expect(function() { image.downsize("lol", "lol"); }).to.throwException();
        });
        it('thrown an exception when the image was already downsized', function() {
            expect(function() { image.downsize(100, 100).downsize(50, 50); }).to.throwException();
        });
        it('thrown an exception when the image was already croped', function() {
            expect(function() { image.croped(100, 100, 50, 50).downsize(50, 50); }).to.throwException();
        });
    });
    describe("#crop", function() {
        it('crop image', function(){
            var image = new epeg.Image({path: "test/fixtures/test.jpg"});
            image.crop(100, 100, 50, 50).saveTo(output_path);

            var output = new epeg.Image({path: output_path});
            assert.equal(output.width, 50);
            assert.equal(output.height, 50);
        });

        it('thrown an exception when parameters are negative', function() {
            var image = new epeg.Image({path: "test/fixtures/test.jpg"});
            expect(function() { image.crop(-100, -100, -50, -50); }).to.throwException();
        });
        it('thrown an exception when parameters are bigger than the image size', function() {
            var image = new epeg.Image({path: "test/fixtures/test.jpg"});
            expect(function() { image.crop(0, 0, 600, 600); }).to.throwException
            expect(function() { image.crop(450, 450, 100, 100); }).to.throwException
            expect(function() { image.crop(600, 600, 100, 100); }).to.throwException
        });
        it('thrown an exception when parameters are missing', function() {
            var image = new epeg.Image({path: "test/fixtures/test.jpg"});
            expect(function() { image.crop(); }).to.throwException();
        });
        it('thrown an exception when parameters are not numbers', function() {
            expect(function() { image.crop("lol", "lol", "lol", "lol"); }).to.throwException();
        });
        it('thrown an exception when the image was already croped', function() {
            expect(function() { image.crop(100, 100, 200, 200).crop(100, 100, 50, 50); }).to.throwException();
        });
        it('thrown an exception when the image was already downsized', function() {
            expect(function() { image.downsize(100, 10).crop(100, 100, 50, 50); }).to.throwException();
        });
    });
    describe("#saveTo", function() {
        it('save to a file', function() {
            var image = new epeg.Image({path: "test/fixtures/test.jpg"});
            image.downsize(500, 500).saveTo(output_path);

            var output = new epeg.Image({path: output_path});
            assert.equal(output.width, 500);
            assert.equal(output.height, 500);
        });
    });
    describe("#process", function() {
        it('save to a buffer', function() {
            var image = new epeg.Image({path: "test/fixtures/test.jpg"});
            buffer = image.downsize(500, 500).process();
            fs.writeFileSync(output_path, buffer);

            var output = new epeg.Image({path: output_path});
            assert.equal(output.width, 500);
            assert.equal(output.height, 500);
        });
    });
})
