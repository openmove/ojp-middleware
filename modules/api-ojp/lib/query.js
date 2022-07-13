

const xpath = require('xpath');

const mapNS = {
  'siri' : 'http://www.siri.org.uk/siri',
  'ojp': 'http://www.vdv.de/ojp',
};

const queryXpath = (doc, path) => {
  const queryNS = xpath.useNamespaces(mapNS);
  return queryNS(path, doc);
}

const queryNodes = (doc, paths) => {
  if (!Array.isArray(paths)) {
    return queryXpath(doc, paths)
  }

  const tags = paths.map(path => {
    return `[local-name()='${path}']`;
  }).join('/*');

  const queryNS = xpath.useNamespaces(mapNS);
  return queryNS(`//*${tags}`, doc);
}

const queryText = (doc, path) => {
  const queryNS = xpath.useNamespaces(mapNS);
  const node = queryNS(path, doc, true);
  if (!node) {
      return null;
  }
  return node.textContent;
}

const queryTags = (doc, paths) => {
  if (!Array.isArray(paths)) {
    paths = [paths];
  }

  const tags = paths.map(path => {
    return `[local-name()='${path}']`;
  }).join('/*');

  return queryText(doc, `//*${tags}`);
}

module.exports = {
  queryXpath,
	queryText,
	queryNodes,
  queryTags
}
