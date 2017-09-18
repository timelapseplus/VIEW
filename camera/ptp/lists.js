var lists = {};

lists.fixedApertureEv = -4;

lists.paramMap = [{
    name: "target",
    maps: [{
        section: "settings",
        item: "capturetarget"
    }]
}, {
    name: "autofocus",
    maps: [{
        section: "settings",
        item: "autofocus"
    }]
}, {
    name: "liveview",
    type: "toggle",
    maps: [{
        section: "actions",
        item: "viewfinder"
    }]
}, {
    name: "lvexposure",
    maps: [{
        section: "other",
        item: "d1a5"
    }]
}, {
    name: "afmode",
    maps: [{
        section: "other",
        item: "d161"
    }]
}, {
    name: "focusdrive",
    type: "toggle",
    maps: [{
        section: "actions",
        item: "manualfocusdrive"
    }]
}, {
    name: "format",
    maps: [{
        section: "capturesettings",
        item: "imagequality"
    }, {
        section: "imgsettings",
        item: "imageformat"
    }]
}, {
    name: "iso",
    maps: [{
        section: "imgsettings",
        item: "iso"
    }, {
        section: "other",
        item: "500f"
    }, {
        section: null,
        item: 'isoSpeedRate'
    }]
}, {
    name: "aperture",
    maps: [{
        section: "capturesettings",
        item: "aperture"
    }, {
        section: "capturesettings",
        item: "f-number"
    }, {
        section: "other",
        item: "5007"
    }, {
        section: null,
        item: "fNumber"
    }]
}, {
    name: "shutter",
    maps: [{
        section: "capturesettings",
        item: "shutterspeed2"
    }, {
        section: "capturesettings",
        item: "shutterspeed"
    }, {
        section: "other",
        item: "500d"
    }, {
        section: null,
        item: "shutterSpeed"
    }]
}];

lists.getNameFromEv = function(itemList, ev) {
    for(var i = 0; i < itemList.length; i++) {
        if(itemList[i].ev === ev) return itemList[i].name;
    }
    return "";
}

lists.cleanEvCopy = function(itemList) {
    return itemList.filter(function(item) {
        return item.ev != null
    });
}

lists.getMaxEv = function(itemList) {
    itemList = lists.cleanEvCopy(itemList);
    if (!itemList || itemList.length == 0) return null;
    if (itemList[0].ev > itemList[itemList.length - 1].ev) { // first is largest
        return itemList[0].ev;
    } else {
        return itemList[itemList.length - 1].ev;
    }
}

lists.getMinEv = function(itemList) {
    itemList = lists.cleanEvCopy(itemList);
    if (!itemList || itemList.length == 0) return null;
    if (itemList[0].ev > itemList[itemList.length - 1].ev) { // first is largest
        return itemList[itemList.length - 1].ev;
    } else {
        return itemList[0].ev;
    }
}

lists.getMax = function(itemList) {
    itemList = lists.cleanEvCopy(itemList);
    if (!itemList || itemList.length == 0) return null;
    if (itemList[0].ev > itemList[itemList.length - 1].ev) { // first is largest
        return itemList[0];
    } else {
        return itemList[itemList.length - 1].ev;
    }
}

lists.getMin = function(itemList) {
    itemList = lists.cleanEvCopy(itemList);
    if (!itemList || itemList.length == 0) return null;
    if (itemList[0].ev > itemList[itemList.length - 1].ev) { // first is largest
        return itemList[itemList.length - 1].ev;
    } else {
        return itemList[0];
    }
}

lists.getBulbEvFromSeconds = function(seconds) { // only accurate to 1/3 stop
    var us = seconds * 1000000;
    for (var i = 0; i < lists.bulb.length; i++) {
        if (lists.bulb[i].us < us) {
            return lists.bulb[i].ev;
        }
    }
}

lists.getSecondsFromEv = function(ev) { // only accurate to 1/3 stop
    for (var i = 0; i < lists.bulb.length; i++) {
        if (lists.bulb[i].ev >= ev) {
            return lists.bulb[i].us / 1000000;
        }
    }
    return 0.1;
}

