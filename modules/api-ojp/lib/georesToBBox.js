/*
node georesToBBox.js ../../tests/xmls/OJPLocationInformationRequest_GeoRestriction_rect.xml
 */
const fs = require('fs')
    , { DOMParser } = require('xmldom');

const { parseGeoRestriction } = require('./restrictions');

const serviceTag = 'OJPLocationInformationRequest';

const xml = fs.readFileSync(process.argv[2],'utf-8');

const doc = new DOMParser({
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

const { rect
    , lowerLat, lowerLon, upperLat, upperLon
    , circle, radius, centerLon, centerLat } = geores;

console.log(geores);

console.log('bboxfinder $lowerLat, $lowerLon, $upperLat, $upperLon')
//console.log(`http://bboxfinder.com/?#${lowerLat},${lowerLon},${upperLat},${upperLon}`);
console.log(`http://localhost:90/maps/bbox/?#${lowerLat},${lowerLon},${upperLat},${upperLon}`);