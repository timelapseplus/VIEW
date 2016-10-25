var lists = {};

lists.paramMap = [{
    name: "target",
    maps: [{
        section: "settings",
        item: "capturetarget"
    }]
}, {
    name: "liveview",
    type: "toggle",
    maps: [{
        section: "actions",
        item: "viewfinder"
    }]
}, {
    name: "iso",
    maps: [{
        section: "imgsettings",
        item: "iso"
    }]
}, {
    name: "aperture",
    maps: [{
        section: "capturesettings",
        item: "aperture"
    }, {
        section: "capturesettings",
        item: "f-number"
    }]
}, {
    name: "shutter",
    maps: [{
        section: "capturesettings",
        item: "shutterspeed2"
    }, {
        section: "capturesettings",
        item: "shutterspeed"
    }]
}];

lists.cleanEvCopy = function(itemList) {
    return itemList.filter(function(item) {
        return item.ev !== null
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
        if (lists.bulb[i].ev > ev) {
            return lists.bulb[i].us / 1000000;
        }
    }
    return 1;
}

lists.getEv = function(shutter, aperture, iso) {
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

lists.target = [{
    name: "RAM",
    values: ['Internal RAM']
}, {
    name: "CARD",
    values: ['Memory card']
}];

lists.liveview = [{
    name: "on",
    values: ['2']
}, {
    name: "off",
    values: ['0']
}];

//sunny f/16 1/60 ISO100 = EV15
lists.iso = [{
    name: "Auto",
    ev: null,
    values: ['Auto', 'auto', 'AUTO']
/*}, {
    name: "25",
    ev: 2,
    values: ['25']
}, {
    name: "32",
    ev: 1 + 2 / 3,
    values: ['32']
}, {
    name: "40",
    ev: 1 + 1 / 3,
    values: ['40']*/
}, {
    name: "50",
    ev: 1,
    values: ['50']
}, {
    name: "64",
    ev: 2 / 3,
    values: ['64']
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
    name: "320000",
    ev: -11 - 2 / 3,
    values: ['320000']
}, {
    name: "409600",
    ev: -12,
    values: ['409600']
}];


lists.aperture = [{
    name: "1.0",
    ev: -8,
    values: ['1.0', 'f/1.0', 'f1.0', 'f/1']
}, {
    name: "1.1",
    ev: -7 - 2 / 3,
    values: ['1.1', 'f/1.1', 'f1.1']
}, {
    name: "1.2",
    ev: -7 - 1 / 3,
    values: ['1.2', 'f/1.2', 'f1.2']
}, {
    name: "1.4",
    ev: -7,
    values: ['1.4', 'f/1.4', 'f1.4']
}, {
    name: "1.6",
    ev: -6 - 2 / 3,
    values: ['1.6', 'f/1.6', 'f1.6']
}, {
    name: "1.8",
    ev: -6 - 1 / 3,
    values: ['1.8', 'f/1.8', 'f1.8']
}, {
    name: "2.0",
    ev: -6,
    values: ['2.0', 'f/2.0', 'f2.0', 'f/2']
}, {
    name: "2.2",
    ev: -5 - 2 / 3,
    values: ['2.2', 'f/2.2', 'f2.2']
}, {
    name: "2.5",
    ev: -5 - 1 / 3,
    values: ['2.5', 'f/2.5', 'f2.5']
}, {
    name: "2.8",
    ev: -5,
    values: ['2.8', 'f/2.8', 'f2.8']
}, {
    name: "3.2",
    ev: -4 - 2 / 3,
    values: ['3.2', 'f/3.2', 'f3.2']
}, {
    name: "3.5",
    ev: -4 - 1 / 3,
    values: ['3.5', 'f/3.5', 'f3.5']
}, {
    name: "4",
    ev: -4,
    values: ['4', 'f/4', 'f4', 'f4.0']
}, {
    name: "4.5",
    ev: -3 - 2 / 3,
    values: ['4.5', 'f/4.5', 'f4.5']
}, {
    name: "5",
    ev: -3 - 1 / 3,
    values: ['5', 'f/5', 'f5']
}, {
    name: "5.6",
    ev: -3,
    values: ['5.6', 'f/5.6', 'f5.6']
}, {
    name: "6.3",
    ev: -2 - 2 / 3,
    values: ['6.3', 'f/6.3', 'f6.3']
}, {
    name: "7.1",
    ev: -2 - 1 / 3,
    values: ['7.1', 'f/7.1', 'f7.1']
}, {
    name: "8",
    ev: -2,
    values: ['8', 'f/8', 'f8']
}, {
    name: "9",
    ev: -1 - 2 / 3,
    values: ['9', 'f/9', 'f9']
}, {
    name: "10",
    ev: -1 - 1 / 3,
    values: ['10', 'f/10', 'f10']
}, {
    name: "11",
    ev: -1,
    values: ['11', 'f/11', 'f11']
}, {
    name: "13",
    ev: -2 / 3,
    values: ['13', 'f/13', 'f13']
}, {
    name: "14",
    ev: -1 / 3,
    values: ['14', 'f/14', 'f14']
}, {
    name: "16",
    ev: 0,
    values: ['16', 'f/16', 'f16']
}, {
    name: "18",
    ev: 1 / 3,
    values: ['18', 'f/18', 'f18']
}, {
    name: "20",
    ev: 2 / 3,
    values: ['20', 'f/20', 'f20']
}, {
    name: "22",
    ev: 1,
    values: ['22', 'f/22', 'f22']
}];

// Sony values are listed first
lists.shutter = [{
    name: "BULB",
    ev: null,
    values: ['Bulb', 'bulb', '65535/65535']
}, {
    name: "30s",
    ev: -11,
    values: ['300/10', '30', 30, '30.0000s']
}, {
    name: "25s",
    ev: -10 - 2 / 3,
    values: ['250/10', '25', 25, '25.0000s']
}, {
    name: "20s",
    ev: -10 - 1 / 3,
    values: ['200/10', '20', 20, '20.0000s']
}, {
    name: "15s",
    ev: -10,
    values: ['150/10', '15', 15, '15.0000s']
}, {
    name: "13s",
    ev: -9 - 2 / 3,
    values: ['130/10', '13', 13, '13.0000s']
}, {
    name: "10s",
    ev: -9 - 1 / 3,
    values: ['100/10', '10', 10, '10.0000s']
}, {
    name: "8s",
    ev: -9,
    values: ['80/10', '8', 8, '8.0000s']
}, {
    name: "6s",
    ev: -8 - 2 / 3,
    values: ['60/10', '6', 6, '6.0000s']
}, {
    name: "5s",
    ev: -8 - 1 / 3,
    values: ['50/10', '5', 5, '5.0000s']
}, {
    name: "4s",
    ev: -8,
    values: ['40/10', '4', 4, '4.0000s']
}, {
    name: "3s",
    ev: -7 - 2 / 3,
    values: ['32/10', '3', '3.2', 3, '3.2000s']
}, {
    name: "2.5s",
    ev: -7 - 1 / 3,
    values: ['25/10', '2.5', 25 / 10, '2.5000s']
}, {
    name: "2s",
    ev: -7,
    values: ['20/10', '2', 2, '2.0000s']
}, {
    name: "1.6s",
    ev: -6 - 2 / 3,
    values: ['16/10', '1.6', 16 / 10, '1.6000s']
}, {
    name: "1.3s",
    ev: -6 - 1 / 3,
    values: ['13/10', '1.3', 13 / 10, '1.3000s']
}, {
    name: "1s",
    ev: -6,
    values: ['10/10', '1', 1, '1.0000s', '10/10']
}, {
    name: "0.8s",
    ev: -5 - 2 / 3,
    values: ['8/10', '0.8', '10/13', '0.7692s']
}, {
    name: "0.6s",
    ev: -5 - 1 / 3,
    values: ['6/10', '0.625', '0.6', '10/16', '0.6250s']
}, {
    name: "1/2",
    ev: -5,
    values: ['5/10', '0.5', '1/2', '0.5000s']
}, {
    name: "0.4s",
    ev: -4 - 2 / 3,
    values: ['4/10', '0.4', '10/25', '0.4000s']
}, {
    name: "1/3",
    ev: -4 - 1 / 3,
    values: ['1/3', '1/3', '0.3', 1 / 3, '0.3125s']
}, {
    name: "1/4",
    ev: -4,
    values: ['1/4', 1 / 4, '0.2500s']
}, {
    name: "1/5",
    ev: -3 - 2 / 3,
    values: ['1/5', 1 / 5, '0.2000s']
}, {
    name: "1/6",
    ev: -3 - 1 / 3,
    values: ['1/6', 1 / 6, '0.1666s']
}, {
    name: "1/8",
    ev: -3,
    values: ['1/8', 1 / 8, '0.1250s']
}, {
    name: "1/10",
    ev: -2 - 2 / 3,
    values: ['1/10', 1 / 10, '0.1000s']
}, {
    name: "1/13",
    ev: -2 - 1 / 3,
    values: ['1/13', 1 / 13, '0.0769s']
}, {
    name: "1/15",
    ev: -2,
    values: ['1/15', 1 / 15, '0.0666s']
}, {
    name: "1/20",
    ev: -1 - 2 / 3,
    values: ['1/20', 1 / 20, '0.0500s']
}, {
    name: "1/25",
    ev: -1 - 1 / 3,
    values: ['1/25', 1 / 25, '0.0400s']
}, {
    name: "1/30",
    ev: -1,
    values: ['1/30', 1 / 30, '0.0333s']
}, {
    name: "1/40",
    ev: -2 / 3,
    values: ['1/40', 1 / 40, '0.0250s']
}, {
    name: "1/50",
    ev: -1 / 3,
    values: ['1/50', 1 / 50, '0.0200s']
}, {
    name: "1/60",
    ev: 0,
    values: ['1/60', 1 / 60, '0.0166s']
}, {
    name: "1/80",
    ev: 1 / 3,
    values: ['1/80', 1 / 80, '0.0125s']
}, {
    name: "1/100",
    ev: 2 / 3,
    values: ['1/100', 1 / 100, '0.0100s']
}, {
    name: "1/125",
    ev: 1,
    values: ['1/125', 1 / 125, '0.0080s']
}, {
    name: "1/160",
    ev: 1 + 1 / 3,
    values: ['1/160', 1 / 160, '0.0062s']
}, {
    name: "1/200",
    ev: 1 + 2 / 3,
    values: ['1/200', 1 / 200, '0.0050s']
}, {
    name: "1/250",
    ev: 2,
    values: ['1/250', 1 / 250, '0.0040s']
}, {
    name: "1/320",
    ev: 2 + 1 / 3,
    values: ['1/320', 1 / 320, '0.0031s']
}, {
    name: "1/400",
    ev: 2 + 2 / 3,
    values: ['1/400', 1 / 400, '0.0025s']
}, {
    name: "1/500",
    ev: 3,
    values: ['1/500', 1 / 500, '0.0020s']
}, {
    name: "1/640",
    ev: 3 + 1 / 3,
    values: ['1/640', 1 / 640, '0.0015s']
}, {
    name: "1/800",
    ev: 3 + 2 / 3,
    values: ['1/800', 1 / 800, '0.0012s']
}, {
    name: "1/1000",
    ev: 4,
    values: ['1/1000', 1 / 1000, '0.0010s']
}, {
    name: "1/1250",
    ev: 4 + 1 / 3,
    values: ['1/1250', 1 / 1250, '0.0007s']
}, {
    name: "1/1600",
    ev: 4 + 2 / 3,
    values: ['1/1600', 1 / 1600, '0.0006s']
}, {
    name: "1/2000",
    ev: 5,
    values: ['1/2000', 1 / 2000, '0.0005s']
}, {
    name: "1/2500",
    ev: 5 + 1 / 3,
    values: ['1/2500', 1 / 2500, '0.0004s']
}, {
    name: "1/3200",
    ev: 5 + 2 / 3,
    values: ['1/3200', 1 / 3200, '0.0003s']
}, {
    name: "1/4000",
    ev: 6,
    values: ['1/4000', 1 / 4000, '0.0002s']
}, {
    name: "1/5000",
    ev: 6 + 1 / 3,
    values: ['1/5000', 1 / 5000]
}, {
    name: "1/6400",
    ev: 6 + 2 / 3,
    values: ['1/6400', 1 / 6400, '0.0001s']
}, {
    name: "1/8000",
    ev: 7,
    values: ['1/8000', 1 / 8000]
}];


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
            if (lists.shutter[i].ev !== null && Math.ceil(lists.shutter[i].ev * 10) === Math.ceil(-(ev + thirds / 3) * 10)) {
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