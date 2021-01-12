/*
    Download images sequentially
*/
"use strict";
const v_pjson = require("./package.json");
const c_args = require("./helpers/hlp_args.js");
const c_colors = require("./helpers/js_colors.js").Colors;

const fs = require("fs");
const axios = require("axios");

const EARTH_RADIUS = 6378137;
const MAX_LATITUDE = 85.0511287798;
const R_MINOR = 6356752.314245179;
const TOKEN = "pk.eyJ1IjoibWhlZm55IiwiYSI6ImNrZW84Nm9rYTA2ZWgycm9mdmNscmFxYzcifQ.c-zxDjXCthXmRsErPzKhbQ"; //"GET YOUR TOKEN";
var map_provider = 1;
var myArgs = c_args.getArgs();

/*
 * @namespace Projection
 * @projection L.Projection.SphericalMercator
 *
 * Spherical Mercator projection — the most common projection for online maps,
 * used by almost all free and commercial tile providers. Assumes that Earth is
 * a sphere. Used by the `EPSG:3857` CRS.
 */
function project(lat, lng) {
  var d = Math.PI / 180,
    max = MAX_LATITUDE,
    lat = Math.max(Math.min(max, lat), -max),
    sin = Math.sin(lat * d);

  return {
    x: EARTH_RADIUS * lng * d,
    y: (EARTH_RADIUS * Math.log((1 + sin) / (1 - sin))) / 2,
  };
}

function unproject(point) {
  var d = 180 / Math.PI;

  return {
    lat: (2 * Math.atan(Math.exp(point.y / EARTH_RADIUS)) - Math.PI / 2) * d,
    lng: (point.x * d) / EARTH_RADIUS,
  };
}

function zoomScale(zoom) {
  return 256 * Math.pow(2, zoom);
}

function transform(point, scale) {
  scale = scale || 1;
  point.x = scale * (2.495320233665337e-8 * point.x + 0.5);
  point.y = scale * (-2.495320233665337e-8 * point.y + 0.5);
  return point;
}

function fn_convertFromLngLatToPoints(lat1, lng1, lat2, lng2, zoom) {
  // order location
  if (lng1 > lng2) {
    var t = lng2;
    lng2 = lng1;
    lng1 = t;
  }

  if (lat1 > lat2) {
    var t = lat2;
    lat2 = lat1;
    lat1 = t;
  }

  // convert to points
  var point1 = project(lat1, lng1);
  var point2 = project(lat2, lng2);

  var scaledZoom = zoomScale(zoom);
  point1 = transform(point1, scaledZoom);
  point2 = transform(point2, scaledZoom);

  // convert to integer
  point1.x = Math.floor(point1.x / 256);
  point1.y = Math.floor(point1.y / 256);
  point2.x = Math.floor(point2.x / 256);
  point2.y = Math.floor(point2.y / 256);

  // sort
  if (point1.y > point2.y) {
    var t = point2.y;
    point2.y = point1.y;
    point1.y = t;
  }

  var point = [];

  point.push(point1);
  point.push(point2);

  return point;
}

/* ============================================================
  Function: Download Image
============================================================ */

const download_image = (url, image_path) =>
  axios({
    url,
    responseType: "stream",
  }).then(
    (response) =>
      new Promise((resolve, reject) => {
        response.data
          .pipe(fs.createWriteStream(image_path))
          .on("finish", () => resolve())
          .on("error", (e) => reject(e));
      })
  ).catch((error) => {
    console.log(error.message);
  });;

function fn_download_images(point1, point2, zoom) {
  (async () => {
    var url, filename;
    var totalImages =
      (1 + (point2.x + 1) - point1.x) * (1 + (point2.y + 1) - point1.y);
    var START_FROM = 0;

    for (var j, c = 0, i = point1.x; i <= point2.x + 1; ++i)
      for (j = point1.y; j <= point2.y + 1; ++j, ++c) {
        if (c >= START_FROM) {
         /*
            You can edit URL here to download from any provider.
         */ 
          if (map_provider==1)
          {
              // MAPBOX API       
              url =
                  "https://api.mapbox.com/styles/v1/mapbox/satellite-v9/tiles/" +
                  zoom +
                  "/" +
                  i +
                  "/" +
                  j +
                  "?access_token=" +
                  TOKEN;
          }
          else
          {
              // Open Street Map 
              // URL https://tile.openstreetmap.org/{z}/{x}/{y}.png
              url =
                  "https://tile.openstreetmap.org/" +
                  zoom +
                  "/" +
                  i +
                  "/" +
                  j +
                  ".png";
          }
          filename = folder + "/" + zoom + "_" + i + "_" + j +  ".jpeg";
          if (!fs.existsSync(filename)) {
            await download_image(url, filename);
          }
          else
          {
            console.log ("image no. " + c + " already exists.");
          }
          console.log(c + " of " + totalImages + ":" + url);
        }
      }
  })();
}

