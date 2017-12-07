"use strict";
var chai = require('chai');
var expect = chai.expect;
var fs = require('fs');
var childProcess = require('child_process');
var nodeModuleCache = require("../");
var util = require('util');

describe("fast-boot", function () {

  beforeEach(function () {
    deleteCacheFile();
    deleteStartupFile();
  });

  it("should not prevent loading NPM modules", function(done) {
    var child = runChild("1.0.0", "loadExpress");
    child.on("message", function(data) {

      logStuff("first", "1.0.0", data);
      expect(data.statSyncCount).to.be.above(100);
      expect(data.readFileSyncCount).to.be.above(100);
      expect(data.loadingStats.startupFile).to.match(/^failed to load or parse startup file from/);
      expect(data.loadingStats.cacheFile).to.match(/^failed to load or parse cache file from/);

      var moduleLocationsCache = loadModuleLocationsCache();
      expect(moduleLocationsCache).to.satisfy(noNonNodeModulesPaths);
      done();
    })
  });

  it("should not search for files again on second invocation of node", function(done) {
    var child = runChild("1.0.0", "loadExpress");
    child.on("message", function(data) {

      logStuff("first", "1.0.0", data);

      var child2 = runChild("1.0.0", "loadExpress");
      child2.on("message", function(data2) {

        logStuff("second", "1.0.0", data2);
        expect(data2.cacheMiss).to.be.equal(0);
        expect(data.statSyncCount).to.be.above(data2.statSyncCount);
        expect(data.readFileSyncCount).to.be.above(data2.readFileSyncCount);
        expect(data2.loadingStats.startupFile).to.match(/^not attempted to load/);
        expect(data2.loadingStats.cacheFile).to.match(/^loaded cache file from/);

        done();
      })
    })
  });

  it("should not cache if using a different cache killer (the version parameter)", function(done) {
    var child = runChild("1.0.0", "loadExpress");
    child.on("message", function(data) {

      logStuff("first", "1.0.0", data);

      var child2 = runChild("1.0.1", "loadExpress");
      child2.on("message", function(data2) {

        logStuff("second", "1.0.1", data2);
        expect(data2.cacheMiss).not.to.be.equal(0);
        expect(data.statSyncCount).to.be.equal(data2.statSyncCount);
        expect(data.readFileSyncCount).to.be.equal(data2.readFileSyncCount);

        done();
      })
    })
  });

  it("should not cache project modules", function(done) {
    var child = runChild("1.0.0", "loadExpressAndProjectModule");
    child.on("message", function(data) {

      logStuff("first", "1.0.0", data);

      var child2 = runChild("1.0.0", "loadExpressAndProjectModule");
      child2.on("message", function(data2) {

        logStuff("second", "1.0.0", data2);
        expect(data2.cacheMiss).to.be.equal(0);
        expect(data.statSyncCount).to.be.above(data2.statSyncCount);
        expect(data.readFileSyncCount).to.be.above(data2.readFileSyncCount);

        var moduleLocationsCache = loadModuleLocationsCache();
        expect(moduleLocationsCache).to.satisfy(noNonNodeModulesPaths);
        done();
      })
    })
  });

  it("should load module locations from startup list", function(done) {
    var child = runChild("1.0.0", "loadExpressAndSaveStartup");
    child.on("message", function(data) {

      logStuff("first", "1.0.0", data);
      deleteCacheFile();

      var child2 = runChild("1.0.0", "loadExpress");
      child2.on("message", function(data2) {

        logStuff("second", "1.0.0", data2);
        expect(data2.cacheMiss).to.be.equal(0);
        expect(data.statSyncCount).to.be.above(data2.statSyncCount);
        expect(data.readFileSyncCount).to.be.above(data2.readFileSyncCount);

        done();
      })
    })
  });

  it("should load base modules from startup, adding more to cache if needed", function(done) {
    var child = runChild("1.0.0", "loadExpressAndSaveStartup");
    child.on("message", function(data) {

      logStuff("first", "1.0.0", data);
      deleteCacheFile();

      var child2 = runChild("1.0.0", "loadExpress");
      child2.on("message", function(data2) {

        logStuff("second", "1.0.0", data2);
        expect(data2.cacheMiss).to.be.equal(0);

        var child3 = runChild("1.0.0", "loadExpressAndBrowserify");
        child3.on("message", function(data3) {

          logStuff("second", "1.0.0", data3);
          expect(data3.cacheMiss).not.to.be.equal(0);

          done();
        })
      })
    })
  });

  it("should recover from invalid startup file", function(done) {
    fs.writeFileSync(nodeModuleCache.DEFAULT_STARTUP_FILE, "bla bla bla");
    var child = runChild("1.0.0", "loadExpress");
    child.on("message", function(data) {

      logStuff("first", "1.0.0", data);
      expect(data.statSyncCount).to.exist;
      done();
    })
  });

  it("should recover from invalid cache file", function(done) {
    fs.writeFileSync(nodeModuleCache.DEFAULT_CACHE_FILE, "bla bla bla");
    var child = runChild("1.0.0", "loadExpress");
    child.on("message", function(data) {

      logStuff("first", "1.0.0", data);
      expect(data.statSyncCount).to.exist;
      done();
    })
  });

  it("should recover from startup file with wrong path", function(done) {
    fs.writeFileSync(nodeModuleCache.DEFAULT_STARTUP_FILE, JSON.stringify({
      "_cacheKiller":"1.0.0",
      "express:.":"non-existant-path"
    }));
    var child = runChild("1.0.0", "loadExpress");
    child.on("message", function(data) {

      logStuff("first", "1.0.0", data);
      expect(data.statSyncCount).to.exist;
      done();
    })
  });

  it("should recover from cache file with wrong path", function(done) {
    fs.writeFileSync(nodeModuleCache.DEFAULT_CACHE_FILE, JSON.stringify({
      "_cacheKiller":"1.0.0",
      "express:.":"non-existant-path"
    }));
    var child = runChild("1.0.0", "loadExpress");
    child.on("message", function(data) {

      logStuff("first", "1.0.0", data);
      expect(data.statSyncCount).to.exist;
      done();
    })
  });

});


function loadModuleLocationsCache() {
  var content = fs.readFileSync(nodeModuleCache.DEFAULT_CACHE_FILE);
  return JSON.parse(content);
}

function noNonNodeModulesPaths(moduleLocationsCache) {
  var keys = Object.keys(moduleLocationsCache);
  for (var index in keys) {
    var key = keys[index];
    if (key != "_cacheKiller")
    if (moduleLocationsCache[key] && moduleLocationsCache[key].indexOf("node_modules") == -1)
      return false;
  }
  return true;
}

function runChild(version, command) {
  return childProcess.fork("./test/test-app.js", [version, command]);
}

function hrTimeToSecString(hrTime) {
  return hrTime[0] + "." + String('000000000'+hrTime[1]).slice(-9)
}

function logStuff(run, version, data) {
  console.log(util.format("        - %s run  [%s]: %s Sec, statSync: %d, readFileSync: %d, existsSyncCount: %d", run, version,
    hrTimeToSecString(data.loadingTime), data.statSyncCount, data.readFileSyncCount, data.existsSyncCount));

}

function deleteCacheFile() {
  try {
    fs.unlinkSync(nodeModuleCache.DEFAULT_CACHE_FILE);
  }
  catch (e) {
  }
}

function deleteStartupFile() {
  try {
    fs.unlinkSync(nodeModuleCache.DEFAULT_STARTUP_FILE);
  }
  catch (e) {
  }
}
