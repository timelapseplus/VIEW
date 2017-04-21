require('rootpath')();
var LISTS = require('camera/ptp/lists.js');

function Exposure(options) {
    this.shutterEv = 0;
    this.apertureEv = 0;
    this.isoEv = 0;
    this.usingIso = true;
    this.usingShutter = true;
    this.usingAperture = false;
    this.bulbMode = true;

    if (!options.camera || !options.camera.ptp) {
        throw new Error("camera parameter is required");
    }

    if (options && typeof options === 'object') {
        for (key in options) {
            this[key] = options[key];
        }
    }

    if (this.bulbMode && this.bulbMaxMs === undefined) {
        if (this.camera.bulbMaxMs) {
            this.bulbMaxMs = this.camera.bulbMaxMs;
        } else {
            throw new Error("bulbMaxMs parameter is required with bulbMode");
        }
    }

    if (this.bulbMode && this.bulbMinMs === undefined) {
        if (this.camera.bulbMinMs) {
            this.bulbMinMs = this.camera.bulbMinMs;
        } else {
            throw new Error("bulbMinMs parameter is required with bulbMode");
        }
    }

}

exposure.prototype.ev = function() {
    return this.shutterEv + this.apertureEv + this.isoEv;
}

exposure.prototype.setEv = function(ev) {
    var aEv = this.usingAperture ? LISTS.smallestAperture().ev : this.apertureEv;
    var sEv = this.usingShutter ? LISTS.longestShutter().ev : this.shutterEv;
    var iEv = this.usingIso ? LISTS.lowestISO().ev : this.isoEv;

    if (this.bulbMode) sEv = LISTS.(ev - LISTS.getEv(sEv, aEv, iEv));
    if (this.usingShutter && !this.bulbMode) sEv = this._valueShift(ev - LISTS.getEv(sEv, aEv, iEv), 'iso');
    if (this.usingAperture) aEv = this._valueShift(ev - LISTS.getEv(sEv, aEv, iEv), 'iso');
    if (this.usingIso) iEv = this._valueShift(ev - LISTS.getEv(sEv, aEv, iEv), 'iso');


    return this;
}

exposure.prototype._valueShift = function(stops, paramKey) {
    var list = this.camera.ptp.settings.lists[paramKey];
    if (!list) return null;
    var currentEV = this[paramKey + 'Ev'];
    var newEv = currentEV;

    for (var i = 0; i < list.length; i++) {
        if (list[i].ev === null) continue;
        if (stops > 0 && list[i].ev <= currentEV + stops) {
            newEv = list[i].ev;
        } else if (stops < 0 && list[i].ev >= currentEV + stops) {
            newEv = list[i].ev;
        }
    }

    return newEv;
}


module.exports = Exposure;