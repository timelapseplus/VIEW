//var intervalometer = require('./intervalometer/intervalometer');
var exp = require('./intervalometer/exposure');
var datajs = require('./work/tl-243/data')
// var datajs = require('./logs/data')
const api_util = require('./camera/ptpjs/api_util')
var setev = require('./work/tl-243/setev')

var nightLuminance = [-3, -2.5];
for (var i = -2; i <= 2.1; i += 0.1) {
    nightLuminance.push(i.toFixed(1));
}
var m = nightLuminance.map(function (i) {
    var n = (i > 0) ? '+' + i : ( i < 0? '-': '') + Math.abs(i);

    var s = "stops"
    if (i == -1.5) {
        s += " (default)";
    }
    if (i == 1 || i == -1) {
        s = "stop";
    }
    return {
        name: "Night Luminance Target",
        value: n + " " + s,
      //  help: help.nightLuminance,
       // action: ui.set(core.currentProgram, 'nightLuminance', i)
    }
})
console.log(m)

exp.init(-7, 19, -1, 0, true, "./logs/data2.js");

exp.status.rampEv = 12.3
lastPhotoHistogram =  [10,44,139,257,257,85,84,41,20,15,15,11,18,12,10,9,1,2,5,0,1,5,1,1,2,0,5,0,0,5,0,0,0,0,0,1,0,0,0,0,0,1,0,0,0,0,0,1,1,0,0,0,0,0,0,2,0,1,1,1,1,1,0,0,3,0,4,4,2,8,5,10,16,14,18,19,23,28,27,32,45,52,60,70,62,69,63,56,66,53,53,73,72,77,74,62,62,59,60,75,66,82,81,82,82,80,93,112,119,133,114,111,146,149,156,160,159,153,146,113,81,119,107,90,113,22,9,4,9,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]
var rate = exp.calculate("lrt", "auto", 12.3, -1.0397291300213682, lastPhotoHistogram, -7, 19);

/*datajs.data.forEach((value, i) => {

    //TODO
    if (i == 235)
        i = i;
    var rate = exp.calculate("lrt", "auto", value.currentEv, value.lastPhotoLum, value.lastPhotoHistogram, -7, 19);
    console.log("rate = ", rate);

})

return;*/