lists.getEv = function(shutter, aperture, iso) {
    if(shutter == null || aperture == null || iso == null) return null;
    
    if (shutter.ev) shutterEv = shutter.ev;
    else shutterEv = shutter;
    if (aperture.ev) apertureEv = aperture.ev;
    else apertureEv = aperture;
    if (iso.ev) isoEv = iso.ev;
    else isoEv = iso;
    return shutterEv + 6 + apertureEv + 8 + isoEv;
}

lists.incEv = function(current, itemList) {
    var i;
    itemList = lists.cleanEvCopy(itemList);
    if (!itemList || itemList.length == 0) return false;
    if (itemList[0].ev > itemList[itemList.length - 1].ev) { // first is largest
        for (i = itemList.length - 1; i >= 0; i--) {
            if (itemList[i].ev > current.ev) {
                return itemList[i];
            }
        }
    } else {
        for (i = 0; i < itemList.length; i++) {
            if (itemList[i].ev > current.ev) {
                return itemList[i];
            }
        }
    }
    return current;
}

lists.decEv = function(current, itemList) {
    var i;
    itemList = lists.cleanEvCopy(itemList);
    if (!itemList || itemList.length == 0) return false;
    if (itemList[0].ev > itemList[itemList.length - 1].ev) { // first is largest
        for (i = 0; i < itemList.length; i++) {
            if (itemList[i].ev < current.ev) {
                return itemList[i];
            }
        }
    } else {
        for (i = itemList.length - 1; i >= 0; i--) {
            if (itemList[i].ev < current.ev) {
                return itemList[i];
            }
        }
    }
    return current;
}

function filterList(list, evMultiple) {
    evMultiple = Math.round(evMultiple * 1000) / 1000; // works around precision errors
    return list.filter(function(item) {
        return item.ev === null || Math.abs(item.ev % evMultiple) < 0.1;
    });
}


lists.evStats = function(settings, options) {
    var res = {};
    if(settings.lists === undefined) return {ev:null};
    var slists = settings.lists;
    settings = settings.details;


    var apertureEnabled = false;

    var av;
    if (settings.aperture && settings.aperture.ev != null) {
        av = settings.aperture.ev;
        if(options && options.parameters && options.parameters.indexOf('A') !== -1) apertureEnabled = true
    } else {
        apertureEnabled = false;
        av = lists.fixedApertureEv;
    }

    res.ev = null;
    if (settings.shutter && settings.shutter.ev != null && settings.iso && settings.iso.ev != null) res.ev = lists.getEv(settings.shutter.ev, av, settings.iso.ev);

    res.shutterList = slists.shutter;
    res.apertureList = slists.aperture;
    res.isoList = slists.iso;

    if(res.shutterList) res.shutterList = lists.cleanEvCopy(res.shutterList);
    if(res.apertureList) res.apertureList = lists.cleanEvCopy(res.apertureList);
    if(res.isoList) res.isoList = lists.cleanEvCopy(res.isoList);

    if (res.shutterList && options && options.maxShutterLengthMs) {
        var maxSeconds = Math.floor(options.maxShutterLengthMs / 1000);
        if(maxSeconds < 1) maxSeconds = 1;
        res.shutterList = res.shutterList.filter(function(item) {
            return lists.getSecondsFromEv(item.ev) <= maxSeconds;
        });
    }
    if (res.shutterList && options && options.shutterMax != null) {
        res.shutterList = res.shutterList.filter(function(item) {
            return item.ev >= options.shutterMax;
        });
    }
    if (res.isoList && options && options.isoMax != null) {
        res.isoList = res.isoList.filter(function(item) {
            return item.ev >= options.isoMax;
        });
    }
    if (res.isoList && options && options.isoMin != null) {
        res.isoList = res.isoList.filter(function(item) {
            return item.ev <= options.isoMin;
        });
    }
    if (res.apertureList && options && options.apertureMax != null) {
        res.apertureList = res.apertureList.filter(function(item) {
            return item.ev <= options.apertureMax;
        });
    }
    if (res.apertureList && options && options.apertureMin != null) {
        res.apertureList = res.apertureList.filter(function(item) {
            return item.ev >= options.apertureMin;
        });
    }

    res.shutterEvMin = lists.getMinEv(res.shutterList);
    res.shutterEvMax = lists.getMaxEv(res.shutterList);

    if(apertureEnabled) {
        res.apertureEvMin = lists.getMinEv(res.apertureList);
        res.apertureEvMax = lists.getMaxEv(res.apertureList);
    } else {
        res.apertureEvMin = av;
        res.apertureEvMax = av;
    }
    
    res.isoEvMin = lists.getMinEv(res.isoList);
    res.isoEvMax = lists.getMaxEv(res.isoList);

    res.minEv = res.shutterEvMin + 6 + res.apertureEvMin + 8 + res.isoEvMin;
    res.maxEv = res.shutterEvMax + 6 + res.apertureEvMax + 8 + res.isoEvMax;

    return res;
}

