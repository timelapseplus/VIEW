// noinspection JSDuplicatedDeclaration,ES6ConvertVarToLetConst

var lastParam = null;
var lastParamUp = null;
var lastParamDown = null;
var lastDirection = null;
var isoDownChanges = 0

exports.setZeros = function () {
    lastParam = null;
    lastParamUp = null;
    lastParamDown = null;
    lastDirection = null;
    isoDownChanges = 0
}

exports.adjustCameraExposure = function (targetEv, currentEv,
                                         shutterEv, shutterList,
                                         apertureEnabled, apertureEv, apertureList,
                                         isoEv, isoList,
                                         options,
                                         getEv) {
    if (!options.blendParams) lastParam = null;

    var direction = targetEv < currentEv ? '↓' : '↑';
    var directionChanged = direction != lastDirection;

    for (var trys = 0; trys < 3; trys++) {
        while (targetEv < currentEv - 1 / 4) {

            var s = decEv(shutterEv, shutterList);
            if (apertureEnabled) var a = decEv(apertureEv, apertureList);
            var i = decEv(isoEv, isoList);
            var changeShutterInsteadOfIso = apertureEv == a;

            if (!equalEv(shutterEv, s) && (lastParamDown != 's' || changeShutterInsteadOfIso || directionChanged && lastParamUp == 's')) {
                shutterEv = s;
                if (changeShutterInsteadOfIso)
                    isoDownChanges++;
                if (options.blendParams) lastParamDown = 's';
            } else if (apertureEnabled && !equalEv(apertureEv, a) && (lastParamDown != 'a' || directionChanged && lastParamUp == 'a')) {
                apertureEv = a;
                if (options.blendParams) lastParamDown = 'a';
            } else if (!equalEv(isoEv, i) && (lastParamDown != 'i' || directionChanged && lastParamUp == 'i')) {
                isoEv = i;
                isoDownChanges++;
                if (options.blendParams) lastParamDown = 'i';
            } else {
                lastParamDown = null;
                currentEv = getEv(shutterEv, apertureEv, isoEv);
                break;
            }
            currentEv = getEv(shutterEv, apertureEv, isoEv);
            //console.log(" update: ", currentEv, " ", lastParam);
        }

        while (targetEv > currentEv + 1 / 4) {

            var s = incEv(shutterEv, shutterList);
            if (apertureEnabled) var a = incEv(apertureEv, apertureList);
            var i = incEv(isoEv, isoList);

            if (!equalEv(isoEv, i) /*&& (lastParamUp != 'i' || directionChanged && lastParamDown == 'i')*/) {
                isoEv = i;
                if (options.blendParams) lastParamUp = 'i';
            } else if (!equalEv(shutterEv, s) && (lastParamUp != 's' || directionChanged && lastParamDown == 's')) {
                shutterEv = s;
                if (options.blendParams) lastParamUp = 's';
            } else if (apertureEnabled && !equalEv(apertureEv, a) && (lastParamUp != 'a' || directionChanged && lastParamDown == 'a')) {
                apertureEv = a;
                if (options.blendParams) lastParamUp = 'a';
            } else {
                lastParamUp = null;
                currentEv = getEv(shutterEv, apertureEv, isoEv);
                break;
            }
            currentEv = getEv(shutterEv, apertureEv, isoEv);
            //console.log(" update: ", currentEv, " ", lastParam);
        }

        if (Math.abs(targetEv - currentEv) <= 1 / 4) break;

    }
    lastParam = (lastParamDown + " " + lastParamUp);
    lastDirection = direction;
    return {
        currentEv: currentEv,
        shutterEv: shutterEv,
        apertureEv: apertureEv,
        isoEv: isoEv,
        direction: direction,
        lastParam: lastParam
    };
}

exports.listEvs = function (param, minEv, maxEv) { // returns a sorted list of EV's from a camera available list
    var base = api.cameras[0].camera.exposure;
    //console.log("API:", param, "base", base);
    if (!base || !base[param] || !base[param].list) return null;
    var list = base[param].list;
    //console.log("API:", param, "base list", list);

    return list.map(function (item) {
        return item.ev;
    }).filter(function (ev, index, self) {
        if (ev == null) return false;
        if (minEv != null && ev < minEv) return false;
        if (maxEv != null && ev > maxEv) return false;
        return self.indexOf(ev) === index; // ensure unique
    }).sort(function (a, b) {
        return a - b
    });
}

exports.findEvName = function (base, param, targetEv) { // returns a sorted list of EV's from a camera available list
    //console.log("API:", param, "base", base);
    if (!base || !base[param] || !base[param].list) return null;
    var list = base[param].list;
    //console.log("API:", param, "base list", list);

    return find(list, function (ev) {
        return targetEv == ev.ev;
    }).name;
}

function find(list, callback) {
    for (var i = 0; i < list.length; i++) {
        if (callback(list[i])) {
            return list[i];
        }
    }
    return undefined;
}

function incEv(ev, evList) {
    //console.log("incEv: index", i, "ev", ev, "list", evList);
    if (!evList) return null;
    var i = evIndexOf(ev, evList);
    if (i != -1 && i < evList.length - 1 && evList[i + 1] != null) return evList[i + 1];
    if (ev != null && evList && evList.length > 0) {
        var min = Math.min.apply(null, evList),
            max = Math.max.apply(null, evList);
        if (ev < min) return min;
        if (ev > max) return max;
    }
    return ev;
}

function decEv(ev, evList) {
    if (!evList) return null;
    var i = evIndexOf(ev, evList);
    if (i > 0 && evList[i - 1] != null) return evList[i - 1];
    if (ev != null && evList && evList.length > 0) {
        var min = Math.min.apply(null, evList),
            max = Math.max.apply(null, evList);
        if (ev < min) return min;
        if (ev > max) return max;
    }
    return ev;
}

function equalEv(ev1, ev2) {
    if (ev1 == null || ev2 == null) return true; // equal means ignore
    return Math.abs(ev1 - ev2) < 0.25;
}

exports.equalEv = equalEv

function evIndexOf(ev, evList) {
    var i = evList.indexOf(ev);
    if (i != -1) return i;
    for (i = 0; i < evList.length; i++) {
        if (ev <= evList[i]) {
            if (i == 0) return i;
            if (Math.abs(ev - evList[i]) > Math.abs(ev - evList[i - 1])) {
                return i - 1;
            } else {
                return i;
            }
        }
    }
    return -1;
}

function listEvs(base, param, minEv, maxEv) { // returns a sorted list of EV's from a camera available list
    //console.log("API:", param, "base", base);
    if (!base || !base[param] || !base[param].list) return null;
    var list = base[param].list;
    //console.log("API:", param, "base list", list);

    return list.map(function (item) {
        return item.ev;
    }).filter(function (ev, index, self) {
        if (ev == null) return false;
        if (minEv != null && ev < minEv) return false;
        if (maxEv != null && ev > maxEv) return false;
        return self.indexOf(ev) === index; // ensure unique
    }).sort(function (a, b) {
        return a - b
    });
}

exports.listEvs = listEvs
