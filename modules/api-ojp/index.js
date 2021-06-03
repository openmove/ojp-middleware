const express = require('express')
, app = express()
, config = require('config-yml')
, port =  config.server.port || 5000
, xpath = require('xpath')
, dom = require('xmldom').DOMParser
, xmlbuilder = require('xmlbuilder')
, xmlparser = require('express-xml-bodyparser')
, {locationExecution} = require('./services/locations')


const mapNS = {
  'siri' : 'http://www.siri.org.uk/siri',
  'ojp': 'http://www.vdv.de/ojp',
};

app.use(xmlparser());


//common Functions

const queryNodes = (doc, path) => {
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

  const nodeText = node.textContent;

  return nodeText
}


//Endpoint

app.post('/ojp/', async (req, result) => {
  const xml = req.rawBody;
  const doc = new dom().parseFromString(xml);
  const startTime = new Date().getTime();
  const ojpXML = xmlbuilder.create('siri:OJP', {
    encoding: 'utf-8',
  });

  ojpXML.att('xmlns:siri', 'http://www.siri.org.uk/siri');
  ojpXML.att('xmlns:ojp', 'http://www.vdv.de/ojp');
  ojpXML.att('version', '1.0');

  const xmlServiceResponse = ojpXML.ele('siri:OJPResponse').ele('siri:ServiceDelivery');

  const responseTimestamp = new Date().toISOString();
  xmlServiceResponse.ele('siri:ResponseTimestamp', responseTimestamp);
  xmlServiceResponse.ele('siri:ProducerRef', 'OJP OpenMove Middleware');
  xmlServiceResponse.ele('siri:Status', true);

  if(queryNode(doc, "//*[name()='ojp:OJPLocationInformationRequest']")){
    //elaborate OJPLocationInformationRequest
    xmlServiceResponse.importXMLBuilder(await locationExecution(doc, startTime));    
  }

  
  //receive ojp requests in this order (?)
  /*
  OJPLocationInformation
  OJPTrip
  OJPStopEvent
  OJPTripInfo
  OJPExchangePoints
  OJPMultiPointTrip
  */

  const resXml = ojpXML.end({ pretty: true})
  result.set({
    'Content-Type': 'application/xml',
    'Content-Length': resXml.lenght
  })
  result.send(resXml);

});

app.listen(port, () => {
  console.log(`API OJP service running on port ${port}`)
})
