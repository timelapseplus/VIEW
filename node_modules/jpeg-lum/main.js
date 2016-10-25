#!/usr/bin/env node

var jpeg = require('./build/Release/jpeglum')
  , fs   = require('fs');

exports.read = jpeg.read;