function fn_handle_arguments() {
  myArgs = c_args.getArgs();
  console.log(JSON.stringify(myArgs));
  var error = false;
  if (
    myArgs.hasOwnProperty("version") === true ||
    myArgs.hasOwnProperty("v") === true
  ) {
    console.log(
      c_colors.BSuccess +
        "MAP Cache version" +
        c_colors.FgYellow +
        JSON.stringify(v_pjson.version) +
        c_colors.Reset
    );
    console.log(
      c_colors.BSuccess +
        "--lat1" +
        c_colors.FgWhite +
        " for Start latitude. " +
        c_colors.FgYellow +
        " Example --lat1=-54.652332555" +
        c_colors.Reset
    );
    console.log(
      c_colors.BSuccess +
        "--lng1" +
        c_colors.FgWhite +
        "  for start longitude. " +
        c_colors.FgYellow +
        " Example --lng1=-54.652332555" +
        c_colors.Reset
    );
    console.log(
      c_colors.BSuccess +
        "--lat2" +
        c_colors.FgWhite +
        "  for end latitude. " +
        c_colors.FgYellow +
        " Example --lat2=-54.652332555" +
        c_colors.Reset
    );
    console.log(
      c_colors.BSuccess +
        "--lng2" +
        c_colors.FgWhite +
        "  for end longitude. " +
        c_colors.FgYellow +
        " Example --lng2=-54.652332555" +
        c_colors.Reset
    );
    console.log(
      c_colors.BSuccess +
        "--zout" +
        c_colors.FgWhite +
        "  for maximum zoom in. You need to check provider normally up to 20" +
        c_colors.FgYellow +
        " Example --zout=2 " +
        c_colors.Reset
    );
    console.log(
      c_colors.BSuccess +
        "--zin" +
        c_colors.FgWhite +
        "  for maximum zoom out. can be as low as 0. " +
        c_colors.FgYellow +
        " Example --zin=10 " +
        c_colors.Reset
    );
    console.log(
      c_colors.BSuccess +
        "--folder" +
        c_colors.FgWhite +
        "  folder to store images in. " +
        c_colors.FgYellow +
        " Example --folder=./out " +
        c_colors.Reset
    );
    console.log(
      c_colors.BSuccess +
        "--provider" +
        c_colors.FgWhite +
        "  if equal to 1 then use https://api.mapbox.com else use tile.openstreetmap.org. " +
        c_colors.FgYellow +
        " Example --folder=./out " +
        c_colors.Reset
    );
    console.log(
      c_colors.BSuccess +
        "--token" +
        c_colors.FgWhite +
        " Required only with https://api.mapbox.com " +
        c_colors.FgYellow +
        " Example --folder=pk.eyJ1IjoibZglZm55IiwiYSI698mNrZW84Nm9rYTA2ZWgycm9mdmNscmFxYzcifQ.c-zxDZXCthXmRsErPzKhbQ " +
        c_colors.Reset
    );
    process.exit();
  }
  if (myArgs.hasOwnProperty("lat1") !== true) {
    error = true;
    console.log(
      c_colors.BError +
        "Missing start latitude. " +
        c_colors.FgYellow +
        " Example --lat1=-54.652332555" +
        c_colors.Reset
    );
  }
  if (myArgs.hasOwnProperty("lng1") !== true) {
    error = true;
    console.log(
      c_colors.BError +
        "Missing start longitude. " +
        c_colors.FgYellow +
        " Example --lng1=-54.652332555" +
        c_colors.Reset
    );
  }
  if (myArgs.hasOwnProperty("lat2") !== true) {
    error = true;
    console.log(
      c_colors.BError +
        "Missing end latitude. " +
        c_colors.FgYellow +
        " Example --lat2=-54.652332555" +
        c_colors.Reset
    );
  }
  if (myArgs.hasOwnProperty("lng2") !== true) {
    error = true;
    console.log(
      c_colors.BError +
        "Missing end longitude. " +
        c_colors.FgYellow +
        " Example --lng2=-54.652332555" +
        c_colors.Reset
    );
  }
  if (myArgs.hasOwnProperty("zout") !== true) {
    myArgs.zout = 0;
    console.log(
      c_colors.FgCyan +
        "Missing zoom out max. Use zero as a default. " +
        c_colors.FgYellow +
        " Example --zout=0 " +
        c_colors.Reset
    );
  }
  if (myArgs.hasOwnProperty("zin") !== true) {
    error = true;
    console.log(
      c_colors.BError +
        "Missing zoom in max between 18 & 2. " +
        c_colors.FgYellow +
        " Example --zin=10 " +
        c_colors.Reset
    );
  }
  if (myArgs.hasOwnProperty("folder") !== true) {
    error = true;
    console.log(
      c_colors.BError +
        "Missing output folder. " +
        c_colors.FgYellow +
        " Example --folder=./out " +
        c_colors.Reset
    );
  }
  if (myArgs.hasOwnProperty("provider") === true) {
    if (myArgs.provider == 1)
    {
      if (myArgs.hasOwnProperty("token") !== true) {
        error = true;
        console.log(
          c_colors.BError +
            "Missing TOKEN file for https://api.mapbox.com. " +
            c_colors.FgYellow +
            " Example --token=pk.eyJ1IjoibZglZm55IiwiYSI698mNrZW84Nm9rYTA2ZWgycm9mdmNscmFxYzcifQ.c-zxDZXCthXmRsErPzKhbQ " +
            c_colors.Reset
        );
      }
    }
  }

  if (map_provider)
  if (error === true) process.exit(0);
}

/* ============================================================
  Download Images in Order
============================================================ */

fn_handle_arguments();
var folder = myArgs.folder;
for (var zoom = myArgs.zout; zoom <= myArgs.zin; ++zoom) {
  var points = fn_convertFromLngLatToPoints(myArgs.lat1, myArgs.lng1, myArgs.lat2, myArgs.lng2, zoom);

  var point1 = points[0];
  var point2 = points[1];

  fn_download_images(point1, point2, zoom);
}
