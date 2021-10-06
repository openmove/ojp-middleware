
const xpath = require('xpath');

const mapNS = {
  'siri' : 'http://www.siri.org.uk/siri',
  'ojp': 'http://www.vdv.de/ojp',
};

const queryNodesOld = (doc, path) => {
  const queryNS = xpath.useNamespaces(mapNS);
  const nodes = queryNS(path, doc);
  return nodes
}

const queryNode = (doc, path) => {
  const nodes = queryNodes(doc, path)
  if (nodes.length === 0) {
      return null;
  }
  return nodes[0]
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

  const tags = paths.map(str => {
    return `[name()='${str}']`;
  }).join('/*');

  const query = `//*${tags}`;
  
  return queryText(doc, query);
}

const queryNodes = (doc, paths) => {
  if (!Array.isArray(paths)) {
    return queryNodesOld(doc, paths)
  }

  const tags = paths.map(str => {
    return `[name()='${str}']`;
  }).join('/*');

  const query = `//*${tags}`;

  const queryNS = xpath.useNamespaces(mapNS);
  const nodes = queryNS(query, doc);
  return nodes
}


module.exports = {
	'queryText': queryText,
	'queryNode': queryNode,
	'queryNodes': queryNodes,
  'queryTags': queryTags
}
