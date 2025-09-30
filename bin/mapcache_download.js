/*
    Enhanced Map Tile Downloader with Terrain Support and Single Extension
    - Downloads map tiles (satellite or terrain RGB) for a given geographic bounding box and zoom range.
    - Saves all tiles as PNG for consistency, converting Mapbox Satellite tiles from JPG to PNG.
    - Supports OpenStreetMap (default) and Mapbox (with token) for satellite and terrain RGB tiles.
    - Parallel downloads with configurable concurrency to respect rate limits.
    - Retry mechanism for failed downloads.
    - Creates output folder if it doesn't exist.
    - Progress reporting with total count and completion percentage.
    - Better input validation and default values.
    - Force redownload option.
    - Improved error handling and logging.

    Usage: node downloader.js --lat1=<lat> --lng1=<lng> --lat2=<lat> --lng2=<lng> --zin=<max_zoom> [options]

    Run with --help for full options.
*/
"use strict";

const fs = require("fs");
const path = require("path");
const axios = require("axios");
const sharp = require("sharp"); // Added for JPG-to-PNG conversion
const v_pjson = require("../package.json"); // Assuming this exists; otherwise, hardcode version.
const c_args = require("../helpers/hlp_args.js"); // Assuming this provides getArgs().
const c_colors = require("../helpers/js_colors.js").Colors; // Assuming this provides color codes.

const EARTH_RADIUS = 6378137;
const MAX_LATITUDE = 85.0511287798;
const R_MINOR = 6356752.314245179; // Not used, but kept for completeness.

// Default values
const DEFAULT_PROVIDER = 0; // 0: OSM, 1: Mapbox Satellite, 2: Mapbox Terrain RGB
const DEFAULT_CONCURRENCY = 5; // Safe default to avoid rate limits
const DEFAULT_RETRIES = 3;
const DEFAULT_ZOUT = 0;
const DEFAULT_FORCE = false;

// Global variables
let map_provider = DEFAULT_PROVIDER;
let TOKEN = ""; // Required for Mapbox
let myArgs = c_args.getArgs();
let totalTiles = 0;
let downloadedTiles = 0;

/*
 * Projection functions (unchanged)
 */
function project(p_lat, p_lng) {
  const d = Math.PI / 180,
    max = MAX_LATITUDE,
    lat = Math.max(Math.min(max, p_lat), -max),
    sin = Math.sin(lat * d);

  return {
    x: EARTH_RADIUS * p_lng * d,
    y: (EARTH_RADIUS * Math.log((1 + sin) / (1 - sin))) / 2,
  };
}

function unproject(point) {
  const d = 180 / Math.PI;

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
  // Normalize bounds
  if (lng1 > lng2) [lng1, lng2] = [lng2, lng1];
  if (lat1 > lat2) [lat1, lat2] = [lat2, lat1];

  let point1 = project(lat1, lng1);
  let point2 = project(lat2, lng2);

  let scaledZoom = zoomScale(zoom);
  point1 = transform(point1, scaledZoom);
  point2 = transform(point2, scaledZoom);

  // Floor to tile indices
  point1.x = Math.floor(point1.x / 256);
  point1.y = Math.floor(point1.y / 256);
  point2.x = Math.floor(point2.x / 256);
  point2.y = Math.floor(point2.y / 256);

  // Ensure point1 is top-left, point2 bottom-right
  if (point1.y > point2.y) [point1.y, point2.y] = [point2.y, point1.y];

  return [point1, point2];
}

/* ============================================================
  Enhanced Download Function with Retry
============================================================ */

const download_image = async (url, image_path, isMapboxSatellite = false, retries = myArgs.retries || DEFAULT_RETRIES) => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await axios({
        url,
        responseType: "arraybuffer", // Changed to arraybuffer for sharp compatibility
        timeout: 10000, // 10s timeout
      });

      // Convert to PNG if Mapbox Satellite (JPG), otherwise save directly
      const buffer = isMapboxSatellite
        ? await sharp(response.data).png().toBuffer()
        : response.data;

      await fs.promises.writeFile(image_path, buffer);
      return; // Success
    } catch (error) {
      console.log(c_colors.BError + `Attempt ${attempt} failed for ${url}: ${error.message}` + c_colors.Reset);
      if (attempt === retries) {
        throw error; // Final failure
      }
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Exponential backoff
    }
  }
};

