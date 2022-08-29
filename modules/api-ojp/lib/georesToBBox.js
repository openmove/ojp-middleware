
const fs = require('fs');

const { parseGeoRestriction } = require('./restrictions');

const serviceTag = 'OJPLocationInformationRequest';

const xml = fs.readFileSync(0, 'utf-8');//stdin

doc = new DOMParser({
      errorHandler:{
        warning: err => {
          console.warn('WARNING XML PARSING', err);
        },
        error: err => {
          console.warn('ERROR XML PARSING',err)
        }
      }
    }).parseFromString(xml);

const geores = parseGeoRestriction(doc, serviceTag);

const { rect, upperLon, upperLat, lowerLon, lowerLat
	, circle, radius, centerLon, centerLat } = geores;

console.log(geores);

console.log(`http://bboxfinder.com/#${lowerLat},${lowerLon},${upperLat},${upperLon}`);
