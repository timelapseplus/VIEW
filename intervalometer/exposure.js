var tv = require('intervalometer/time-value.js');
var interpolate = require('intervalometer/interpolate.js');

var exp = {};
var local = {};
exp.status = {};
exp.config = {};


exp.init = function(minEv, maxEv, nightCompensation) {
    if (nightCompensation === null) nightCompensation = 'auto';

    if(nightCompensation != 'auto') {
        nightCompensation = parseFloat(nightCompensation);
    }

    local = {
        lumArray: [],
        evArray: [],
        historyArray: [],
        rateHistoryArray: [],
        targetLum: null,
        first: true
    };

    exp.status = {
        rampEv: null,
        rate: null,
        direction: null
    };

    exp.config = {
        sunrise: {
            p: 0.9,
            i: 0.4,
            d: 0.6,
            targetTimeSeconds: 300,
            evIntegrationSeconds: 300,
            historyIntegrationSeconds: 480,
        },
        sunset: {
            p: 1.1,
            i: 0.6,
            d: 0.4,
            targetTimeSeconds: 480,
            evIntegrationSeconds: 480,
            historyIntegrationSeconds: 480,
        },
        maxEv: maxEv,
        minEv: minEv,
        maxRate: 30,
        hysteresis: 0.4,
        nightCompensationDayEv: 10,
        nightCompensationNightEv: -2,
        nightCompensation: nightCompensation
    };

    return exp.config;
}

exp.calculate = function(algorithm, currentEv, lastPhotoLum, lastPhotoHistogram, minEv, maxEv) {
    if(minEv != null) exp.config.minEv = minEv;
    if(maxEv != null) exp.config.maxEv = maxEv;

    if(algorithm == "lrt") {
        return exp.calculate_LRTtimelapse(currentEv, lastPhotoLum, lastPhotoHistogram, minEv, maxEv);
    } else {
        return exp.calculate_TLPAuto(currentEv, lastPhotoLum, lastPhotoHistogram, minEv, maxEv);
    }
}

exp.calculate_LRTtimelapse = function(currentEv, lastPhotoLum, lastPhotoHistogram, minEv, maxEv) {
    var lum = 0;
    for(var i = 0; i < 256; i++) {
        lum += Math.pow(i, i / 256) / 256 * lastPhotoHistogram[i];
    }

    lum -= (lum * getEvOffsetScale(currentEv, lastPhotoLum)) / 2; // apply night compensation

    if(local.targetLum === null) {  // first time
        exp.status.rampEv = currentEv;
        local.targetLum = lum; //averageLum;
        local.direction = 0;
    }
    var directionFactor;
    directionFactor = (local.direction >= 0) ? 1 : 8;
    if(lum > local.targetLum * (1 + 0.2 * directionFactor)) {
        exp.status.rampEv = currentEv + 1/3;
        local.direction = 1;
    }
    directionFactor = (local.direction <= 0) ? 1 : 8;
    if(lum < local.targetLum / (1 + 0.2 * directionFactor)) {
        exp.status.rampEv = currentEv -  1/3;
        local.direction = -1;
    }

    console.log("LRT Lum:", lum, local.direction);

    return exp.status.rampEv;
}

exp.calculate_TLPAuto = function(currentEv, lastPhotoLum, lastPhotoHistogram, minEv, maxEv) {
    // measure the interval
    exp.status.intervalSeconds = 0;
    var thisPhotoTime = new Date();
    if (local.lastPhotoTime) {
        exp.status.intervalSeconds = (thisPhotoTime - local.lastPhotoTime) / 1000;
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

    if (local.first) {
        exp.status.offsetEv = lastPhotoLum - getEvOffsetScale(currentEv, lastPhotoLum);
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

    return lastPhotoLum - exp.status.offsetEv - getEvOffsetScale(currentEv, lastPhotoLum);
}


function getEvOffsetScale(ev, lastPhotoLum) {
    var evScale
    if(exp.config.nightCompensation == 'auto') {
        evScale = [{
            ev: exp.config.nightCompensationNightEv,
            offset: -(lastPhotoLum - -1.5)
        }, {
            ev: exp.config.nightCompensationDayEv,
            offset: -(lastPhotoLum - 0.0)
        }]
    } else {
        evScale = [{
            ev: exp.config.nightCompensationNightEv,
            offset: exp.config.nightCompensation
        }, {
            ev: exp.config.nightCompensationDayEv,
            offset: 0
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

module.exports = exp;