/* ============================================================
  Generate Tile URL and Filename
============================================================ */

function getTileUrlAndFilename(i, j, zoom) {
  let url, typePrefix, isMapboxSatellite = false;
  if (map_provider === 1) {
    // Mapbox Satellite
    url = `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/tiles/${zoom}/${i}/${j}?access_token=${TOKEN}`;
    typePrefix = "sat";
    isMapboxSatellite = true;
  } else if (map_provider === 2) {
    // Mapbox Terrain RGB
    url = `https://api.mapbox.com/v4/mapbox.terrain-rgb/${zoom}/${i}/${j}.png?access_token=${TOKEN}`;
    typePrefix = "terrain";
  } else {
    // OpenStreetMap
    url = `https://tile.openstreetmap.org/${zoom}/${i}/${j}.png`;
    typePrefix = "osm";
  }
  const filename = `${typePrefix}_${i}_${j}_${zoom}.png`; // Always PNG
  return { url, filename, isMapboxSatellite };
}

/* ============================================================
  Download Tiles for a Zoom Level (Parallel with Concurrency)
============================================================ */

async function fn_download_tiles_for_zoom(point1, point2, zoom, folder, force) {
  const tiles = [];
  for (let i = point1.x; i <= point2.x; i++) {
    for (let j = point1.y; j <= point2.y; j++) {
      tiles.push({ i, j });
    }
  }

  totalTiles += tiles.length;
  console.log(c_colors.BSuccess + `Queueing ${tiles.length} tiles for zoom ${zoom}...` + c_colors.Reset);

  // Process in batches to limit concurrency
  const concurrency = myArgs.concurrency || DEFAULT_CONCURRENCY;
  for (let batchStart = 0; batchStart < tiles.length; batchStart += concurrency) {
    const batch = tiles.slice(batchStart, batchStart + concurrency);
    await Promise.all(
      batch.map(async ({ i, j }) => {
        const { url, filename, isMapboxSatellite } = getTileUrlAndFilename(i, j, zoom);
        const image_path = path.join(folder, filename);

        if (!force && fs.existsSync(image_path)) {
          console.log(c_colors.FgCyan + `Skipping existing: ${filename}` + c_colors.Reset);
          downloadedTiles++;
          updateProgress();
          return;
        }

        try {
          await download_image(url, image_path, isMapboxSatellite);
          console.log(c_colors.BSuccess + `Downloaded: ${filename}` + c_colors.Reset);
        } catch (error) {
          console.error(c_colors.BError + `Failed to download ${filename} after retries.` + c_colors.Reset);
        } finally {
          downloadedTiles++;
          updateProgress();
        }
      })
    );
  }
}

/* ============================================================
  Progress Updater
============================================================ */

function updateProgress() {
  const progress = ((downloadedTiles / totalTiles) * 100).toFixed(2);
  console.log(c_colors.FgYellow + `Progress: ${downloadedTiles}/${totalTiles} (${progress}%)` + c_colors.Reset);
}

/* ============================================================
  Input Validation and Argument Handling
============================================================ */

