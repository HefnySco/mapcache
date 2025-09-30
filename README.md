# Map Cache Tools

A robust Node.js tool to download map tiles (satellite or terrain RGB) for a specified geographic area and zoom range, storing them as PNG images in a folder. Ideal for offline map applications, such as integration with [Leaflet](https://leafletjs.com/) or 3D rendering projects like WebGL-based terrain visualization. Features include parallel downloads, retry handling, progress tracking, and support for multiple map providers.


Watch a demo video showcasing the tool:  
[![Watch the video](https://github.com/HefnySco/mapcache/blob/master/images/youtube.png?raw=true)](https://youtu.be/aSb6xNOQqok)


## Features

- **Supported Providers**: OpenStreetMap (OSM), Mapbox Satellite, and Mapbox Terrain RGB (for elevation data).
- **Unified PNG Format**: All tiles are saved as PNG, with Mapbox Satellite tiles converted from JPG for consistency.
- **Parallel Downloads**: Configurable concurrency to optimize speed while respecting provider rate limits.
- **Retry Mechanism**: Automatically retries failed downloads (default: 3 attempts) with exponential backoff.
- **Progress Tracking**: Displays real-time progress with percentage completion.
- **File Management**: Skips existing files unless `--force` is used, with automatic output folder creation.
- **Flexible Zoom**: Download tiles for a range of zoom levels (min `--zout` to max `--zin`).
- **Integration**: Outputs tiles compatible with 3D mapping projects (e.g., Three.js terrain rendering) and Leaflet-based map servers.

## Installation


### Option 1: Install Globally via npm
Install the package globally to use the `mapcache-download` command from anywhere:

```bash
npm install -g mapcachetools
```

Then run the tool with:

```bash
mapcache-download --lat1=<lat> --lng1=<lng> --lat2=<lat> --lng2=<lng> --zin=<max_zoom> --folder=<output_folder> [options]
```

### Option 2: Clone and Install Locally
1. Clone the repository:
   ```bash
   git clone https://github.com/HefnySco/mapcache.git
   cd mapcache
   ```

2. Install dependencies:
   ```bash
   npm install
   ```
   Note: The `sharp` library is required for JPG-to-PNG conversion. Ensure system dependencies are installed:
   - Ubuntu/Debian: `sudo apt-get install libvips-dev`
   - macOS: `brew install libvips`

## Usage

Download map tiles for a geographic area defined by two coordinates (`lat1,lng1` to `lat2,lng2`), a zoom range, and an output folder. Run the script with:

```bash
node mapcache_download.js --lat1=<lat> --lng1=<lng> --lat2=<lat> --lng2=<lng> --zin=<max_zoom> --folder=<output_folder> [options]
```

### Example: Download OSM Tiles
Download OpenStreetMap tiles for a small area with zoom levels 0 to 14:
```bash
node mapcache_download.js --lat1=40.7128 --lng1=-74.0060 --lat2=40.7228 --lng2=-73.9960 --zin=14 --zout=0 --folder=./site/cachedMaps
```

### Example: Download Mapbox Satellite Tiles
Download Mapbox satellite tiles (saved as PNG, requires a Mapbox access token):
```bash
node mapcache_download.js --lat1=40.7128 --lng1=-74.0060 --lat2=40.7228 --lng2=-73.9960 --zin=14 --folder=./site/cachedMaps --provider=1 --token=pk.eyJ1IjoibWhlZm55IiwiYSI6ImNrZW84Nm9rYTA2ZWgycm9mdmNscmFxYzcifQ.c-zxDjXCthXmRsErPzKhbQ
```

### Example: Download Mapbox Terrain RGB Tiles
Download Mapbox terrain RGB tiles for elevation data:
```bash
node mapcache_download.js --lat1=40.7128 --lng1=-74.0060 --lat2=40.7228 --lng2=-73.9960 --zin=14 --folder=./site/cachedMaps --provider=2 --token=pk.eyJ1IjoibWhlZm55IiwiYSI6ImNrZW84Nm9rYTA2ZWgycm9mdmNscmFxYzcifQ.c-zxDjXCthXmRsErPzKhbQ
```

### Options
- `--lat1, --lng1`: Starting coordinates (required).
- `--lat2, --lng2`: Ending coordinates (required).
- `--zin`: Maximum zoom level (required, e.g., 18).
- `--zout`: Minimum zoom level (default: 0).
- `--folder`: Output folder for tiles (required, e.g., `./site/cachedMaps`).
- `--provider`: Map provider (0=OSM, 1=Mapbox Satellite, 2=Mapbox Terrain RGB; default: 0).
- `--token`: Mapbox access token (required for provider 1 or 2).
- `--concurrency`: Number of parallel downloads (default: 5).
- `--retries`: Retry attempts for failed downloads (default: 3).
- `--force`: Redownload existing files (default: false).
- `--help, -h`: Display help message.
- `--version, -v`: Display script version.

## Serving Tiles Locally

Use a local HTTP server to serve downloaded tiles for testing with Leaflet or other map libraries:

```bash
cd site
npm install -g http-server
http-server
```

Access the tiles at `http://localhost:8080/cachedMaps`. The folder `./site/cachedMaps` contains tiles named as:
- OSM: `osm_<x>_<y>_<zoom>.png`
- Mapbox Satellite: `sat_<x>_<y>_<zoom>.png`
- Mapbox Terrain RGB: `terrain_<x>_<y>_<zoom>.png`

## Integration with 3D Mapping Projects

The downloaded tiles are saved as PNG, compatible with 3D mapping applications like Three.js for terrain rendering. For example, Mapbox terrain RGB tiles can be used to generate heightmaps:

```javascript
const terrainData = await textureLoader.loadAsync('terrain_<x>_<y>_<zoom>.png');
const data = getPixelData(terrainData); // Extract RGB values
const height = -10000 + ((r * 65536 + g * 256 + b) * 0.1); // Mapbox terrain RGB formula
```

Ensure the output folder matches your project's tile cache directory, and use the same zoom levels (e.g., 14) for consistency with your rendering logic.

## Map Providers

- **OpenStreetMap (OSM)**: Free, no token required. Tiles are natively PNG. [Website](https://www.openstreetmap.org/).
- **Mapbox Satellite**: High-quality satellite imagery, converted from JPG to PNG for consistency. Requires a Mapbox access token. [Website](https://api.mapbox.com/).
- **Mapbox Terrain RGB**: Elevation data encoded in RGB PNG tiles. Requires a Mapbox access token. [Website](https://docs.mapbox.com/data/tilesets/reference/mapbox-terrain-rgb-v1/).

Obtain a Mapbox token from [Mapbox Account](https://account.mapbox.com/).

## Notes

- **Rate Limits**: Mapbox enforces rate limits (e.g., 750 requests/min for satellite, 200 for terrain RGB on free tiers). Adjust `--concurrency` to avoid being throttled.
- **File Overwrites**: Use `--force=true` to redownload tiles if they are outdated or corrupted.
- **File Size**: Mapbox Satellite tiles are converted to PNG, which may increase file size compared to JPG. Consider disk space for large areas.
- **Tile Validation**: For critical applications, validate PNG tiles post-download to ensure integrity (e.g., using `sharp` metadata).


## Disclaimer

Please review the terms and conditions of your chosen map provider (e.g., [OpenStreetMap](https://www.openstreetmap.org/copyright), [Mapbox](https://www.mapbox.com/tos)). The author assumes no liability for any incidental, consequential, or other damages arising from the use of this tool.

