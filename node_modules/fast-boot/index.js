var Module = require('module')
  , fs = require('fs')
  , os = require('os')
  , path = require('path')
  , util = require('util');

var _resolveFilename = Module._resolveFilename;
var DEFAULT_STARTUP_FILE = path.normalize('./node_modules/module-locations-startup.json');
var DEFAULT_CACHE_FILE = path.join(os.tmpdir(), 'module-locations-cache.json') ;
var options = {
  startupFile: DEFAULT_STARTUP_FILE,
  cacheFile: DEFAULT_CACHE_FILE,
  cacheKiller: versionNumber(),
  statusCallback: function(message) {}
};
var filenameLookup = newFilenameLookup();
var cwd = process.cwd();
var stats = {
  cacheHit: 0,
  cacheMiss: 0,
  notCached: 0,
  loading: {
    startupFile: "did not attempted to load startup file",
    cacheFile: "did not attempted to load cache file"
  }
};

function toCanonicalPath(filename) {
  var relative = path.relative(cwd, filename);
  // do not cache files outside of the process.cwd() scope
  if (relative.indexOf("..") == 0)
    return undefined;

  return relative.replace("\\\\", "/")
}

function toAbsolutePath(filename) {
  return path.join(cwd, filename);
}

function resolveFilenameOptimized(request, parent) {
  var key = (toCanonicalPath(parent.id) + ":" + request );
  var canonical = filenameLookup[key];
  var filename = undefined;
  if (canonical)
    filename = toAbsolutePath(canonical);

  if (filename && fs.existsSync(filename)) {
    stats.cacheHit++;
    options.statusCallback(util.format("cache hit on module [%s]", filename));
    return filename;
  }
  else {
    filename = _resolveFilename.apply(Module, arguments);
    canonical = toCanonicalPath(filename);
    if (canonical && canonical.indexOf("node_modules") > -1) {
      filenameLookup[key] = canonical;
      scheduleSaveCache();
      options.statusCallback(util.format("cache miss on module [%s]", filename));
      stats.cacheMiss++;
    }
    else {
      options.statusCallback(util.format("module [%s] not cached", filename));
      stats.notCached++;
    }
    return filename;
  }
}

function loadModuleList() {

  stats.loading = {
    startupFile: "did not attempted to load startup file",
    cacheFile: "did not attempted to load cache file"
  };

  function tryLoadingFile(file, fileCaption, statsMember, fileLocation) {

    function report(message) {
      stats.loading[statsMember] = message;
      options.statusCallback(message);
    }

    try {
      if (fs.existsSync(file)) {
        var readFileNameLookup = JSON.parse(fs.readFileSync(file, 'utf-8'));
        if ((!options.cacheKiller) || (readFileNameLookup._cacheKiller === options.cacheKiller)) {
          filenameLookup = readFileNameLookup;
          report(util.format("loaded %s file from [%s]", fileCaption, fileLocation));
        }
        else
          report(util.format("dismissed %s file from [%s] because of different cache killer", fileCaption, fileLocation));
        return true;
      }
      report(util.format("%s file not found at [%s]", fileCaption, fileLocation));
      return false;
    }
    catch (e) {
      report(util.format("failed to load or parse %s file from [%s] with error [%s]", fileCaption, fileLocation, e));
      return false;
    }
  }

  tryLoadingFile(options.cacheFile, "cache", "cacheFile", options.cacheFile) ||
    tryLoadingFile(options.startupFile, "startup", "startupFile", options.startupFile) ||
    (filenameLookup = newFilenameLookup());
}

function start(opts) {
  if (opts) {
    if (opts.cacheFile)
      options.cacheFile = opts.cacheFile;
    if (opts.startupFile)
      options.startupFile = opts.startupFile;
    if (opts.cacheKiller) {
      options.cacheKiller = opts.cacheKiller;
      filenameLookup._cacheKiller = options.cacheKiller;
    }
    if (opts.statusCallback && typeof opts.statusCallback === 'function')
      options.statusCallback = opts.statusCallback;
  }
  Module._resolveFilename = resolveFilenameOptimized;
  loadModuleList();
}

function stop() {
  Module._resolveFilename = _resolveFilename;
  saveCache();
}

function saveCache(cb) {
  fs.writeFile(options.cacheFile, JSON.stringify(filenameLookup), onSaveError(cb, "cache", options.cacheFile));
  clearSaveCacheTimer();
}

function saveStartupList(cb) {
  fs.writeFile(options.startupFile, JSON.stringify(filenameLookup), onSaveError(cb));
}

function onSaveError(other, fileCaption, fileLocation) {
  return function handleSaveError(err) {
    if (err)
      options.statusCallback(util.format("failed to save %s file to [%s] with error [%s]", fileCaption, fileLocation, err));

    options.statusCallback(util.format("saved %s file to [%s]", fileCaption, fileLocation));

    if (other)
      other(err);
  }
}

var saveCacheTimer;
function clearSaveCacheTimer() {
  if (saveCacheTimer) {
    clearTimeout(saveCacheTimer);
    saveCacheTimer = null;
  }
}
function scheduleSaveCache() {
  clearSaveCacheTimer();
  saveCacheTimer = setTimeout(saveCache, 10*1000);
}

function versionNumber() {
  try {
    return require('./package.json').version.toString();
  }
  catch (e) {
    return undefined;                           }
}

function newFilenameLookup() {
  return {_cacheKiller: options.cacheKiller}
}

module.exports.loadModuleList = loadModuleList;
module.exports.start = start;
module.exports.stop = stop;
module.exports.saveCache = saveCache;
module.exports.saveStartupList = saveStartupList;
module.exports.DEFAULT_CACHE_FILE = DEFAULT_CACHE_FILE;
module.exports.DEFAULT_STARTUP_FILE = DEFAULT_STARTUP_FILE;
module.exports.stats = function () {
  return {
    cacheHit: stats.cacheHit,
    cacheMiss: stats.cacheMiss,
    notCached: stats.notCached,
    cacheKiller: filenameLookup._cacheKiller,
    loading: {
      startupFile: stats.loading.startupFile,
      cacheFile: stats.loading.cacheFile
    }
  }
};
