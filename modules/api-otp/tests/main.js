
const fs = require('fs');

const GeoJSON = require('../node_modules/geojson');

const fin = process.argv[2] || './stops_bbox.json';

const json = JSON.parse(fs.readFileSync(fin));
const geo = GeoJSON.parse(json, {
    Point: ['lat', 'lon']
});

console.log(JSON.stringify(geo, null, 4))