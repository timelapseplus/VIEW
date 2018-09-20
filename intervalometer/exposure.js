var tv = require('intervalometer/time-value.js');
var interpolate = require('intervalometer/interpolate.js');

var exp = {};
var local = {};
exp.status = {};
exp.config = {};


exp.init = function(minEv, maxEv, nightCompensation, highlightProtection) {
    if (nightCompensation === null) nightCompensation = 'auto';

    if(nightCompensation != 'auto') {
        nightCompensation = parseFloat(nightCompensation);
    }

    local = {
        lumArray: [],
        evArray: [],
        historyArray: [],
        highlightArray: [],
        rateHistoryArray: [],
        targetHighlights: null,
        targetLum: null,
        first: true
    };

    exp.status = {
        rampEv: null,
        highlights: null,
        rate: null,
        direction: null,
        highlightProtection: 0
    };

    exp.config = {
        sunrise: {
            p: 0.9,
            i: 0.4,
            d: 0.6,
            targetTimeSeconds: 300,
            evIntegrationSeconds: 300,
            historyIntegrationSeconds: 480,
            highlightIntegrationFrames: 3,
        },
        sunset: {
            p: 1.1,
            i: 0.6,
            d: 0.4,
            targetTimeSeconds: 480,
            evIntegrationSeconds: 480,
            historyIntegrationSeconds: 480,
            highlightIntegrationFrames: 5,
        },
        maxEv: maxEv,
        minEv: minEv,
        maxRate: 30,
        hysteresis: 0.4,
        nightCompensationDayEv: 10,
        nightCompensationNightEv: -2,
        nightCompensation: nightCompensation,
        highlightProtection: highlightProtection,
        highlightProtectionLimit: 1
    };

    return exp.config;
}

exp.calculate = function(algorithm, direction, currentEv, lastPhotoLum, lastPhotoHistogram, minEv, maxEv) {
    if(minEv != null) exp.config.minEv = minEv;
    if(maxEv != null) exp.config.maxEv = maxEv;
    lastPhotoHistogram = normalizeHistogram(lastPhotoHistogram);

    if(['auto', 'sunset', 'sunrise'].indexOf(direction) === -1) direction = 'auto';

    //if(algorithm == "lrt") {
    //    return exp.calculate_LRTtimelapse(currentEv, direction, lastPhotoLum, lastPhotoHistogram, minEv, maxEv);
    //} else {
        return exp.calculate_TLPAuto(currentEv, lastPhotoLum, lastPhotoHistogram, minEv, maxEv);
    //}
}

exp.calculate_LRTtimelapse = function(currentEv, direction, lastPhotoLum, lastPhotoHistogram, minEv, maxEv) {
    var lum = 0;
    for(var i = 0; i < 256; i++) {
        lum += Math.pow(i, i / 256) / 256 * lastPhotoHistogram[i];
    }

    var lum1 = lum;

    lum -= (lum * getEvOffsetScale(currentEv, lastPhotoLum, true)) / 2; // apply night compensation

    var lum2 = lum;

    if(local.targetLum === null) {  // first time
        exp.status.rampEv = currentEv;
        local.lrtLumArray = [];
        local.targetLum = lum;
    
        if(direction == 'sunrise') {
            local.direction = 1;
        } else if(direction == 'sunset') {
            local.direction = -1;
        } else {
            local.direction = 0;
        }
    }

    local.lrtLumArray.push(lum);
    if(local.lrtLumArray.length > 5) {
        local.lrtLumArray.shift();
    }
    lum = (local.lrtLumArray.reduce(function(sum, l) { return sum + l; }, 0)) / local.lrtLumArray.length;

    var lum3 = lum;

    var directionFactor;

    directionFactor = local.direction >= 0 ? 1 : 4;
    if((direction == 'auto' || direction == 'sunrise') && lum > local.targetLum * (1 + 0.2 * directionFactor)) {
        exp.status.rampEv = currentEv + 1/3;
        local.direction = 1;
    }
    directionFactor = local.direction <= 0 ? 1 : 4;
    if((direction == 'auto' || direction == 'sunset') && lum < local.targetLum / (1 + 0.2 * directionFactor)) {
        exp.status.rampEv = currentEv -  1/3;
        local.direction = -1;
    }

    //console.log("LRT LumX:", lum1, lum2, lum3);

    console.log("LRT Lum:", lum, local.direction, local.targetLum, " currentEv:", currentEv, ", newEv:", exp.status.rampEv, ", Dir:", direction);

    return exp.status.rampEv;
}

