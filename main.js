"use strict";

$(function () {
    var polyline_colors = ["#ff1a1a", "#ff8c1a", "#1aff1a", "#1affff", "#1a1aff", "#8c1aff", "#ff1ac6"];

    var dl_gpx_button = $("#dl_valid_gpx");
    var dl_garmin_gpx_button = $("#dl_garmin_gpx");
    var reset_button = $("#reset");

    var attribute_area = $("#attribute_area");
    var attribute_list = $("#attribute_list");

    var map = L.map("map_canvas").setView([35.681167, 139.767052], 10);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© <a href=\"http://osm.org/copyright\">OpenStreetMap</a> contributors, <a href=\"http://creativecommons.org/licenses/by-sa/2.0\">CC-BY-SA</a>",
        maxZoom: 19
    }).addTo(map);
    var flightPathes = [];

    var hidden_dl_link = $("#hidden_dl_link");

    var resetState = function () {
        dl_gpx_button.off().prop("disabled", true);
        dl_garmin_gpx_button.prop("disabled", true);
        reset_button.prop("disabled", true);

        attribute_area.hide();
        attribute_list.empty();

        map.setView([35.681167, 139.767052], 10);
        while (flightPathes.length > 0) {
            flightPathes.pop().remove();
        }
    };

    var createDLButtonClickEventFunction = function (valid_gpx, filename) {
        return function () {
            var blob_url = URL.createObjectURL(new Blob([valid_gpx], {type: "application/gpx+xml"}));
            hidden_dl_link
                .attr("href", blob_url)
                .attr("download", filename)
                [0].click();
            URL.revokeObjectURL(blob_url);
        };
    };

    var onLoadFile = function (xml, file_basename) {
        var valid_gpx_object, mapData;
        [valid_gpx_object, mapData] = parseXml(xml);

        var log_attributes = Object.getOwnPropertyNames(mapData.attributes);
        if (log_attributes.length > 0) {
            var ul = $("<ul />");
            log_attributes.forEach(function (key) {
                var item = $("<li />").text($("<span />").text(key + " = " + mapData.attributes[key]).html());
                ul.append(item);
            });
            attribute_list.append(ul);
            attribute_area.show();
        }

        if (mapData.segments.length > 0) {
            var bounds = getBounds(mapData);
            var leaflet_bounds = L.latLngBounds(L.latLng(bounds.n, bounds.e), L.latLng(bounds.s, bounds.w));
            // map.setView(leaflet_bounds.getCenter(), 8);
            map.fitBounds(leaflet_bounds);

            for (var i = 0; i < mapData.segments.length; i++) {
                var flightPath = L.polyline(
                    mapData.segments[i].map(function (value) {
                        return [value.loc[0], value.loc[1]];
                    }),
                    {
                        color: polyline_colors[i % polyline_colors.length],
                        opacity: 1.0,
                        weight: 2
                    }
                );
                flightPath.addTo(map);
                flightPathes.push(flightPath);
            }

            // set dl
            var valid_gpx = outputGPX(valid_gpx_object);
            var garmin_gpx = outputGarminGPX(valid_gpx_object);
            dl_gpx_button.prop("disabled", false).click(createDLButtonClickEventFunction(valid_gpx, file_basename + "_validated.gpx"));
            dl_garmin_gpx_button.prop("disabled", false).click(createDLButtonClickEventFunction(garmin_gpx, file_basename + "_garmin.gpx"));
            reset_button.prop("disabled", false);
        }
    };

    $("#file_input").change(function () {
        resetState();
        loadFile($(this)[0], onLoadFile);
    });

    reset_button.click(resetState);
});