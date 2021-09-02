const express = require('express')
    , app = express()
    , cors = require('cors')
    , dom = require('xmldom').DOMParser
    , xmlbuilder = require('xmlbuilder')
    , xmlparser = require('express-xml-bodyparser')
    , pino = require('pino');

const {queryNode, queryNodes, queryText} = require('./lib/query')
    , {locationExecution} = require('./services/locations')
    , {eventExecution} = require('./services/stop-events')
    , {tripsExecution} = require('./services/trips')  //TODO rename in trip
    , {tripInfoExecution} = require('./services/trip-info')
    , {multipointTripExecution} = require('./services/multipoint-trip')
    , {exchangePointsExecution} = require('./services/exchange-points');

const dotenv = require('dotenv').config()
    , config = require('@stefcud/configyml')
    , logger = pino({
      level: config.logs.level || "info",
      prettyPrint: {
        translateTime: "SYS:standard",
        colorize: config.logs.colorize == null ? true : config.logs.colorize, 
        ignore: config.logs.ignore,
        messageFormat: `{msg}`
      },
    });
config.logger = logger;

app.use(cors());

app.use(xmlparser());

app.get('/ojp/', async (req, result) => {
  result.send({
    status: 'OK',
    description: 'send POST data to /ojp/',
    services: config.services
  });
});

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
    if(!config.services.OJPLocationInformationRequest) {
      logger.warn('OJPLocationInformationRequest disabled by config')
    }
    else {
      xmlServiceResponse.importXMLBuilder(await locationExecution(doc, startTime, config));
    }
  }

  if(queryNode(doc, "//*[name()='ojp:OJPStopEventRequest']")){
    if(!config.services.OJPStopEventRequest) {
      logger.warn('OJPStopEventRequest disabled by config');
    }
    else {
      xmlServiceResponse.importXMLBuilder(await eventExecution(doc, startTime, config));
    }    
  }

  if(queryNode(doc, "//*[name()='ojp:OJPTripRequest']")){
    if(!config.services.OJPTripRequest) {
      logger.warn('OJPTripRequest disabled by config');
    }
    else {
      xmlServiceResponse.importXMLBuilder(await tripsExecution(doc, startTime, config));
    }  
  }
  
  if(queryNode(doc, "//*[name()='ojp:OJPTripInfoRequest']")){
    if(!config.services.OJPTripInfoRequest) {
      logger.warn('OJPTripInfoRequest disabled by config');
    }
    else {
      xmlServiceResponse.importXMLBuilder(await tripInfoExecution(doc, startTime, config));
    }  
  }

  if(queryNode(doc, "//*[name()='ojp:OJPExchangePointsRequest']")){
    if(!config.services.OJPExchangePointsRequest) {
      logger.warn('OJPExchangePointsRequest disabled by config');
    }
    else {
      xmlServiceResponse.importXMLBuilder(await exchangePointsExecution(doc, startTime, config));
    }
  }

  if(queryNode(doc, "//*[name()='ojp:OJPMultiPointTripRequest']")){
    if(!config.services.OJPMultiPointTripRequest) {
      logger.warn('OJPMultiPointTripRequest disabled by config');
    }
    else {
      xmlServiceResponse.importXMLBuilder(await multipointTripExecution(doc, startTime, config));
    }
  }

  const resXml = ojpXML.end({ pretty: true});
  result.set({
    'Content-Type': 'application/xml',
    'Content-Length': resXml.length
  })
  result.send(resXml);

});

app.listen(Number(config.server.port), () => {
  logger.info(`listening at http://localhost:${config.server.port}`)
})
