const express = require('express')
    , _ = require('lodash')
    , app = express()
    , cors = require('cors')
    , dom = require('xmldom').DOMParser
    , xmlbuilder = require('xmlbuilder')
    , xmlparser = require('express-xml-bodyparser')
    , mongoClient = require("mongodb").MongoClient
    , pino = require('pino')
    , nocache = require('nocache');

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

logger.info(config);

config.logger = logger;

const logrequest = (xml, req) => {

  if(config.server.logrequest === 'false' || 
     config.server.logrequest === false) {
    logger.warn('config.server.logrequest disabled')    
    return null;
  }

  xml = _.isString(xml) && xml.length > 0 ? xml : '';

  try{
    mongoClient.connect(config.db.uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    }, (err, client) => {
      if (err) {
        logger.error(err);
      }else{
        client
        .db(config.db.name)
        .collection('log-requests')
        .insertOne({
          'createdAt': new Date(),
          'request': xml.split("\n")
          //'headers': req.headers
        }, function(err, queryres) {
          if (err) {
            logger.error(err);
          }
          client.close();
        });
      }
    });
  }catch (exc){
    logger.error(exc);
  }

};

app.use(nocache());

app.use(cors());

app.use(xmlparser());

app.get('/ojp/', async (req, result) => {
  result.send({
    status: 'OK',
    description: 'send POST data to /ojp/',
    services: config.services
  });
});

app.get('/ojp/logs', async (req, getres) => {
  
  logger.info(`request GET ${req.url} ${new Date().toISOString()}`);

  const limit = Number(req.query.limit) || 10;

  const format = req.query.format || 'text';

  mongoClient.connect(config.db.uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  }, (err, client) => {
    if (err) throw err;

    client
        .db(config.db.name)
        .collection('log-requests')
    .find({})
    .sort({'createdAt': -1})
    .limit(limit)
    .toArray(function(err, queryres) {

      if(format==='json') {
        getres.json(queryres);
      }
      else if(format==='text') {

        const resText = queryres.map( row => {
          return `[${row.createdAt}]\n` +
                  row.request.join("\n")
        }).join("\n\n----------------\n\n");

        getres.setHeader('content-type', 'text/json');
        getres.send(resText);
      }

      client.close();
    });
  });
});

app.post('/ojp/', async (req, result) => {

  const xml = req.rawBody;

  logrequest(xml, req);
  let doc;

  try {
    doc = new dom({
      errorHandler:{
        warning: e => {console.warn('DOM WARN', e)},
        error: e => {
          result.send(e)
          console.error('DOM ERR', e)

          return
        }
      }
    }).parseFromString(xml);
  }
  catch(err) {
    console.warn('ERROR XML PARSING',err)
    logger.error(err);
    
    return;
  }

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

  const resXml = ojpXML.end({pretty: true});

  result.set({
    'Content-Type': 'application/xml',
    'Content-Length': resXml.length
  });

  result.send(resXml);

});

app.listen(Number(config.server.port), () => {
  logger.info(`listening at http://localhost:${config.server.port}`)
});

