"use strict";

// Start DOM Parser
var DOMParser;
if (typeof(DOMParser) === 'undefined') {
    DOMParser = function () {
    };
    DOMParser.prototype.parseFromString = function (str, contentType) {
        var xmldata;
        if (typeof(ActiveXObject) !== 'undefined') {
            xmldata = new ActiveXObject('MSXML.DomDocument');
            xmldata.async = false;
            xmldata.loadXML(str);
            return xmldata;
        } else if (typeof(XMLHttpRequest) !== 'undefined') {
            xmldata = new XMLHttpRequest;
            if (!contentType) {
                contentType = 'application/xml';
            }
            xmldata.open('GET', 'data:' + contentType + ';charset=utf-8,' + encodeURIComponent(str), false);
            if (xmldata.overrideMimeType) {
                xmldata.overrideMimeType(contentType);
            }
            xmldata.send(null);
            return xmldata.responseXML;
        }
    }
}

function loadFile(input, onload_func) {
    var file, fr;

    if (typeof window.FileReader !== 'function') {
        alert("The file API isn't supported on this browser yet.");
        return;
    }

    if (!input) {
        alert("Um, couldn't find the fileinput element.");
    }
    else if (!input.files) {
        alert("This browser doesn't seem to support the `files` property of file inputs.");
    }
    else if (!input.files[0]) {
        alert("Please select a file before clicking 'Load'");
    }
    else {
        file = input.files[0];
        fr = new FileReader();
        fr.onload = receivedText;
        fr.readAsText(file);
    }

    function receivedText() {
        var file_basename = basename(file.name);
        onload_func(fr.result, file_basename);
    }
}

var basename = function (str) {
    var base = String(str).substring(str.lastIndexOf('/') + 1);
    if (base.lastIndexOf(".") !== -1)
        base = base.substring(0, base.lastIndexOf("."));
    return base;
};

function parseXml(xmlstr) {
    var spaces = /(^|>)(?:\r?\n|\s)*|(?:\r?\n|\s)*(<|$)/mg;
    xmlstr = xmlstr.replace(spaces, "$1$2");

    var doc = new DOMParser().parseFromString(xmlstr, "text/xml");
    if (doc.documentElement.nodeName !== "gpx")
        throw "unexpectedly XML(GPX) nodeName \"" + node.nodeName + "\" appeared.";

    return parseGPX(doc.documentElement, true);
}

