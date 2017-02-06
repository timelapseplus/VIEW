exports.linear = function(xyPoints, xVal) {
    // validate and sort by x
    var p = xyPoints.filter(function(item) {
        return item.x !== undefined && item.y !== undefined;
    }).sort(function(a, b) {
        return a.x - b.x;
    });

    if(typeof p != 'array' || p.length == 0) return null;

    var limits = {max: p[0].y, min: p[0].y};

    for(var i = 0; i < p.length; i++) {
        if(limits.max < p[i].y) limits.max = p[i].y;
        if(limits.min > p[i].y) limits.min = p[i].y;
    }

    console.log("---- interpolate.linear ----");
    console.log("xyPoints:", p);
    console.log("xVal:", xVal);

    var res = null;
    for (var i = 0; i < p.length; i++) {
        if (i == 0 && xVal <= p[i].x) {
            res = p[i].y;
            break;
        }
        if (i > 0 && xVal < p[i].x) {
            var xRange = p[i].x - p[i - 1].x;
            var factor = (xVal - p[i - 1].x) / xRange;
            if (factor <= 1.0) {
                var yRange = p[i].y - p[i - 1].y;
                res = p[i - 1].y + yRange * factor;
                break;
            }
        }
        if (i == p.length - 1 && xVal >= p[i].x) {
            res = p[i].y;
            break;
        }
    }

    // safety check
    if(res > limits.max) res = limits.max;
    if(res < limits.min) res = limits.min;

    console.log("Interpolated result:", res);

    return res;
}

 //var f = [ {x:0,y:0},{x:5,y:5},{x:10,y:50} ];