lists.getEvFromSettings = function(cameraSettings) {
    var settings = cameraSettings.details;
    var av = (settings.aperture && settings.aperture.ev != null) ? settings.aperture.ev : lists.fixedApertureEv;

    if(settings && settings.shutter && settings.iso) {
        return lists.getEv(settings.shutter.ev, av, settings.iso.ev);
    } else {
        return null;
    }
}


lists.format = [{
    name: "RAW",
    values: ['RAW', 'raw', 'NEF (Raw)', 'mRAW', 'sRAW']
}, {
    name: "RAW+JPEG",
    values: ['RAW+JPEG', 'raw+jpeg']
}];

lists.target = [{
    name: "RAM",
    values: ['Internal RAM']
}, {
    name: "CARD",
    values: ['Memory card']
}];

lists.lvexposure = [{
    name: "off",
    values: ['0']
}, {
    name: "on",
    values: ['1']
}];

lists.afmode = [{
    name: "manual",
    values: ['4']
}, {
    name: "af0",
    values: ['0']
}, {
    name: "af1",
    values: ['1']
}, {
    name: "af2",
    values: ['2']
}, {
    name: "af3",
    values: ['3']
}];

lists.autofocus = [{
    name: "off",
    values: ['off']
}, {
    name: "on",
    values: ['on']
}];

lists.liveview = [{
    name: "on",
    values: ['2']
}, {
    name: "on-dark",
    values: ['1']
}, {
    name: "off",
    values: ['0']
}];

lists.focusdrive = [{
    name: "nikon",
    values: ['0']
}, {
    name: "canon",
    values: ['None']
}];

