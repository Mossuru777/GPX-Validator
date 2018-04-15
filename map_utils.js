"use strict";

function getBounds(mapData) {
    var result = {s: 90.0, n: -90, e: -180.0, w: 180.0};
    for (var i = 0; i < mapData.segments.length; i++) {
        for (var j = 0; j < mapData.segments[i].length; j++) {
            var point = mapData.segments[i][j];
            if (result.s > point.loc[0]) result.s = point.loc[0];
            if (result.n < point.loc[0]) result.n = point.loc[0];
            if (result.e < point.loc[1]) result.e = point.loc[1];
            if (result.w > point.loc[1]) result.w = point.loc[1];
        }
    }
    return result;
}