var exposure = {
    shutter:
        {
            list: [
                {name: "30s", ev: -11, code: 19660810, duration_ms: 32000},
                {name: "25s", ev: -10 - 2 / 3, code: 16384010, duration_ms: 27000},
                {name: "20s", ev: -10 - 1 / 3, code: 13107210, duration_ms: 21500},
                {name: "15s", ev: -10, code: 9830410, duration_ms: 16000},
                {name: "13s", ev: -9 - 2 / 3, code: 8519690, duration_ms: 13800},
                {name: "10s", ev: -9 - 1 / 3, code: 6553610, duration_ms: 10600},
                {name: "8s", ev: -9, code: 5242890, duration_ms: 8000},
                {name: "6s", ev: -8 - 2 / 3, code: 3932170, duration_ms: 6000},
                {name: "5s", ev: -8 - 1 / 3, code: 3276810, duration_ms: 5000},
                {name: "4s", ev: -8, code: 2621450, duration_ms: 4000},
                {name: "3s", ev: -7 - 2 / 3, code: 2097162, duration_ms: 3000},
                {name: "2.5s", ev: -7 - 1 / 3, code: 1638410, duration_ms: 2500},
                {name: "2s", ev: -7, code: 1310730, duration_ms: 2000},
                {name: "1.6s", ev: -6 - 2 / 3, code: 1048586, duration_ms: 1600},
                {name: "1.3s", ev: -6 - 1 / 3, code: 851978, duration_ms: 1300},
                {name: "1s", ev: -6, code: 655370, duration_ms: 1000},
                {name: "0.8s", ev: -5 - 2 / 3, code: 524298, duration_ms: 800},
                {name: "0.6s", ev: -5 - 1 / 3, code: 393226, duration_ms: 600},
                {name: "1/2", ev: -5, code: 327690, duration_ms: 500},
                {name: "0.4s", ev: -4 - 2 / 3, code: 262154, duration_ms: 400},
                {name: "1/3", ev: -4 - 1 / 3, code: 65539, duration_ms: 333},
                {name: "1/4", ev: -4, code: 65540, duration_ms: 250},
                {name: "1/5", ev: -3 - 2 / 3, code: 65541, duration_ms: 200},
                {name: "1/6", ev: -3 - 1 / 3, code: 65542, duration_ms: 150},
                {name: "1/8", ev: -3, code: 65544, duration_ms: 125},
                {name: "1/10", ev: -2 - 2 / 3, code: 65546, duration_ms: 100},
                {name: "1/13", ev: -2 - 1 / 3, code: 65549, duration_ms: 100},
                {name: "1/15", ev: -2, code: 65551, duration_ms: 100},
                {name: "1/20", ev: -1 - 2 / 3, code: 65556, duration_ms: 100},
                {name: "1/25", ev: -1 - 1 / 3, code: 65561, duration_ms: 100},
                {name: "1/30", ev: -1, code: 65566, duration_ms: 100},
                {name: "1/40", ev: 0 - 2 / 3, code: 65576, duration_ms: 100},
                {name: "1/50", ev: 0 - 1 / 3, code: 65586, duration_ms: 100},
                {name: "1/60", ev: 0, code: 65596, duration_ms: 100},
                {name: "1/80", ev: 0 + 1 / 3, code: 65616, duration_ms: 100},
                {name: "1/100", ev: 0 + 2 / 3, code: 65636, duration_ms: 100},
                {name: "1/125", ev: 1, code: 65661, duration_ms: 100},
                {name: "1/160", ev: 1 + 1 / 3, code: 65696, duration_ms: 100},
                {name: "1/200", ev: 1 + 2 / 3, code: 65736, duration_ms: 100},
                {name: "1/250", ev: 2, code: 65786, duration_ms: 100},
                {name: "1/320", ev: 2 + 1 / 3, code: 65856, duration_ms: 100},
                {name: "1/400", ev: 2 + 2 / 3, code: 65936, duration_ms: 100},
                {name: "1/500", ev: 3, code: 66036, duration_ms: 100},
                {name: "1/640", ev: 3 + 1 / 3, code: 66176, duration_ms: 100},
                {name: "1/800", ev: 3 + 2 / 3, code: 66336, duration_ms: 100},
                {name: "1/1000", ev: 4, code: 66536, duration_ms: 100},
                {name: "1/1250", ev: 4 + 1 / 3, code: 66786, duration_ms: 100},
                {name: "1/1600", ev: 4 + 2 / 3, code: 67136, duration_ms: 100},
                {name: "1/2000", ev: 5, code: 67536, duration_ms: 100},
                {name: "1/2500", ev: 5 + 1 / 3, code: 68036, duration_ms: 100},
                {name: "1/3200", ev: 5 + 2 / 3, code: 68736, duration_ms: 100},
                {name: "1/4000", ev: 6, code: 69536, duration_ms: 100},
                {name: "1/5000", ev: 6 + 1 / 3, code: 70536, duration_ms: 100},
                {name: "1/6400", ev: 6 + 2 / 3, code: 71936, duration_ms: 100},
                {name: "1/8000", ev: 7, code: 73536, duration_ms: 100}
            ]
        }
    ,
    aperture: {
        list: [
            {name: "1.0", ev: -8, code: 100},
            {name: "1.1", ev: -7 - 2 / 3, code: 110},
            {name: "1.2", ev: -7 - 1 / 3, code: 120},
            {name: "1.4", ev: -7, code: 140},
            {name: "1.6", ev: -6 - 2 / 3, code: 160},
            {name: "1.8", ev: -6 - 1 / 3, code: 180},
            {name: "2.0", ev: -6, code: 200},
            {name: "2.2", ev: -5 - 2 / 3, code: 220},
            {name: "2.5", ev: -5 - 1 / 3, code: 250},
            {name: "2.8", ev: -5, code: 280},
            {name: "3.2", ev: -4 - 2 / 3, code: 320},
            {name: "3.5", ev: -4 - 1 / 3, code: 350},
            {name: "4.0", ev: -4, code: 400},
            {name: "4.5", ev: -3 - 2 / 3, code: 450},
            {name: "5.0", ev: -3 - 1 / 3, code: 500},
            {name: "5.6", ev: -3, code: 560},
            {name: "6.3", ev: -2 - 2 / 3, code: 630},
            {name: "7.1", ev: -2 - 1 / 3, code: 710},
            {name: "8", ev: -2, code: 800},
            {name: "9", ev: -1 - 2 / 3, code: 900},
            {name: "10", ev: -1 - 1 / 3, code: 1000},
            {name: "11", ev: -1, code: 1100},
            {name: "13", ev: -0 - 2 / 3, code: 1300},
            {name: "14", ev: -0 - 1 / 3, code: 1400},
            {name: "16", ev: 0, code: 1600},
            {name: "18", ev: 0 + 1 / 3, code: 1800},
            {name: "20", ev: 0 + 2 / 3, code: 2000},
            {name: "22", ev: 1, code: 2200},
            {name: "25", ev: 2 + 1 / 3, code: 2500},
            {name: "29", ev: 2 + 2 / 3, code: 2900},
            {name: "32", ev: 3, code: 3200},
            {name: "36", ev: 3 + 1 / 3, code: 3600},
            {name: "42", ev: 3 + 2 / 3, code: 4200},
            {name: "45", ev: 4, code: 4500},
            {name: "50", ev: 4 + 1 / 3, code: 5000},
            {name: "57", ev: 4 + 2 / 3, code: 5700},
            {name: "64", ev: 5, code: 6400}
        ]
    },
    iso: {
        list: [
            {name: "AUTO", ev: null, code: 16777215},
            //{ name: "25",       ev:  2,          code: 25 },
            //{ name: "50",       ev:  1,          code: 50 },
            //{ name: "64",       ev:  0 + 2 / 3,  code: 64 },
            //{ name: "80",       ev:  0 + 1 / 3,  code: 80 },
            {name: "100", ev: 0, code: 100},
            {name: "125", ev: -0 - 1 / 3, code: 125},
            {name: "160", ev: -0 - 2 / 3, code: 160},
            {name: "200", ev: -1, code: 200},
            {name: "250", ev: -1 - 1 / 3, code: 250},
            {name: "320", ev: -1 - 2 / 3, code: 320},
            {name: "400", ev: -2, code: 400},
            {name: "500", ev: -2 - 1 / 3, code: 500},
            {name: "640", ev: -2 - 2 / 3, code: 640},
            {name: "800", ev: -3, code: 800},
            {name: "1000", ev: -3 - 1 / 3, code: 1000},
            {name: "1250", ev: -3 - 2 / 3, code: 1250},
            {name: "1600", ev: -4, code: 1600},
            {name: "2000", ev: -4 - 1 / 3, code: 2000},
            {name: "2500", ev: -4 - 2 / 3, code: 2500},
            {name: "3200", ev: -5, code: 3200},
            {name: "4000", ev: -5 - 1 / 3, code: 4000},
            {name: "5000", ev: -5 - 2 / 3, code: 5000},
            {name: "6400", ev: -6, code: 6400},
            {name: "8000", ev: -6 - 1 / 3, code: 8000},
            {name: "10000", ev: -6 - 2 / 3, code: 10000},
            {name: "12800", ev: -7, code: 12800},
            {name: "16000", ev: -7 - 1 / 3, code: 16000},
            {name: "20000", ev: -7 - 2 / 3, code: 20000},
            {name: "25600", ev: -8, code: 25600},
            {name: "32000", ev: -8 - 1 / 3, code: 32000},
            {name: "40000", ev: -8 - 2 / 3, code: 40000},
            {name: "51200", ev: -9, code: 51200},
            {name: "64000", ev: -9 - 1 / 3, code: 64000},
            {name: "80000", ev: -9 - 2 / 3, code: 80000},
            {name: "102400", ev: -10, code: 102400},
            {name: "128000", ev: -10 - 1 / 3, code: 128000},
            {name: "160000", ev: -10 - 2 / 3, code: 160000},
            {name: "204800", ev: -11, code: 204800},
            //{ name: "256000",   ev: -11 - 1 / 3, code: 256000 },
            //{ name: "320000",   ev: -11 - 2 / 3, code: 320000 },
            //{ name: "409600",   ev: -12,         code: 409600 }
        ]
    }
}

