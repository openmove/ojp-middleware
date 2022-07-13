
const xpath = require('xpath');

const mapNS = {
  'siri' : 'http://www.siri.org.uk/siri',
  'ojp': 'http://www.vdv.de/ojp',
};

const queryNodesOld = (doc, path) => {
  path = path.replace('ojp:','');     //PATCH (TODO REMOVE)
  const queryNS = xpath.useNamespaces(mapNS);
  const nodes = queryNS(path, doc);
  return nodes
}

const queryNodes = (doc, paths) => {
  if (!Array.isArray(paths)) {
    return queryNodesOld(doc, paths)
  }

  const tags = paths.map(path => {
    path = path.replace('ojp:','');     //PATCH (TODO REMOVE)

    return `[local-name()='${path}']`;
  }).join('/*');

  const query = `//*${tags}`;

  const queryNS = xpath.useNamespaces(mapNS);
  const nodes = queryNS(query, doc);
  return nodes
}


const queryText = (doc, path) => {
  path = path.replace('ojp:','');     //PATCH (TODO REMOVE)

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
    path = path.replace('ojp:','');     //PATCH (TODO REMOVE)

    return `[local-name()='${path}']`;
  }).join('/*');

  const query = `//*${tags}`;

  return queryText(doc, query);
}

module.exports = {
	'queryText': queryText,
	'queryNodes': queryNodes,
  'queryTags': queryTags
}
