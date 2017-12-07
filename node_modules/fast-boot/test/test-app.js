var start = process.hrtime();
var fastBoot = require("../");
var fs = require('fs');

var version = "0.0.1";
var command;
if (process.argv.length > 2)
  version = process.argv[2];

if (process.argv.length > 3)
  command = process.argv[3];

var statusLog = [];
fastBoot.start({
  cacheKiller: version,
  statusCallback: function (message) {
    statusLog.push(message);
  }
});

var orig = {};

orig.statSync = fs.statSync;
var statSyncCount = 0;
fs.statSync = function(path) {
  statSyncCount++;
  return orig.statSync(path);
};

orig.readFileSync = fs.readFileSync;
var readFileSyncCount = 0;
fs.readFileSync = function(path, opts) {
  readFileSyncCount++;
  return orig.readFileSync(path, opts);
};

orig.existsSync = fs.existsSync;
var existsSyncCount = 0;
fs.existsSync = function(path) {
  existsSyncCount++;
  return orig.existsSync(path);
};

if (command === "loadExpress") {
  var express = require('express')();
  fastBoot.saveCache(sendStatus);
}
else if (command === "loadExpressAndProjectModule"){
  var testModule = require("./test-module");
  var express = require('express')();
  fastBoot.saveCache(sendStatus);
}
else if (command === "loadExpressAndSaveStartup"){
  var express = require('express')();
  fastBoot.saveStartupList(function() {
    fastBoot.saveCache(sendStatus);
  });
}
else if (command === "loadExpressAndBrowserify"){
  var express = require('express')();
  var browserify = require('browserify');
  fastBoot.saveCache(sendStatus);
}

function sendStatus(err) {

  if (err)
    console.log(err);

  var stats = fastBoot.stats();
  if (process.send)
    process.send({
      statSyncCount: statSyncCount,
      readFileSyncCount: readFileSyncCount,
      existsSyncCount: existsSyncCount,
      loadingTime: process.hrtime(start),
      cacheHit: stats.cacheHit,
      cacheMiss: stats.cacheMiss,
      notCached: stats.notCached,
      loadingStats: stats.loading,
      statusLog: statusLog
    });
  else {
    console.log({
      statSyncCount: statSyncCount,
      readFileSyncCount: readFileSyncCount,
      existsSyncCount: existsSyncCount,
      loadingTime: process.hrtime(start),
      cacheHit: stats.cacheHit,
      cacheMiss: stats.cacheMiss,
      notCached: stats.notCached,
      loadingStats: stats.loading,
      statusLog: statusLog
    })
  }
}