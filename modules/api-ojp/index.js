const express = require('express')
, app = express()
//UNCOMMENT WHEN FIX BUG, config = require('config-yml')
, config = require('./config')
, port =  config.server.port || 5000
, xpath = require('xpath')
, dom = require('xmldom').DOMParser
, xmlbuilder = require('xmlbuilder')
, xmlparser = require('express-xml-bodyparser')
, {locationExecution} = require('./services/locations')
, {eventExecution} = require('./services/stop-events')
, {tripExecution} = require('./services/trips')
, {exchangePointsExecution} = require('./services/exchange-points');

const cors = require('cors');

const mapNS = {
  'siri' : 'http://www.siri.org.uk/siri',
  'ojp': 'http://www.vdv.de/ojp',
};

app.use(xmlparser());

app.use(cors());

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
//
app.get('/ojp/', async (req, result) => {
  result.send({'status':'OK','description':'send POST data in /ojp/'});
});

app.post('/ojp/', async (req, result) => {

  //console.log('request ',req.rawBody)
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
    xmlServiceResponse.importXMLBuilder(await locationExecution(doc, startTime));    
  }

  if(queryNode(doc, "//*[name()='ojp:OJPStopEventRequest']")){
    xmlServiceResponse.importXMLBuilder(await eventExecution(doc, startTime));    
  }

  if(queryNode(doc, "//*[name()='ojp:OJPTripRequest']")){
    xmlServiceResponse.importXMLBuilder(await tripExecution(doc, startTime));    
  }

  if(queryNode(doc, "//*[name()='ojp:OJPExchangePointsRequest']")){
    xmlServiceResponse.importXMLBuilder(await exchangePointsExecution(doc, startTime));    
  }

  const resXml = ojpXML.end({ pretty: true})
  result.set({
    'Content-Type': 'application/xml',
    'Content-Length': resXml.length
  })
  result.send(resXml);

});

app.listen(port, () => {
  console.log(`API OJP service running on http://localhost:${port}/ojp`)
})