exp.calculate_TLPAuto = function(currentEv, lastPhotoLum, lastPhotoHistogram, minEv, maxEv) {
    // measure the interval
    exp.status.intervalSeconds = 0;
    var thisPhotoTime = new Date();
    if (local.lastPhotoTime) {
        var intervalSeconds = (thisPhotoTime - local.lastPhotoTime) / 1000;
        if(intervalSeconds > 0) {
            exp.status.intervalSeconds = intervalSeconds; // in case the time changes while running, make sure this is never negative
        }
    }
    local.lastPhotoTime = thisPhotoTime;

    // get config based on rate up/down
    var config = exp.config.sunset;
    if (exp.status.direction && exp.status.direction > 0) {
        config = exp.config.sunrise;
    }

    // get the current rate of change
    exp.status.rate = calculateRate(currentEv, lastPhotoLum, config);
    console.log("rate: ", exp.status.rate);

    // don't change if within hysteresis setting
    if (Math.abs(exp.status.rate) < exp.config.hysteresis) exp.status.rate = 0;

    // limit to max rate
    if(exp.status.rate > exp.config.maxRate) exp.status.rate = exp.config.maxRate;
    if(exp.status.rate < -exp.config.maxRate) exp.status.rate = -exp.config.maxRate;

    // don't swing quickly past zero (stops oscillation)
    if (exp.status.rate > 3 && exp.status.direction < -0.5) exp.status.rate = 0;
    if (exp.status.rate < -3 && exp.status.direction > 0.5) exp.status.rate = 0;

    // adjust exposure according to rate in stops/hour
    exp.status.rampEv += (exp.status.rate / 3600) * exp.status.intervalSeconds;

    if(exp.config.highlightProtection) {
        var highlights = lastPhotoHistogram[255] + lastPhotoHistogram[254] / 2;

        // highlight protection
        local.highlightArray.unshift(highlights);
        local.highlightArray = local.highlightArray.slice(0, config.highlightIntegrationFrames);
        var tempArray = local.highlightArray.slice(0).sort(function (a, b) {  return a - b;  }).slice(local.highlightArray.length > 2 ? 1 : 0, local.highlightArray.length > 2 ? local.highlightArray.length - 1 : local.highlightArray.length);
        exp.status.highlights = tempArray.reduce(function(sum, val) { return sum + val}) / tempArray.length;
        if(local.targetHighlights === null) local.targetHighlights = Math.max(exp.status.highlights, 2);

        if(exp.status.highlights > local.targetHighlights * 2 && lastPhotoHistogram[255] > local.targetHighlights && exp.status.highlightProtection < exp.config.highlightProtectionLimit) {
            exp.status.highlightProtection += 0.333;
            exp.status.manualOffsetEv -= 0.333;
            exp.status.rampEv += 0.333;
        } else if(exp.status.highlights < local.targetHighlights / 2 && exp.status.highlightProtection > 0.3) {
            exp.status.highlightProtection -= 0.333;
            exp.status.manualOffsetEv += 0.333;
            exp.status.rampEv -= 0.333;
        }
        exp.status.highlightProtection = Math.round(exp.status.highlightProtection * 1000) / 1000;
    }

    console.log("status: ", exp.status);
    //console.log("local: ", local);

    return exp.status.rampEv;
}



// ******* Private Functions ******* //

function filteredMean(tvArr, trim) {
    if (!trim) trim = 1;
    return tv.mean(tv.insideArray(tvArr, trim));
}

function filteredSlope(tvArr, trim) {
    if (!trim) trim = 1;
    return tv.mean(tv.insideArray(tv.slopes(tvArr), trim));
}

function calculateRate(currentEv, lastPhotoLum, config) {
    var diff = calculateDelta(currentEv, lastPhotoLum, config);
    exp.status.targetEv = currentEv + diff;
    if (exp.status.targetEv < exp.config.minEv) exp.status.targetEv = exp.config.minEv;
    if (exp.status.targetEv > exp.config.maxEv) exp.status.targetEv = exp.config.maxEv;
    if (exp.status.rampEv === null) exp.status.rampEv = exp.status.targetEv;
    var delta = exp.status.targetEv - exp.status.rampEv;
    local.historyArray.push({
        val: delta,
        time: new Date()
    });
    local.historyArray = tv.purgeArray(local.historyArray, config.historyIntegrationSeconds);

    exp.status.pastError = tv.mean(local.historyArray);

    exp.status.pComponent = delta * config.p;
    exp.status.iComponent = exp.status.pastError * config.i;
    exp.status.dComponent = exp.status.evSlope * config.d;

    delta *= config.p;
    delta += exp.status.pastError * config.i;
    delta += exp.status.evSlope * config.d;

    var rate = delta * (3600 / config.targetTimeSeconds);

    local.rateHistoryArray.push({
        val: rate,
        time: new Date()
    });
    local.rateHistoryArray = tv.purgeArray(local.rateHistoryArray, config.historyIntegrationSeconds);
    exp.status.direction = tv.mean(local.rateHistoryArray);

    return rate;
}

