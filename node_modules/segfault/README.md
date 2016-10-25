# Overview

This module catches segfaults and sigaborts. It's useful for debugging native Node.js C/C++ code, and is safe to use in a production environment.

Normally when a C program crashes, the only way to tell is to examine /var/log/syslog at the time of the crash, with this addons installed it writes
a report to the filesystem and to STDERR.

```javascript

var Segfault = require('segfault');

Segfault.registerHandler("/path/to/write/segfaults");

Segfault.causeSegfault(); // simulates a buggy native module that dereferences NULL

```

Obviously, you would only include the first two lines in your own code; the third is for testing purposes and to demonstrate functionality.

After running the above sample, you will see a stacktrace that looks like:

```
PID 67926 received SIGSEGV for address: 0x0
0   segfault-handler-native.node        0x00000001007e83d6 _ZL16segfault_handleriP9__siginfoPv + 235
1   libSystem.B.dylib                   0x00007fff844d11ba _sigtramp + 26
2   ???                                 0x00007fff5fc404a0 0x0 + 140734800069792
3   segfault-handler-native.node        0x00000001007e80fd _Z22segfault_stack_frame_2v + 9
4   segfault-handler-native.node        0x00000001007e82d4 _Z13CauseSegfaultRKN2v89ArgumentsE + 17
5   node                                0x00000001000a45de _ZN2v88internalL21Builtin_HandleApiCallENS0_12_GLOBAL__N_116BuiltinArgumentsILNS0_21BuiltinExtraArgumentsE1EEEPNS0_7IsolateE + 430
```

Now you can start debugging using tools like "objdump -dS module.node" to try and sort out what the stack actually means.  Sometimes, just identifying _which_ native module is causing problems is the biggest win.

Cheers, enjoy.  And happy hunting.

# Installing

```
npm install segfault --save
```

# License

This is a slight modification of the [node-segfault-handler](https://github.com/ddopson/node-segfault-handler) code, thanks Dave!.

This software is licensed for use under the [WTFPL](http://en.wikipedia.org/wiki/WTFPL); version 2 if it's a lawyer asking.  Though if you make good use of this or any of my other tools, I'd appreciate an email letting me know what you used it for or how you stumbled across it.


   ---  Dave