function getEv(shutterEv, apertureEv, isoEv) {
    if (shutterEv == null) shutterEv = api.cameras.length > 0 && exposure.shutter ? exposure.shutter.ev : null;
    if (apertureEv == null) apertureEv = api.cameras.length > 0 && exposure.aperture ? exposure.aperture.ev : null;
    if (isoEv == null) isoEv = api.cameras.length > 0 && exposure.iso ? exposure.iso.ev : null;
    if (shutterEv == null || apertureEv == null || isoEv == null) return null;
    return shutterEv + 6 + apertureEv + 8 + isoEv;
}

var shutterList = api_util.listEvs(exposure, 'shutter', -8 - 2 / 3, null);
var apertureList = api_util.listEvs(exposure, 'aperture', -5, -2);
var isoList = api_util.listEvs(exposure, 'iso', -5, 0);


var s = 1;
var a = -2 - 2 / 3;
var i = 0;

var currentEv = getEv(s, a, i)
console.log("initial sh = ", api_util.findEvName(exposure, 'shutter', s))
console.log("initial a = ", api_util.findEvName(exposure, 'aperture', a))
console.log("initial iso = ", api_util.findEvName(exposure, 'iso', i))
console.log("currentEv = " + currentEv)

var res = {
    shutterEv: s,
    apertureEv: a,
    isoEv: i,
    currentEv: currentEv,
    direction: "-"
}

res = api_util.adjustCameraExposure(res.currentEv, res.currentEv,
    res.shutterEv, shutterList,
    true, res.apertureEv, apertureList,
    res.isoEv, isoList,
    {blendParams: true},
    getEv
)

console.log(api_util.findEvName(exposure, 'shutter', res.shutterEv), " ",
    api_util.findEvName(exposure, 'aperture', res.apertureEv), " ",
    api_util.findEvName(exposure, 'iso', res.isoEv));

setev.data.forEach(function (value, i) {

    api_util.setZeros();
    var targetEv = value
    if (i == 39)
        i = 39;
    if (!api_util.equalEv(value, res.currentEv))
        res = api_util.adjustCameraExposure(value, res.currentEv,
            res.shutterEv, shutterList,
            true, res.apertureEv, apertureList,
            res.isoEv, isoList,
            {blendParams: true},
            getEv
        )
    else
        res.direction = "-";

    console.log(i, " ", api_util.findEvName(exposure, 'shutter', res.shutterEv), " ",
        api_util.findEvName(exposure, 'aperture', res.apertureEv), " ",
        api_util.findEvName(exposure, 'iso', res.isoEv), " ",
        res.direction, " ",
        res.lastParam, " ",
        targetEv.toFixed(2), " ",
        res.currentEv.toFixed(2)
    );
})

