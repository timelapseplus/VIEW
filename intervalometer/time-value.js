/* Time-Value Array Functions
 *
 * operations on arrays of objects
 * with a val field and a time field
 *
 */

function tvSum(tvArr) {
    return tvArr.reduce(function(sum, item) {
        return sum + item.val;
    }, 0);
}

function tvMean(tvArr) {
    return tvSum(tvArr) / tvArr.length;
}

function tvSlopes(tvArr) { // as change per second
    if (tvArr.length < 2) return [{
        val: 0,
        time: new Date()
    }];
    var sortedTv = tvArr.sort(function(a, b) {
        return a.time - b.time;
    });
    var slopes = [];
    for (var i = 1; i < sortedTv.length; i++) {
        slopes.push({
            val: ((sortedTv[i].val - sortedTv[i - 1].val) * (1000 / (sortedTv[i].time - sortedTv[i - 1].time))),
            time: sortedTv[i].time
        });
    }
    return slopes;
}

//((1 - 2) * (1000 / (1000 - 2000)))

function tvInsideArray(tvArr, outerTrimCount) {
    if (outerTrimCount * 2 >= tvArr.length) {
        outerTrimCount = Math.floor(tvArr.length / 2) - 2;
        if (outerTrimCount < 1 || tvArr.length - outerTrimCount * 2 < 1) return tvArr; // to small to trim
    }
    return tvArr.slice(outerTrimCount, -outerTrimCount);
}

function tvPurgeArray(tvArr, maxAgeSeconds) {
    return tvArr.filter(function(item) {
        return item.time > new Date() - maxAgeSeconds * 1000;
    });
}

module.exports = {
    sum: tvSum,
    mean: tvMean,
    slopes: tvSlopes,
    insideArray: tvInsideArray,
    purgeArray: tvPurgeArray
}