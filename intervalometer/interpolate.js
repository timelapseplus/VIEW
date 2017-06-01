exports.linear = function(xyPoints, xVal) {
    // validate and sort by x
    var p = xyPoints.filter(function(item) {
        return item.x !== undefined && item.y !== undefined;
    }).sort(function(a, b) {
        return a.x - b.x;
    });

    if(typeof p != 'object' || !p.length) return null;

    var limits = {max: p[0].y, min: p[0].y};

    for(var i = 0; i < p.length; i++) {
        if(limits.max < p[i].y) limits.max = p[i].y;
        if(limits.min > p[i].y) limits.min = p[i].y;
    }

    //console.log("---- interpolate.linear ----");
    //console.log("xyPoints:", p);
    //console.log("xVal:", xVal);

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

    //console.log("Interpolated result:", res);

    return res;
}



 //var f = [ {x:0,y:0},{x:5,y:5},{x:10,y:50} ];

var vec2 = {};
vec2.add = function(out, a, b) {
    out[0] = a[0] + b[0]
    out[1] = a[1] + b[1]
    return out
}
vec2.scale = function(out, a, b) {
    out[0] = a[0] * b
    out[1] = a[1] * b
    return out
}
vec2.distance = function(a, b) {
    var x = b[0] - a[0],
        y = b[1] - a[1]
    return Math.sqrt(x*x + y*y)
}

var interpolatePoint = function(p0, p1, p2, p3, t0, t1, t2, t3, t) {
  var a1, a2, a3, b1, b2, c;
  a1 = [];
  a2 = [];
  a3 = [];
  b1 = [];
  b2 = [];
  c = [];

  vec2.add(a1, vec2.scale([], p0, (t1 - t)/(t1 - t0)), vec2.scale([], p1, (t - t0)/(t1 - t0)));
  vec2.add(a2, vec2.scale([], p1, (t2 - t)/(t2 - t1)), vec2.scale([], p2, (t - t1)/(t2 - t1)));
  vec2.add(a3, vec2.scale([], p2, (t3 - t)/(t3 - t2)), vec2.scale([], p3, (t - t2)/(t3 - t2)));

  vec2.add(b1, vec2.scale([], a1, (t2 - t)/(t2 - t0)), vec2.scale([], a2, (t - t0)/(t2 - t0)));
  vec2.add(b2, vec2.scale([], a2, (t3 - t)/(t3 - t1)), vec2.scale([], a3, (t - t1)/(t3 - t1)));

  vec2.add(c, vec2.scale([], b1, (t2 - t)/(t2 - t1)), vec2.scale([], b2, (t - t1)/(t2 - t1)));
  //console.log("c = ", c);
  return c[1];
};

var catmullRomSplineSegment = function(p0, p1, p2, p3, xVal, knot) {
  var t, t0, t1, t2, t3, segmentDist;

  p0 = [p0.x, p0.y];
  p1 = [p1.x, p1.y];
  p2 = [p2.x, p2.y];
  p3 = [p3.x, p3.y];

  segmentDist = vec2.distance(p1, p2);

  t0 = 0;
  t1 = Math.pow(vec2.distance(p0, p1), knot);
  t2 = Math.pow(segmentDist, knot) + t1;
  t3 = Math.pow(vec2.distance(p2, p3), knot) + t2;

  var f = (xVal - p1[0]) / (p2[0] - p1[0]);
  var t = t1 + (t2 - t1) * f;

  //console.log("====== t", t1, t, t2, p1);

  return interpolatePoint(p0, p1, p2, p3, t0, t1, t2, t3, t);
};

exports.catmullRomSpline = function(xyPoints, xVal) {
  var knot = 0.5;
  var easeInOut = 20;

    var xyPoints = xyPoints.filter(function(item) {
        return item.x !== undefined && item.y !== undefined;
    }).sort(function(a, b) {
        return a.x - b.x;
    });

  if (!xyPoints || xyPoints.length == 0) {
    return null;

  } else if(xVal <= xyPoints[0].x) {
    return xyPoints[0].y; 
  
  } else if(xVal >= xyPoints[xyPoints.length - 1].x) {
    return xyPoints[xyPoints.length - 1].y; 

  } else if(xyPoints.length == 1) {
    return xyPoints[0].y;

  } else {
    var over = (xyPoints[1].x - xyPoints[0].x) / easeInOut;
    xyPoints = [{x: xyPoints[0].x - over, y: xyPoints[0].y}].concat(xyPoints, {x: xyPoints[xyPoints.length - 1].x + over, y: xyPoints[xyPoints.length - 1].y});
  }

  var p0, p1, p2, p3, offset;

  for(var i = 0; i < xyPoints.length - 3; i++) {
    offset = 1;
    p0 = xyPoints[i];

    do {
      p1 = xyPoints[i + offset];
      offset++;
    } while (p0 && p1 && p0.x === p1.x && p0.y === p1.y);

    do {
      p2 = xyPoints[i + offset];
      offset++;
    } while (p1 && p2 && p1.x === p2.x && p1.y === p2.y);

    do {
      p3 = xyPoints[i + offset];
      offset++;
    } while (p2 && p3 && p2.x === p3.x && p2.y === p3.y);

    if(!(xVal >= p1.x && xVal < p2.x)) continue;

    //console.log("found", p0, p1, "*"+xVal.toString(), p2, p3);
    return catmullRomSplineSegment(p0, p1, p2, p3, xVal, knot);
  }

  return null;//"err1";
};