function calculateDelta(currentEv, lastPhotoLum, config) {
    local.lumArray.push({
        val: lastPhotoLum,
        time: new Date()
    });

    local.evArray.push({
        val: currentEv + lastPhotoLum,
        time: new Date()
    });

    var evScale = [{
        x: exp.config.nightCompensationNightEv,
        y: 1
    }, {
        x: exp.config.nightCompensationDayEv,
        y: 0
    }]
    exp.status.nightRatio = interpolate.linear(evScale, currentEv);

    if (local.first) {
        exp.status.nightRefEv = lastPhotoLum * exp.status.nightRatio + -1.5 * (1 - exp.status.nightRatio);
        exp.status.dayRefEv = lastPhotoLum * (1 - exp.status.nightRatio);
        exp.status.fixedRefEv = lastPhotoLum;
        exp.status.manualOffsetEv = lastPhotoLum - getEvOffsetScale(currentEv, lastPhotoLum);
        console.log("EXPOSURE: lastPhotoLum =", lastPhotoLum);
        console.log("EXPOSURE: exp.status.manualOffsetEv =", exp.status.manualOffsetEv);
        console.log("EXPOSURE: getEvOffsetScale(currentEv, lastPhotoLum) =", getEvOffsetScale(currentEv, lastPhotoLum));
        //exp.status.offsetEv = getEvOffsetScale(currentEv, lastPhotoLum) + exp.status.manualOffsetEv;
        console.log("EXPOSURE: lastPhotoLum - exp.status.manualOffsetEv =", lastPhotoLum - exp.status.manualOffsetEv);
        local.first = false;
    }

    local.lumArray = tv.purgeArray(local.lumArray, config.evIntegrationSeconds);
    local.evArray = tv.purgeArray(local.evArray, config.evIntegrationSeconds);

    var trim = 1;
    if (exp.status.intervalSeconds) {
        trim = Math.ceil((config.evIntegrationSeconds / exp.status.intervalSeconds) * 0.2); // trim outer 20% from sorted array
    }

    exp.status.evMean = filteredMean(local.lumArray, trim);
    exp.status.evSlope = filteredSlope(local.evArray, trim) * config.targetTimeSeconds;

    return lastPhotoLum - (getEvOffsetScale(currentEv, lastPhotoLum) + exp.status.manualOffsetEv);
}


function getEvOffsetScale(ev, lastPhotoLum, noAuto) {
    var evScale
    if(exp.config.nightCompensation == 'auto') {
        if(noAuto) { // for LRT algorithm
            evScale = [{
                ev: exp.config.nightCompensationNightEv,
                offset: -1.333333
            }, {
                ev: exp.config.nightCompensationDayEv,
                offset: 0
            }]
        } else { // auto calculate night exposure
            evScale = [{
                ev: exp.config.nightCompensationNightEv,
                offset: exp.status.nightRefEv
            }, {
                ev: exp.config.nightCompensationDayEv,
                offset: exp.status.dayRefEv
            }]
        }
    } else {
        evScale = [{
            ev: exp.config.nightCompensationNightEv,
            offset: exp.status.fixedRefEv + (parseFloat(exp.config.nightCompensation) || 0.0)
        }, {
            ev: exp.config.nightCompensationDayEv,
            offset: exp.status.fixedRefEv + 0
        }]
    }

    var values = evScale.map(function(item) {
        return {
            x: item.ev,
            y: item.offset
        }
    });
    return interpolate.linear(values, ev);
}

function normalizeHistogram(histogramArray) {
    var lum = 0, sum = 0;
    for(var i = 0; i < 256; i++) {
        sum += histogramArray[i];
    }
    sum /= 256;
    for(var i = 0; i < 256; i++) {
        histogramArray[i] = histogramArray[i] / sum;
    }
    return histogramArray;
}

module.exports = exp;