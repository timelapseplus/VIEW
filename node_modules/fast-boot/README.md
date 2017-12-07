[![NPM version](https://img.shields.io/npm/v/fast-boot.svg)](https://www.npmjs.com/package/fast-boot)
![License](https://img.shields.io/npm/l/express.svg)

# fast-boot
When Node.js starts, a lot of the time is wasted on loading module files. Of the module loading time, most of the work is
actually searching for the module file on the filesystem. When you require a module, node will look for it at the ```node_modules```
folder relative to the requesting module. If not found there, it will start stepping up the folder hierarchy looking
for the module in each of the parent folders ```node_modules``` folder.

This search scheme makes node.js do a lot ```fs.statSync``` operations - an operation that throws an exception is the module file
does not exist.

Fast boot caches the location of module files those speeding the loading of the node.js process. By caching the locations, we
reduce the number of io operations significantly.

For example, loading of an Express application (with no other modules) without fast-boot compared to with fast-boot -

                  | without fast-boot   | with fast-boot
----------------- | ------------------- | ---------------
fs.statSync       |    713              | 0
fs.readFileSync   |    152              | 62
fs.existsSync     |     7               | 103
loading time      |    93 mSec          | 60 mSec

Note that the loading times are measured on a Mac Pro with SSD - on an actual VM running on hardware with spin disk the
loading times will be considerably larger.

The module hooks into the node module 'module' and wraps the ```_resolveFilename``` method, caching the files it finds
in order to improve node loading performance. Node does tons of file lookups as it resolves modules and does not cache
the found file locations.

fast-boot caches only modules located in the the projects ```node_modules``` directory.

fast-boot supports two patterns of working:

# cache only

The first time the application runs, fast-boot learns what modules are loaded and saves the list of those modules
as a cache file (located by default in the tmp folder). The second time the application loads it uses the cache file
and loads faster. It is assumed the cache file is located on a read/write enabled drive.

# startup and cache file

We can also improve the performance of the first time the application loads using a startup file. The startup file
is assumed to be created using a build step and distributed with the application sources, assumed to be read-only.
To create the startup file, load the application with all the modules and call ```saveStartupList()```. By default,
the startup file is saved in the project ```node_modules``` folder.

Once the application loads using the startup file, any additional modules loaded not in the startup file will cause
fast-boot to save a cache file in tmp.

# Reference:

## nodeModuleCache.start([opts])


Starts the caching

```
var nodeModuleCache = require("fast-boot");
nodeModuleCache.start(opts);
```

Start accepts an options parameter with two options
   * ```cacheFile``` - alternate cache file location. Defaults to ```{os.tmpdir()}/module-locations-cache.json```
   * ```startupFile``` - alternate startup file location. Defaults to ```./node_modules/module-locations-cache.json```, relative to the ```process.cwd()```
   * ```cacheKiller``` - used to invalidate the cache. Normally one will pass the application version number assuming that a different version
   * ```statusCallback``` - callback function called each time fast boot loads or saves. ```function(message)```
   may have different version of dependencies making modules located in different locations. The default is the version number from package.json,
   if one exists

## nodeModuleCache.stop()

stops the module

```
nodeModuleCache.stop();
```

## nodeModuleCache.saveCache(callback)

saves the cache file. Callback is called after completed save with signature ```function(err) {}```

```
nodeModuleCache.saveCache();
```

## nodeModuleCache.saveStartupList(callback)

saves the startup file. Callback is called after completed save with signature ```function(err) {}```

```
nodeModuleCache.saveStartupList();
```

## nodeModuleCache.loadModuleList()

reloads the modules list from the cache file (if exists) or the startup file (if exists)

```
nodeModuleCache.loadModuleList();
```

## nodeModuleCache.stats()

returns a statistics object about the caching effectiveness. The stats object include the following members

* cacheHit - the number of modules who's locations were found in the cache
* cacheMiss - the number of modules who's locations were not found in the cache - and were added to the cache file
* notCached - the number of modules not to be cached - either not in a node_modules folder or not under process.cwd()
* cacheKiller - the current value of the cache killer
* statusCallback.startupFile - most recent status of loading a startup file
* statusCallback.cacheFile - most recent status of loading a cache file

```
var stats = nodeModuleCache.stats();
console.log(stats.cacheHit);
console.log(stats.cacheMiss);
console.log(stats.notCached);
```