function fn_handle_arguments() {
  myArgs = c_args.getArgs();
  let error = false;

  if (myArgs.help || myArgs.h || myArgs.version || myArgs.v) {
    console.log(
      c_colors.BSuccess +
        "MAP Tile Downloader v" +
        c_colors.FgYellow +
        (v_pjson.version || "1.0.0") +
        c_colors.Reset
    );
    console.log(c_colors.BSuccess + "Usage: node downloader.js --lat1=<lat> --lng1=<lng> --lat2=<lat> --lng2=<lng> --zin=<max_zoom> [options]" + c_colors.Reset);
    console.log(c_colors.BSuccess + "--lat1, --lng1: Start coordinates (required)" + c_colors.Reset);
    console.log(c_colors.BSuccess + "--lat2, --lng2: End coordinates (required)" + c_colors.Reset);
    console.log(c_colors.BSuccess + "--zout: Min zoom (default: 0)" + c_colors.Reset);
    console.log(c_colors.BSuccess + "--zin: Max zoom (required, e.g., 18)" + c_colors.Reset);
    console.log(c_colors.BSuccess + "--folder: Output folder (required, e.g., ./out)" + c_colors.Reset);
    console.log(c_colors.BSuccess + "--provider: 0=OSM (default), 1=Mapbox Satellite, 2=Mapbox Terrain RGB" + c_colors.Reset);
    console.log(c_colors.BSuccess + "--token: Mapbox access token (required if provider=1 or 2)" + c_colors.Reset);
    console.log(c_colors.BSuccess + "--concurrency: Parallel downloads (default: 5)" + c_colors.Reset);
    console.log(c_colors.BSuccess + "--retries: Retry attempts per tile (default: 3)" + c_colors.Reset);
    console.log(c_colors.BSuccess + "--force: Redownload existing files (default: false)" + c_colors.Reset);
    process.exit(0);
  }

  // Required args
  ["lat1", "lng1", "lat2", "lng2", "zin", "folder"].forEach(arg => {
    if (!myArgs[arg]) {
      error = true;
      console.log(c_colors.BError + `Missing required argument: --${arg}` + c_colors.Reset);
    }
  });

  // Validate lat/lng
  ["lat1", "lat2"].forEach(arg => {
    if (myArgs[arg] && (myArgs[arg] < -90 || myArgs[arg] > 90)) {
      error = true;
      console.log(c_colors.BError + `Invalid latitude ${arg}: ${myArgs[arg]} (must be -90 to 90)` + c_colors.Reset);
    }
  });
  ["lng1", "lng2"].forEach(arg => {
    if (myArgs[arg] && (myArgs[arg] < -180 || myArgs[arg] > 180)) {
      error = true;
      console.log(c_colors.BError + `Invalid longitude ${arg}: ${myArgs[arg]} (must be -180 to 180)` + c_colors.Reset);
    }
  });

  // Provider and token
  map_provider = myArgs.provider ? parseInt(myArgs.provider) : DEFAULT_PROVIDER;
  if (map_provider === 1 || map_provider === 2) {
    TOKEN = myArgs.token;
    if (!TOKEN) {
      error = true;
      console.log(c_colors.BError + "Missing --token for Mapbox provider (satellite or terrain)." + c_colors.Reset);
    }
  }

  // Zooms
  myArgs.zout = myArgs.zout ? parseInt(myArgs.zout) : DEFAULT_ZOUT;
  myArgs.zin = parseInt(myArgs.zin);
  if (myArgs.zout > myArgs.zin || myArgs.zout < 0 || myArgs.zin > 22) {
    error = true;
    console.log(c_colors.BError + "Invalid zoom range: zout <= zin, 0-22." + c_colors.Reset);
  }

  // Force
  myArgs.force = myArgs.force === "true" || myArgs.force === true ? true : DEFAULT_FORCE;

  if (error) process.exit(1);

  // Create folder if needed
  const folder = myArgs.folder;
  if (!fs.existsSync(folder)) {
    fs.mkdirSync(folder, { recursive: true });
    console.log(c_colors.BSuccess + `Created output folder: ${folder}` + c_colors.Reset);
  }
}

/* ============================================================
  Main Execution
============================================================ */

async function main() {
  fn_handle_arguments();
  const folder = myArgs.folder;
  const force = myArgs.force;

  // Calculate total tiles across all zooms for progress
  for (let zoom = myArgs.zout; zoom <= myArgs.zin; zoom++) {
    const [point1, point2] = fn_convertFromLngLatToPoints(myArgs.lat1, myArgs.lng1, myArgs.lat2, myArgs.lng2, zoom);
    totalTiles += (point2.x - point1.x + 1) * (point2.y - point1.y + 1);
  }

  console.log(c_colors.BSuccess + `Total tiles to process: ${totalTiles}` + c_colors.Reset);

  // Download per zoom
  for (let zoom = myArgs.zout; zoom <= myArgs.zin; zoom++) {
    const [point1, point2] = fn_convertFromLngLatToPoints(myArgs.lat1, myArgs.lng1, myArgs.lat2, myArgs.lng2, zoom);
    await fn_download_tiles_for_zoom(point1, point2, zoom, folder, force);
  }

  console.log(c_colors.BSuccess + "Download complete!" + c_colors.Reset);
}

main().catch(error => {
  console.error(c_colors.BError + `Unexpected error: ${error.message}` + c_colors.Reset);
  process.exit(1);
});