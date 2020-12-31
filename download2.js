/*
    Download images sequentially
*/
'use strict';

const fs = require('fs');
const axios = require('axios');

const  EARTH_RADIUS = 6378137;
const  MAX_LATITUDE = 85.0511287798;
const  R_MINOR = 6356752.314245179;


/*
 * @namespace Projection
 * @projection L.Projection.SphericalMercator
 *
 * Spherical Mercator projection — the most common projection for online maps,
 * used by almost all free and commercial tile providers. Assumes that Earth is
 * a sphere. Used by the `EPSG:3857` CRS.
 */


function project (lat, lng)
{
    var d = Math.PI / 180,
		    max = MAX_LATITUDE,
		    lat = Math.max(Math.min(max, lat), -max),
		    sin = Math.sin(lat * d);

	return {x: EARTH_RADIUS * lng * d,
            y: EARTH_RADIUS * Math.log((1 + sin) / (1 - sin)) / 2
        };
}

function unproject (point) {
  var d = 180 / Math.PI;

  return {lat:
    (2 * Math.atan(Math.exp(point.y / EARTH_RADIUS)) - (Math.PI / 2)) * d,
    lng: point.x * d / EARTH_RADIUS};
}


function zoomScale (zoom)
{
  return 256 * Math.pow(2, zoom);
}


function transform (point, scale) {
  scale = scale || 1;
  point.x = scale * (2.495320233665337e-8    * point.x + 0.5);
  point.y = scale * (-2.495320233665337e-8 * point.y + 0.5);
  return point;
}


  

/* ============================================================
  Function: Download Image
============================================================ */

const download_image = (url, image_path) =>
  axios({
    url,
    responseType: 'stream',
  }).then(
    response =>
      new Promise((resolve, reject) => {
        response.data
          .pipe(fs.createWriteStream(image_path))
          .on('finish', () => resolve())
          .on('error', e => reject(e));
      }),
  );



/* ============================================================
  Download Images in Order
============================================================ */
// x = 153922;
// y = 108069;

//Sheraton
// lat = 30.103344926270754;
// lng = 31.372997471021513;

var myArgs = process.argv.slice(2);

//Carefour
var lng1 = myArgs.length >2 ? parseFloat(myArgs[1]):31.31918389389226;
var lat1 = myArgs.length >2 ? parseFloat(myArgs[0]):29.958150796349425;
var lng2 = myArgs.length >4 ? parseFloat(myArgs[3]):31.31918389389226;
var lat2 = myArgs.length >4 ? parseFloat(myArgs[2]):29.958150796349425;
var zoom = myArgs.length >4 ? parseFloat(myArgs[4]):18;
var folder = myArgs.length >6 ?myArgs[5]:"./out";

if (lng1 > lng2)
{
  var t = lng2;
  lng2 = lng1;
  lng1 = t;
}

if (lat1 > lat2)
{
  var t = lat2;
  lat2 = lat1;
  lat1 = t;
}

var point1 = project (lat1, lng1);
var point2 = project (lat2, lng2);
var c = unproject (point1);
var scaledZoom = zoomScale (zoom);
point1 = transform (point1, scaledZoom);
point2 = transform (point2, scaledZoom);



console.log (point1);

point1.x = Math.floor(point1.x / 256);
point1.y = Math.floor(point1.y / 256);

point2.x = Math.floor(point2.x / 256);
point2.y = Math.floor(point2.y / 256);

if (point1.y > point2.y)
{
  var t = point2.y;
  point2.y = point1.y;
  point1.y = t;
}
(async () => {

  var url, filename;
  
  for (var j,i=point1.x ;i<point2.x + 3;++i)
  for (j=point1.y ;j<=point2.y + 3;++j)
  {
    url ="https://api.mapbox.com/styles/v1/mapbox/satellite-v9/tiles/" + zoom + "/" + i + "/" + j + "?access_token=pk.eyJ1IjoibWhlZm55IiwiYSI6ImNrZW84Nm9rYTA2ZWgycm9mdmNscmFxYzcifQ.c-zxDjXCthXmRsErPzKhbQ"
    console.log (url);
    filename = folder + "/" + i + "_" + j + "_" + zoom + ".jpeg";
  
    let example_image_1 = await download_image(url, filename);
  }

})();