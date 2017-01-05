'use strict';

var events = require('events'),
  fs = require('fs'),
  glob = require('glob'),
  util = require('util');

var EVENT_FILE_PREFIX = '/dev/input/by-path/platform-',
  EVENT_FILE_SUFFIX = '-event',
  EVENT_DATA_SIZE = 32,
  EVENT_TYPE_INDEX = 12,
  EVENT_CODE_INDEX = 10;

function Button(name) {
  var eventFilePattern;

  if (!(this instanceof Button)) {
    return new Button(name);
  }

  eventFilePattern = EVENT_FILE_PREFIX + name + EVENT_FILE_SUFFIX;

  glob(eventFilePattern, null, function (err, matches) {
    var data = new Buffer(0);

    if (err) {
      return this.emit('error', err);
    }

    if (matches.length === 0) {
      return this.emit('error', new Error('Event file \'' + eventFilePattern + '\' not found'));
    }

    if (matches.length > 1) {
      return this.emit('error', new Error('Multiple event files \'' + eventFilePattern + '\' found'));
    }

    fs.createReadStream(matches[0]).on('data', function (buf) {
      data = Buffer.concat([data, buf]);

      while (data.length >= EVENT_DATA_SIZE) {
        if (data[EVENT_TYPE_INDEX] === 0) {
          this.emit('release', data[EVENT_CODE_INDEX]);
        } else if (data[EVENT_TYPE_INDEX] === 1) {
          this.emit('press', data[EVENT_CODE_INDEX]);
        }   

        data = data.slice(EVENT_DATA_SIZE);
      }

    }.bind(this));

// TODO: handle errors from stream

    this.emit('ready');
  }.bind(this));
}

util.inherits(Button, events.EventEmitter);

module.exports = Button;

