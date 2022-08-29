
const fs = require('fs');

const { parseGeoRestriction } = require('./restrictions');


const data = fs.readFileSync(0, 'utf-8');//stdin

const { rect, upperLon, upperLat, lowerLon, lowerLat
	, circle, radius, centerLon, centerLat } = parseGeoRestriction(doc, serviceTag);






