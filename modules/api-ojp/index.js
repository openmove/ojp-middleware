const express = require('express')
    , _ = require('lodash')
    , app = express()
    , cors = require('cors')
    , { DOMParser } = require('xmldom')
    , xmlbuilder = require('xmlbuilder')
    , xmlparser = require('express-xml-bodyparser')
    , { MongoClient } = require("mongodb")
    , pino = require('pino')
    , nocache = require('nocache');

const { version,'name':serviceName } = require('./package.json');

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

const { queryNodes, queryText } = require('./lib/query')
    , { createErrorResponse } = require('./lib/response')

const { exchangePointsExecution } = require('./services/exchangePoints')
    , { multipointTripExecution } = require('./services/multiPointTrip')
    , { locationExecution } = require('./services/locationInformation')
    , { tripInfoExecution } = require('./services/tripInfo')
    , { eventExecution } = require('./services/stopEvent')
    , { tripsExecution } = require('./services/trip');

logger.debug(_.omit(config,['dev','prod','environments']));

config.logger = logger;

const logrequest = (xml, status = 'OK', req) => {

  if(config.server.logrequest === 'false' || 
     config.server.logrequest === false) {
    logger.warn('config.server.logrequest disabled')    
    return null;
  }

  xml = _.isString(xml) && xml.length > 0 ? xml : '[EMPTY]';

  const obj = {
      'createdAt': new Date(),
      'status': status,      
      'request': xml.split("\n"),
      //'headers': req.headers
    };

  try{
    MongoClient.connect(config.db.uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    }, (err, client) => {
      if (err) {
        logger.error(err);
      }else{
        client
        .db(config.db.name)
        .collection('log-requests')
        .insertOne(obj, function(err, queryres) {
          if (err) {
            logger.error(err);
          }
          client.close();
        });
      }
    });
  }
  catch (exc) {
    logger.warn('error db connection');
  }

};

app.use(nocache());

app.use(cors());

app.use(xmlparser({strict:false}));

app.get('/ojp/logs', async (req, getres) => {
  getres.send('');
return
  const limit = Number(req.query.limit) || 10;

  const format = req.query.format || 'text';

  try{
    MongoClient.connect(config.db.uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    }, (err, client) => {
      if (err) {
        throw err;
          getres.send('error db connection');
        return
      }

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
            return `[${row.createdAt}]\n\n"${row.status}"\n\n` +
                    row.request.join("\n")
          }).join("\n\n----------------\n\n");

          getres.setHeader('content-type', 'text/json');
          getres.send(resText);
        }

        client.close();
      });
    });
  }
  catch (exc) {
    logger.warn('error db connection');
    getres.send('');
  }
});

