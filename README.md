# MAP Cache Tool

This tool download any area from map provider and store it as images in a folder.
You can use these images with a library like [Leafet](https://leafletjs.com/ "Leafet") to make your own map server easily without the need to download a local OpenStreetMap server.


## Usage

Download area from 58.5500977,-4.5231876   to 58.5501,-4.5231976 with maximum zoom in of 20 and minimum zoom in of 0 i.e. whole world zoom, and store images in folder called image_folder


    downloadmaps --lat1=58.5500977 --lng1=-4.5231876 --lat2=58.5501 --lng2=-4.5231976 --zin=20 --zout=0 --folder=./image_folder

## Map Providers

The application supports [openstreetmap.org](https://www.openstreetmap.org/#map=7/26.805/30.246 "openstreetmap.org") 

```bash
downloadmaps --lat1=58.5500977 --lng1=-4.5231876 --lat2=58.5501 --lng2=-4.5231976 --zin=20  --folder=./out --provider=1
```

and [api.mapbox.com](https://api.mapbox.com "api.mapbox.com"). You need to have a **TOKEN** for using [api.mapbox.com](https://api.mapbox.com "api.mapbox.com").

```bash
 downloadmaps --lat1=58.5500977 --lng1=-4.5231876 --lat2=58.5501 --lng2=-4.5231976 --zin=20  --folder=./out --provider=1 --token=pk.eyJ1IjoibSahlZm59IiwiYSI6ImNrZW84Nm9rYTA2ZWgycv9mdmNscmFxYzcifQ.c-z43FdasErPzKhbQ
```



### Disclaimer
Please make sure to review any terms and conditions of map providers you want to use. Author assumes no liability for any incidental, consequential or other liability from the use of this product.