//sunny f/16 1/60 ISO100 = EV15
lists.isoAll = [{
    name: "Auto",
    ev: null,
    values: ['auto', 'auto iso']
}, {
    name: "25",
    ev: 2,
    values: ['25']
}, {
    name: "32",
    ev: 1 + 2 / 3,
    values: ['32']
}, {
    name: "37",
    ev: 1.5,
    values: ['37']
}, {
    name: "40",
    ev: 1 + 1 / 3,
    values: ['40']
}, {
    name: "50",
    ev: 1,
    values: ['50']
}, {
    name: "64",
    ev: 2 / 3,
    values: ['64']
}, {
    name: "75",
    ev: 0.5,
    values: ['75']
}, {
    name: "80",
    ev: 1 / 3,
    values: ['80']
}, {
    name: "100",
    ev: 0,
    values: ['100']
}, {
    name: "125",
    ev: -1 / 3,
    values: ['125']
}, {
    name: "150",
    ev: -0.5,
    values: ['150']
}, {
    name: "160",
    ev: -2 / 3,
    values: ['160']
}, {
    name: "200",
    ev: -1,
    values: ['200']
}, {
    name: "250",
    ev: -1 - 1 / 3,
    values: ['250']
}, {
    name: "300",
    ev: -1.5,
    values: ['300']
}, {
    name: "320",
    ev: -1 - 2 / 3,
    values: ['320']
}, {
    name: "400",
    ev: -2,
    values: ['400']
}, {
    name: "500",
    ev: -2 - 1 / 3,
    values: ['500']
}, {
    name: "600",
    ev: -2.5,
    values: ['600']
}, {
    name: "640",
    ev: -2 - 2 / 3,
    values: ['640']
}, {
    name: "800",
    ev: -3,
    values: ['800']
}, {
    name: "1000",
    ev: -3 - 1 / 3,
    values: ['1000']
}, {
    name: "1200",
    ev: -3.5,
    values: ['1200']
}, {
    name: "1250",
    ev: -3 - 2 / 3,
    values: ['1250']
}, {
    name: "1600",
    ev: -4,
    values: ['1600']
}, {
    name: "2000",
    ev: -4 - 1 / 3,
    values: ['2000']
}, {
    name: "2400",
    ev: -4.5,
    values: ['2400']
}, {
    name: "2500",
    ev: -4 - 2 / 3,
    values: ['2500']
}, {
    name: "3200",
    ev: -5,
    values: ['3200']
}, {
    name: "4000",
    ev: -5 - 1 / 3,
    values: ['4000']
}, {
    name: "4800",
    ev: -5.5,
    values: ['4800']
}, {
    name: "5000",
    ev: -5 - 2 / 3,
    values: ['5000']
}, {
    name: "6400",
    ev: -6,
    values: ['6400']
}, {
    name: "8000",
    ev: -6 - 1 / 3,
    values: ['8000']
}, {
    name: "9600",
    ev: -6.5,
    values: ['9600']
}, {
    name: "10000",
    ev: -6 - 2 / 3,
    values: ['10000']
}, {
    name: "12800",
    ev: -7,
    values: ['12800']
}, {
    name: "16000",
    ev: -7 - 1 / 3,
    values: ['16000']
}, {
    name: "19200",
    ev: -7.5,
    values: ['19200']
}, {
    name: "20000",
    ev: -7 - 2 / 3,
    values: ['20000']
}, {
    name: "25600",
    ev: -8,
    values: ['25600']
}, {
    name: "32000",
    ev: -8 - 1 / 3,
    values: ['32000']
}, {
    name: "38400",
    ev: -8.5,
    values: ['38400']
}, {
    name: "40000",
    ev: -8 - 2 / 3,
    values: ['40000']
}, {
    name: "51200",
    ev: -9,
    values: ['51200']
}, {
    name: "64000",
    ev: -9 - 1 / 3,
    values: ['64000']
}, {
    name: "76800",
    ev: -9.5,
    values: ['76800']
}, {
    name: "80000",
    ev: -9 - 2 / 3,
    values: ['81000', '80000']
}, {
    name: "102400",
    ev: -10,
    values: ['102400']
}, {
    name: "128000",
    ev: -10 - 1 / 3,
    values: ['129000', '128000']
}, {
    name: "153600",
    ev: -10.5,
    values: ['153600', '150000']
}, {
    name: "160000",
    ev: -10 - 2 / 3,
    values: ['162000', '160000']
}, {
    name: "204800",
    ev: -11,
    values: ['204800']
}, {
    name: "256000",
    ev: -11 - 1 / 3,
    values: ['256000']
}, {
    name: "307200",
    ev: -11.5,
    values: ['307300', '300000']
}, {
    name: "320000",
    ev: -11 - 2 / 3,
    values: ['320000']
}, {
    name: "409600",
    ev: -12,
    values: ['409600']
}];

lists.isoThirds = filterList(lists.isoAll, 1/3);
lists.isoHalfs = filterList(lists.isoAll, 1/2);
lists.iso = lists.isoThirds;