app.post('/ojp/', async (req, result) => {

  const xml = req.rawBody;

  let doc;

  try {
    doc = new DOMParser({
      errorHandler:{
        warning: errorMsg => {
          console.warn('WARNING XML PARSING', errorMsg);
        },
        error: errorMsg => {

          console.warn('ERROR XML PARSING',errorMsg)

          const errorCode = errorMsg.replace("\n",' ');

          const ojpErr = xmlbuilder.create('siri:OJP', {encoding: 'utf-8'});
          ojpErr.att('xmlns:siri', 'http://www.siri.org.uk/siri');

          ojpErr.att('xmlns:ojp', 'http://www.vdv.de/ojp');

          ojpErr.att('version', '1.0');

          //TODO use createErrorResponse()

          const xmlServiceResponse = ojpErr.ele('siri:OJPResponse').ele('siri:ServiceDelivery');
          const location = xmlbuilder.create('ojp:ERROR');
          //TODO replace with request name
          location.ele('siri:ResponseTimestamp',  new Date().toISOString());
          location.ele('siri:Status', false);
          const err = location.ele('siri:ErrorCondition');
          err.ele('siri:OtherError')
          err.ele('siri:Description', errorCode);
          xmlServiceResponse.importXMLBuilder(location);

          const resXml = ojpErr.end({pretty: true});
          
          result.set({
            'Content-Type': 'application/xml',
            'Content-Length': resXml.length
          });

          result.send(resXml);

          logrequest(xml, errorCode);

          return false
        }
      }
    }).parseFromString(xml);
  }
  catch(err) {
    logger.error(err);
    return;
  }

  if(doc===undefined) {
    return
  }
  logrequest(xml,'OK',req);

  const startTime = new Date().getTime();

  const ojpXML = xmlbuilder.create('siri:OJP', {
    encoding: 'utf-8',
  });

  let xmlnsOjp = 'xmlns:ojp';

  if( config.ojptag_in_response === false ){
    xmlnsOjp = 'xmlns';
  }

  ojpXML.att(xmlnsOjp, 'http://www.vdv.de/ojp');
  ojpXML.att('xmlns:siri', 'http://www.siri.org.uk/siri');

  ojpXML.att('version', '1.0');

  const xmlServiceDelivery = ojpXML.ele('siri:OJPResponse').ele('siri:ServiceDelivery');

  const responseTimestamp = new Date().toISOString();
  xmlServiceDelivery.ele('siri:ResponseTimestamp', responseTimestamp);
  xmlServiceDelivery.ele('siri:ProducerRef', 'OJPOpenMoveMiddleware');
  xmlServiceDelivery.ele('siri:Status', true);
  //minimum response tags

  if(queryNodes(doc, ['OJPExchangePointsRequest']).length > 0) {
    if(!config.services.OJPExchangePointsRequest) {
      logger.warn('OJPExchangePointsRequest disabled by config');
    }
    else {
      xmlServiceDelivery.importXMLBuilder(await exchangePointsExecution(doc, startTime, config));
    }
  }

  if(queryNodes(doc, ['OJPLocationInformationRequest']).length > 0) {
    if(!config.services.OJPLocationInformationRequest) {
      logger.warn('OJPLocationInformationRequest disabled by config')
    }
    else {
      xmlServiceDelivery.importXMLBuilder(await locationExecution(doc, startTime, config));
    }
  }

  if(queryNodes(doc, ['OJPMultiPointTripRequest']).length > 0) {
    if(!config.services.OJPMultiPointTripRequest) {
      logger.warn('OJPMultiPointTripRequest disabled by config');
    }
    else {
      xmlServiceDelivery.importXMLBuilder(await multipointTripExecution(doc, startTime, config));
    }
  }

  if(queryNodes(doc, ['OJPStopEventRequest']).length > 0) {
    if(!config.services.OJPStopEventRequest) {
      logger.warn('OJPStopEventRequest disabled by config');
    }
    else {
      xmlServiceDelivery.importXMLBuilder(await eventExecution(doc, startTime, config));
    }
  }

  if(queryNodes(doc, ['OJPTripInfoRequest']).length > 0) {
    if(!config.services.OJPTripInfoRequest) {
      logger.warn('OJPTripInfoRequest disabled by config');
    }
    else {
      xmlServiceDelivery.importXMLBuilder(await tripInfoExecution(doc, startTime, config));
    }
  }

  if(queryNodes(doc, ['OJPTripRequest']).length > 0) {
    if(!config.services.OJPTripRequest) {
      logger.warn('OJPTripRequest disabled by config');
    }
    else {
      xmlServiceDelivery.importXMLBuilder(await tripsExecution(doc, startTime, config));
    }
  }

  if(xmlServiceDelivery.children.length === 3) { //3 is minimum response tags, look above
    logger.warn('OJPRequest not found');
    xmlServiceDelivery.importXMLBuilder(createErrorResponse('OJP', config.errors.notagrequest, startTime));
  }

  //custom writer https://github.com/oozcitak/xmlbuilder-js/issues/195

  const optsWriter = {
    pretty: true
  };

  if( config.ojptag_in_response === false ) {
    optsWriter.writer = {
      element: function(node, options, level) {
        if(`${node.name}`.indexOf('ojp:')!=-1) {
          node.name = `${node.name}`.replace('ojp:','')
        }
        console.log(`${options.indent.repeat(level)} <${node.name}>`)
        return this._element(node, options, level);
      }
    }
  }

  const resXml = ojpXML.end(xmlbuilder.stringWriter(optsWriter));

  result.set({
    'Content-Type': 'application/xml',
    'Content-Length': resXml.length
  });

  result.send(resXml);

});

app.get(['/ojp/','/'], async (req, result) => {
  result.send({
    status: 'OK',   //TODO check other services and mongo db is reachable
    version,
    description: 'POST XML OJP requests to /ojp',
    services: config.services,
  });
});

app.listen(Number(config.server.port), () => {
  logger.info( app._router.stack.filter(r => r.route).map(r => `${Object.keys(r.route.methods)[0]} ${r.route.path}`) );
  logger.info(`service ${serviceName} listening at http://localhost:${config.server.port}`)
});

