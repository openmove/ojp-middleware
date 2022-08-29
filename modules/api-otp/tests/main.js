
const fs = require('fs');

const GeoJSON = require('geojson');

const json = JSON.parse(fs.readFileSync('./stops_bbox.json'));
const geo = GeoJSON.parse(json.data.stopsByBbox, {
    Point: ['lat', 'lon']
});

console.log(JSON.stringify(geo, null, 4))