function parseGPX(node, isRoot, mapData) {
    if (!mapData) {
        mapData = {attributes: {}, segments: []}
    }

    if ("attributes" in node === false) {
        return [node.value, mapData];
    }

    var i;
    var result = {attributes: {}, elements: {}};

    // parse node attributes
    for (i = 0; i < node.attributes.length; i++) {
        switch (node.nodeName) {
            case "gpx":
                if (/(xmlns|xsi|creator)/.test(node.attributes[i].nodeName)) {
                    result.attributes[node.attributes[i].nodeName] = node.attributes[i].nodeValue;
                }
                else {
                    if ("extensions" in result.elements === false)
                        result.elements.extensions = {};
                    result.elements.extensions[node.attributes[i].nodeName] = node.attributes[i].nodeValue;
                }
                break;
            case "trkpt":
                if (node.attributes[i].nodeName === "lat" || node.attributes[i].nodeName === "lon")
                    result.attributes[node.attributes[i].nodeName] = node.attributes[i].nodeValue;
                break;
            default:
                if ("extensions" in result.elements === false)
                    result.elements.extensions = {};
                result.elements.extensions[node.attributes[i].nodeName] = node.attributes[i].nodeValue;
                break;
        }
    }

    // parse child nodes
    for (i = 0; i < node.childNodes.length; i++) {
        if ("nodeName" in node.childNodes[i] === false || /^(\n\r|\r|\n)$/.test(node.childNodes[i].nodeValue))
            continue;

        var parseAsExtension = true;
        if (isRoot) {
            if (node.childNodes[i].nodeName === "trk") {
                if ("trk" in result.elements)
                    throw "multiple \"trk\" XML elements appeared!";
                result.elements.trk = parseGPX(node.childNodes[i], false, mapData)[0];
            }
            else {
                console.info("\"" + node.childNodes[i].nodeName + "\" XML(GPX) element is unknown, ignored.");
            }
            parseAsExtension = false;
        }
        else if (node.parentNode.nodeName === "gpx" && node.nodeName === "trk") {
            switch (node.childNodes[i].nodeName) {
                case "name":
                    if (mapData.attributes.hasOwnProperty("name"))
                        throw "multiple \"name\" XML(GPX) elements appeared!";

                    result.elements.name = node.childNodes[i].textContent;
                    mapData.attributes.name = node.childNodes[i].textContent;
                    parseAsExtension = false;
                    break;

                case "trkseg":
                    if ("trkseg" in result.elements === false)
                        result.elements.trkseg = [];
                    result.elements.trkseg.push(parseGPX(node.childNodes[i], false, mapData)[0]);
                    parseAsExtension = false;
                    break;
            }
        }
        else if (node.parentNode.nodeName === "trk" && node.nodeName === "trkseg") {
            var points = [];
            for (i = 0; i < node.childNodes.length; i++) {
                var snode = node.childNodes[i];
                if (snode.nodeName === "trkpt") {
                    var trkpt = {
                        attributes: {
                            lat: snode.attributes.lat.nodeValue,
                            lon: snode.attributes.lon.nodeValue
                        },
                        elements: {
                            ele: undefined,
                            time: undefined
                        }
                    };
                    var trkptMapData = {
                        loc: [
                            parseFloat(snode.attributes.lat.nodeValue),
                            parseFloat(snode.attributes.lon.nodeValue)
                        ],
                        ele: undefined,
                        time: undefined
                    };
                    for (var j = 0; j < snode.childNodes.length; j++) {
                        var ssnode = snode.childNodes[j];
                        switch (ssnode.nodeName) {
                            case "ele":
                                trkpt.elements.ele = ssnode.childNodes[0].nodeValue;
                                trkptMapData.ele = parseFloat(ssnode.childNodes[0].nodeValue);
                                break;
                            case "time":
                                trkpt.elements.time = ssnode.childNodes[0].nodeValue;
                                trkptMapData.time = parseDateString(ssnode.childNodes[0].nodeValue);
                                break;
                            default:
                                if ("extensions" in trkpt.elements === false)
                                    trkpt.elements.extensions = {};
                                trkpt.elements.extensions[ssnode.nodeName] = ssnode.childNodes[0].nodeValue;
                                break;
                        }
                    }
                    if ("trkpt" in result.elements === false)
                        result.elements.trkpt = [];
                    result.elements.trkpt.push(trkpt);
                    points.push(trkptMapData);
                }
                else {
                    if ("extensions" in result.elements === false)
                        result.elements.extensions = {};
                    result.elements.extensions[snode.nodeName] = snode.nodeValue;
                }
            }
            mapData.segments.push(points);
            parseAsExtension = false;
        }
        if (parseAsExtension) {
            if ("extensions" in result.elements === false)
                result.elements.extensions = {};
            result.elements.extensions[node.childNodes[i].nodeName] = parseGPX(node.childNodes[i], false, mapData)[0];
        }
    }

    return [result, mapData];
}

function outputGPX(props, tag, level) {
    if (!level) {
        level = 0;
        tag = "gpx";
    }

    var gpx_str = level === 0 ? "<?xml version='1.0' encoding='utf-8'?>\n" : "";
    var spaces = Array(level * 2 + 1).join(" ");

    var start_tag = "<" + tag;
    if (props instanceof Object && !(props instanceof Array) && props.hasOwnProperty("attributes")) {
        Object.getOwnPropertyNames(props.attributes).forEach(function (key) {
            start_tag += " " + key + "='" + props.attributes[key] + "'";
        });
    }
    start_tag += ">";

    var end_tag = "</" + tag + ">";

    if (props instanceof Array) {
        props.forEach(function (value) {
            gpx_str += outputGPX(value, tag, level);
        });
    } else if (props instanceof Object) {
        gpx_str += spaces + start_tag + "\n";
        if (props.hasOwnProperty("elements")) {
            Object.getOwnPropertyNames(props.elements).forEach(function (key) {
                gpx_str += outputGPX(props.elements[key], key, level + 1);
            });
        } else {
            Object.getOwnPropertyNames(props).forEach(function (key) {
                gpx_str += outputGPX(props[key], key, level + 1);
            });
        }
        gpx_str += spaces + end_tag + "\n";
    } else {
        gpx_str += spaces + start_tag + props + end_tag + "\n";
    }

    return gpx_str;
}

var parseDateString = function (s) {
    var bits = s.split(/[-T:+Z]/g);
    var d = new Date(bits[0], bits[1] - 1, bits[2]);
    d.setHours(bits[3], bits[4], bits[5]);

    var offsetMinutes = 0;
    if (bits.length === 8) {
        // Get supplied time zone offset in minutes
        offsetMinutes = bits[6] * 60 + Number(bits[7]);
        var sign = /\d\d-\d\d:\d\d$/.test(s) ? '-' : '+';

        // Apply the sign
        offsetMinutes = sign === '-' ? -1 * offsetMinutes : offsetMinutes;
    }

    // Apply offset and local timezone
    d.setMinutes(d.getMinutes() - offsetMinutes - d.getTimezoneOffset());

    // d is now a local time equivalent to the supplied time
    return d;
};