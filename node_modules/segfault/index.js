
// The 'bindings' helper will try all the well-known paths that the module might compile to based on platform / version / debug / etc
var bindings = require('bindings')('segfault-handler');
var fs = require('fs');

module.exports = {

    registerHandler: function (dir) {
        if (typeof dir != "string" || !dir || dir.length > 64) {
            dir = ".";
        }

        try {
            fs.mkdirSync(dir);
        } catch (e) {
            if (!(e && e.code == 'EEXIST')) {
                throw e;
            }
        }

        bindings.registerHandler(dir);
    },

    causeSegfault: bindings.causeSegfault,
    causeAbort: bindings.causeAbort,
    causeIllegalInstruction: bindings.causeIllegalInstruction
};

