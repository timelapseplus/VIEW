#!/usr/bin/env node
var SegfaultHandler = require('./'); // you'd use require('segfault-handler')

SegfaultHandler.registerHandler("traces");

// SegfaultHandler.causeAbort(); // simulates a buggy native module that asserts false
SegfaultHandler.causeSegfault(); // simulates a buggy native module that dereferences NULL
