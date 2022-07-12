
const fs = require('fs')
    , _ = require('lodash')
    , { DOMParser } = require('xmldom')
    , xpath = require('xpath');

const mapNS = {
  'siri' : 'http://www.siri.org.uk/siri',
  'ojp': 'http://www.vdv.de/ojp',
};

const queryNode = (doc, path) => {
  const nodes = queryNodes(doc, path)
  if (nodes.length === 0) {
      return null;
  }
  return nodes[0]
}

const queryText = (doc, q) => {
  console.log(q)
  const queryNS = xpath.useNamespaces(mapNS);
  const node = queryNS(q, doc, true);
/*
  const query = xpath.parse(q);

  const node = query.select({
      node: doc,
      //allowAnyNamespaceForNoPrefix: true
  });*/

  console.log({node})

  if (!node) {
      return null;
  }
  return node.textContent;
}

const queryTags = (doc, paths) => {
  if (!Array.isArray(paths)) {
    paths = [paths];
  }

  const tags = paths.map(str => {
    return `[local-name()='${str}']`;
  }).join('/*');

  const query = `//*${tags}`;

  return queryText(doc, query);
}

const xml = fs.readFileSync('./test.xml', 'utf8');

const doc = new DOMParser({
      errorHandler:{
        warning: e => { console.warn('WARNING XML PARSING', e) },
        error: errorMsg => {
          console.warn('ERROR XML PARSING',errorMsg);
          return false
        }
      }
    }).parseFromString(xml);

//console.log(doc);

/*let originId = queryTags(doc, [`ojp:OJPTripRequest`, 'ojp:Origin', 'ojp:PlaceRef', 'StopPlaceRef']);
let destinationId = queryTags(doc, [`ojp:OJPTripRequest`, 'ojp:Destination', 'ojp:PlaceRef', 'StopPointRef']);
*/

let originId = queryTags(doc, [`OJPTripRequest`, 'Origin', 'PlaceRef', 'StopPlaceRef']);
let destinationId = queryTags(doc, [`OJPTripRequest`, 'Destination', 'PlaceRef', 'StopPointRef']);

console.log({
  originId,
  destinationId
});