lists.apertureAll = [{
    name: "1.0",
    ev: -8,
    values: ['1.0', 'f/1.0', 'f1.0', 'f/1', '1,0']
}, {
    name: "1.1",
    ev: -7 - 2 / 3,
    values: ['1.1', 'f/1.1', 'f1.1', '1,1']
}, {
    name: "1.2",
    ev: -7.5,
    values: ['1.2', 'f/1.2', 'f1.2', '1,2']
}, {
    name: "1.2",
    ev: -7 - 1 / 3,
    values: ['1.2', 'f/1.2', 'f1.2', '1,2', '120']
}, {
    name: "1.4",
    ev: -7,
    values: ['1.4', 'f/1.4', 'f1.4', '1,4', '140']
}, {
    name: "1.6",
    ev: -6 - 2 / 3,
    values: ['1.6', 'f/1.6', 'f1.6', '1,6', '160']
}, {
    name: "1.7",
    ev: -6.5,
    values: ['1.7', 'f/1.7', 'f1.7', '1,7']
}, {
    name: "1.8",
    ev: -6 - 1 / 3,
    values: ['1.8', 'f/1.8', 'f1.8', '1,8', '180']
}, {
    name: "2.0",
    ev: -6,
    values: ['2.0', 'f/2.0', 'f2.0', 'f/2', '200']
}, {
    name: "2.2",
    ev: -5 - 2 / 3,
    values: ['2.2', 'f/2.2', 'f2.2', '2,2', '220']
}, {
    name: "2.4",
    ev: -5.5,
    values: ['2.4', 'f/2.4', 'f2.4', '2,4']
}, {
    name: "2.5",
    ev: -5 - 1 / 3,
    values: ['2.5', 'f/2.5', 'f2.5', '2,5', '250']
}, {
    name: "2.8",
    ev: -5,
    values: ['2.8', 'f/2.8', 'f2.8', '2,8', '280']
}, {
    name: "3.2",
    ev: -4 - 2 / 3,
    values: ['3.2', 'f/3.2', 'f3.2', '3,2', '320']
}, {
    name: "3.3",
    ev: -4.5,
    values: ['3.3', 'f/3.3', 'f3.3', '3,3']
}, {
    name: "3.5",
    ev: -4 - 1 / 3,
    values: ['3.5', 'f/3.5', 'f3.5', '3,5', '350']
}, {
    name: "3.8",
    ev: -4.25,
    values: ['3.8', 'f/3.8', 'f3.8', '3,8']
}, {
    name: "4",
    ev: -4,
    values: ['4', 'f/4', 'f4', 'f4.0', '4.0', '4,0', '400']
}, {
    name: "4.2",
    ev: -3.75,
    values: ['4.2', 'f/4.2', 'f4.2', '4.2', '4,2']
}, {
    name: "4.5",
    ev: -3 - 2 / 3,
    values: ['4.5', 'f/4.5', 'f4.5', '4,5', '450']
}, {
    name: "4.8",
    ev: -3.5,
    values: ['4.8', 'f/4.8', 'f4.8', '4,8']
}, {
    name: "5",
    ev: -3 - 1 / 3,
    values: ['5', 'f/5', 'f5', '5.0', '5,0', '500']
}, {
    name: "5.3",
    ev: -3.25,
    values: ['5.3', 'f/5.3', 'f5.3', '5.3', '5,3']
}, {
    name: "5.6",
    ev: -3,
    values: ['5.6', 'f/5.6', 'f5.6', '5,6', '560']
}, {
    name: "6.3",
    ev: -2 - 2 / 3,
    values: ['6.3', 'f/6.3', 'f6.3', '6,3', '640']
}, {
    name: "6.7",
    ev: -2.5,
    values: ['6.7', 'f/6.7', 'f6.7', '6,7']
}, {
    name: "7.1",
    ev: -2 - 1 / 3,
    values: ['7.1', 'f/7.1', 'f7.1', '7,1', '710']
}, {
    name: "8",
    ev: -2,
    values: ['8', 'f/8', 'f8', '8.0', '8,0', '800']
}, {
    name: "9",
    ev: -1 - 2 / 3,
    values: ['9', 'f/9', 'f9', '9.0', '9,0', '900']
}, {
    name: "9.5",
    ev: -1.5,
    values: ['9.5', 'f/9.5', 'f9.5', '9,5']
}, {
    name: "10",
    ev: -1 - 1 / 3,
    values: ['10', 'f/10', 'f10', '1000']
}, {
    name: "11",
    ev: -1,
    values: ['11', 'f/11', 'f11', '1100']
}, {
    name: "13",
    ev: -2 / 3,
    values: ['13', 'f/13', 'f13', '1300']
}, {
    name: "13",
    ev: -0.5,
    values: ['13', 'f/13', 'f13']
}, {
    name: "14",
    ev: -1 / 3,
    values: ['14', 'f/14', 'f14', '1400']
}, {
    name: "16",
    ev: 0,
    values: ['16', 'f/16', 'f16', '1600']
}, {
    name: "18",
    ev: 1 / 3,
    values: ['18', 'f/18', 'f18', '1800']
}, {
    name: "19",
    ev: 0.5,
    values: ['19', 'f/19', 'f19']
}, {
    name: "20",
    ev: 2 / 3,
    values: ['20', 'f/20', 'f20', '2000']
}, {
    name: "22",
    ev: 1,
    values: ['22', 'f/22', 'f22', '2200']
}, {
    name: "25",
    ev: 1 + 1 / 3,
    values: ['25', 'f/25', 'f25']
}, {
    name: "29",
    ev: 1 + 2 / 3,
    values: ['29', 'f/29', 'f29']
}, {
    name: "32",
    ev: 2,
    values: ['32', 'f/32', 'f32']
}, {
    name: "35",
    ev: 2.5,
    values: ['35', 'f/35', 'f35']
}, {
    name: "36",
    ev: 2 + 1 / 3,
    values: ['36', 'f/36', 'f36']
}];

lists.apertureThirds = filterList(lists.apertureAll, 1/3);
lists.apertureHalfs = filterList(lists.apertureAll, 1/2);
lists.aperture = lists.apertureThirds;


// Sony values are listed first
lists.shutterAll = [{
    name: "BULB",
    ev: null,
    values: ['Bulb', 'bulb', '65535/65535']
}, {
    name: "30s",
    ev: -11,
    values: ['300/10', '30', '30.0000s', '30"', '32000000']
}, {
    name: "25s",
    ev: -10 - 2 / 3,
    values: ['250/10', '25', '25.0000s', '25"', '25398416']
}, {
    name: "24s",
    ev: -10.5,
    values: ['240/10', '24', '24.0000s', '24"']
}, {
    name: "20s",
    ev: -10 - 1 / 3,
    values: ['200/10', '20', '20.0000s', '20"', '20158736']
}, {
    name: "15s",
    ev: -10,
    values: ['150/10', '15', '15.0000s', '15"', '16000000']
}, {
    name: "13s",
    ev: -9 - 2 / 3,
    values: ['130/10', '13', '13.0000s', '13"', '12699208']
}, {
    name: "12s",
    ev: -9.5,
    values: ['120/10', '12', '12.0000s', '12"']
}, {
    name: "10s",
    ev: -9 - 1 / 3,
    values: ['100/10', '10', '10.0000s', '10"', '10079368']
}, {
    name: "8s",
    ev: -9,
    values: ['80/10', '8', '8.0000s', '8"', '8000000']
}, {
    name: "6s",
    ev: -8 - 2 / 3,
    values: ['60/10', '6', '6.0000s', '6"', '6349604']
}, {
    name: "6s",
    ev: -8.5,
    values: ['60/10', '6', '6.0000s', '6"']
}, {
    name: "5s",
    ev: -8 - 1 / 3,
    values: ['50/10', '5', '5.0000s', '5"', '5039684']
}, {
    name: "4s",
    ev: -8,
    values: ['40/10', '4', '4.0000s', '4"', '4000000']
}, {
    name: "3s",
    ev: -7 - 2 / 3,
    values: ['32/10', '3', '3.2', '3.2000s', '3.2"', '3,2"', '3174802']
}, {
    name: "3s",
    ev: -7.5,
    values: ['30/10', '3', '3.0', '3.0000s', '3"']
}, {
    name: "2.5s",
    ev: -7 - 1 / 3,
    values: ['25/10', '2.5', '2.5000s', '2.5"', '2,5"', '2519842']
}, {
    name: "2s",
    ev: -7,
    values: ['20/10', '2', '2.0000s', '2"', '2000000']
}, {
    name: "1.6s",
    ev: -6 - 2 / 3,
    values: ['16/10', '1.6', '1.6000s', '1.6"', '1,6"', '1414213']
}, {
    name: "1.5s",
    ev: -6.5,
    values: ['15/10', '1.5', '1.5000s', '1.5"', '1,5"']
}, {
    name: "1.3s",
    ev: -6 - 1 / 3,
    values: ['13/10', '1.3', '1.3000s', '1.3"', '1,3"', '1259921']
}, {
    name: "1s",
    ev: -6,
    values: ['10/10', '1', '1.0000s', '10/10', '1"', '1000000']
}, {
    name: "0.8s",
    ev: -5 - 2 / 3,
    values: ['8/10', '0.8', '10/13', '0.7692s', '0.8"', '0,8"', '793700']
}, {
    name: "0.7s",
    ev: -5.5,
    values: ['7/10', '0.7', '10/15', '0.7000s', '0.7"', '0,7"']
}, {
    name: "0.6s",
    ev: -5 - 1 / 3,
    values: ['6/10', '0.625', '0.6', '10/16', '0.6250s', '0.6"', '0,6"', '629960']
}, {
    name: "1/2",
    ev: -5,
    values: ['5/10', '0.5', '1/2', '0.5000s', '0.5"', '0,5"', '500000']
}, {
    name: "0.4s",
    ev: -4 - 2 / 3,
    values: ['4/10', '0.4', '10/25', '0.4000s', '0.4"', '0,4"', '396850']
}, {
    name: "1/3",
    ev: -4.5,
    values: ['1/3', '0.3', '10/30', '0.3333s', '0,3"']
}, {
    name: "1/3",
    ev: -4 - 1 / 3,
    values: ['1/3', '0.3', '0.3125s', '314980']
}, {
    name: "1/4",
    ev: -4,
    values: ['1/4', '0.2500s', '250000']
}, {
    name: "1/5",
    ev: -3 - 2 / 3,
    values: ['1/5', '0.2000s', '198425']
}, {
    name: "1/6",
    ev: -3.5,
    values: ['1/6', '0.1875s']
}, {
    name: "1/6",
    ev: -3 - 1 / 3,
    values: ['1/6', '0.1666s', '157490']
}, {
    name: "1/8",
    ev: -3,
    values: ['1/8', '0.1250s', '125000']
}, {
    name: "1/10",
    ev: -2 - 2 / 3,
    values: ['1/10', '0.1000s', '99212']
}, {
    name: "1/10",
    ev: -2.5,
    values: ['1/10', '0.0937s']
}, {
    name: "1/13",
    ev: -2 - 1 / 3,
    values: ['1/13', '0.0769s', '78745']
}, {
    name: "1/15",
    ev: -2,
    values: ['1/15', '0.0666s', '62500']
}, {
    name: "1/20",
    ev: -1 - 2 / 3,
    values: ['1/20', '0.0500s', '49606']
}, {
    name: "1/20",
    ev: -1.5,
    values: ['1/20', '0.0479s']
}, {
    name: "1/25",
    ev: -1 - 1 / 3,
    values: ['1/25', '0.0400s', '39372']
}, {
    name: "1/30",
    ev: -1,
    values: ['1/30', '0.0333s', '31250']
}, {
    name: "1/40",
    ev: -2 / 3,
    values: ['1/40', '0.0250s', '24803']
}, {
    name: "1/45",
    ev: -0.5,
    values: ['1/45', '0.0222s']
}, {
    name: "1/50",
    ev: -1 / 3,
    values: ['1/50', '0.0200s', '19686']
}, {
    name: "1/60",
    ev: 0,
    values: ['1/60', '0.0166s', '15625']
}, {
    name: "1/80",
    ev: 1 / 3,
    values: ['1/80', '0.0125s', '12401']
}, {
    name: "1/90",
    ev: 0.5,
    values: ['1/90', '0.0111s']
}, {
    name: "1/100",
    ev: 2 / 3,
    values: ['1/100', '0.0100s', '9843']
}, {
    name: "1/125",
    ev: 1,
    values: ['1/125', '0.0080s', '7812']
}, {
    name: "1/160",
    ev: 1 + 1 / 3,
    values: ['1/160', '0.0062s', '6200']
}, {
    name: "1/180",
    ev: 1.5,
    values: ['1/180', '0.0055s', '5524']
}, {
    name: "1/200",
    ev: 1 + 2 / 3,
    values: ['1/200', '0.0050s', '4921']
}, {
    name: "1/250",
    ev: 2,
    values: ['1/250', '0.0040s', '3906']
}, {
    name: "1/320",
    ev: 2 + 1 / 3,
    values: ['1/320', '0.0031s', '3100']
}, {
    name: "1/350",
    ev: 2.5,
    values: ['1/350', '0.0028s']
}, {
    name: "1/400",
    ev: 2 + 2 / 3,
    values: ['1/400', '0.0025s', '2460']
}, {
    name: "1/500",
    ev: 3,
    values: ['1/500', '0.0020s', '1953']
}, {
    name: "1/640",
    ev: 3 + 1 / 3,
    values: ['1/640', '0.0015s', '1550']
}, {
    name: "1/750",
    ev: 3.5,
    values: ['1/750', '0.0013s']
}, {
    name: "1/800",
    ev: 3 + 2 / 3,
    values: ['1/800', '0.0012s', '1230']
}, {
    name: "1/1000",
    ev: 4,
    values: ['1/1000', '0.0010s', '976']
}, {
    name: "1/1250",
    ev: 4 + 1 / 3,
    values: ['1/1250', '0.0007s', '775']
}, {
    name: "1/1500",
    ev: 4.5,
    values: ['1/1500', '0.0007s']
}, {
    name: "1/1600",
    ev: 4 + 2 / 3,
    values: ['1/1600', '0.0006s', '615']
}, {
    name: "1/2000",
    ev: 5,
    values: ['1/2000', '0.0005s', '488']
}, {
    name: "1/2500",
    ev: 5 + 1 / 3,
    values: ['1/2500', '0.0004s', '387']
}, {
    name: "1/3000",
    ev: 5.5,
    values: ['1/3000', '0.0003s']
}, {
    name: "1/3200",
    ev: 5 + 2 / 3,
    values: ['1/3200', '0.0003s', '307']
}, {
    name: "1/4000",
    ev: 6,
    values: ['1/4000', '0.0002s', '244']
}, {
    name: "1/5000",
    ev: 6 + 1 / 3,
    values: ['1/5000']
}, {
    name: "1/6000",
    ev: 6.5,
    values: ['1/6000']
}, {
    name: "1/6400",
    ev: 6 + 2 / 3,
    values: ['1/6400', '0.0001s']
}, {
    name: "1/8000",
    ev: 7,
    values: ['1/8000']
}];

lists.shutterThirds = filterList(lists.shutterAll, 1/3);
lists.shutterHalfs = filterList(lists.shutterAll, 1/2);
lists.shutter = lists.shutterThirds;

lists.bulb = [];

var start = 1000000 / 64; // 1/60
var ev = 0;
var us = start;

while (us < 1000000 * 60 * 10) {
    var tus = us;
    for (var thirds = 0; thirds < 3; thirds++) {
        if (thirds) tus *= 1.25992104989;
        var name = null;
        for (var i = 0; i < lists.shutter.length; i++) {
            if (lists.shutter[i].ev != null && Math.ceil(lists.shutter[i].ev * 10) === Math.ceil(-(ev + thirds / 3) * 10)) {
                name = lists.shutter[i].name;
                break;
            }
        }
        if (!name) {
            name = Math.ceil(tus / 1000000).toString() + 's';
        }
        var item = {
                name: name,
                ev: -(ev + thirds / 3),
                us: tus,
            }
            //console.log(item);
        lists.bulb.unshift(item);
    }
    ev++;
    us *= 2;
}


module.exports = lists;