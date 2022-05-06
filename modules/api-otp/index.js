'use strict';

const express = require('express')
    , app = express()
    , _ = require('lodash')
    , {getStopById, getAllStops, searchByName, searchByBBox, searchByRadius} = require('./stops')
    , {getStopTimesById} = require('./stoptimes')
    , {planTrip} = require('./plan')
    , {getTripsByIdAndDate} = require('./trips')
    , {request} = require('express')
    , pino = require('pino');

const {version,'name':serviceName} = require('./package.json');

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

if (!config.otp.baseUrl) {
  const port = Number(config.otp.port)
     ,  proto = port===443 ? 'https' : 'http'
  config.otp.baseUrl = `${proto}://${config.otp.host}:${port}${config.otp.path}`;
}

logger.debug(_.omit(config,['dev','prod','environments']));

app.use(express.json());

/**
 * OJPLocationInformationRequest
 */
app.get('/stops/:id?', async (req, result) => {

  //search a stop by id in PlaceRef
  //if id is undefined return all stops
  const extra = {
    'limit': Number(req.query.limit) || 0,
    'skip': Number(req.query.skip) || 0
  };

  let res = {stops: []};

  if(!req.params.id) {
    res = await getAllStops(config, extra);
  }
  else {
    res = await getStopById(config, req.params.id, extra)
  }
  result.json(res);
});

app.post('/search/', async (req, result) => {
  //search stops with given name 
  //and filtered by:
  //1) bbox 2) circle 2) polygon

  /**
   * {
   *  value: 'XXXX',
   *  restrictionType: 'bbox' || 'circle' || 'polygon'
   *  restrictionValue: [[upper-left: x1, y1], [lower-right: x2, y2]] || [x, y, radius] || [...polyline]
   *  position: [lon,lat]
   *  limit: integer
   * }
   */
  const params = req.body;

  const extra = {
    'limit': Number(params.limit) || 0,
    'skip': Number(params.skip) || 0,
    'arriveBy': params.arriveBy || false
  };
  
  let res = {stops: []};

  if(!_.isEmpty(params.value)) {

    if(params.restrictionType && params.restrictionValue){
      const resTmp = {stops: []};
      switch(params.restrictionType){
        case 'bbox':
          resTmp = await searchByBBox(config, params.restrictionValue, extra);
          break;
        case 'circle':
          resTmp = await searchByRadius(config, params.restrictionValue, extra);
          break;
      }
      const reg = new RegExp(`(/?i)\b${value}\b`);
      for(const tmpStop of resTmp.stops){
        if(res.stops.length < params.limit){
          if(tmpStop.name.test(reg)){
            res.stops.push(tmpStop)
          }
        }else{
          break;
        }
      }
    }else{
      res = await searchByName(config, params.value, extra);
    }
  }
  else if(params.position) {
    //search at specific position (tricky: radius 10 meter)
    res = await searchByRadius(config, [...params.position,10], extra);
  }
  else
  {
    res = await getAllStops(config, extra);
  }

  result.json(res);
});

/**
 * OJPStopEventRequest
 */

app.get('/stops/:id/details', async (req, result) => {
  //return stoptimes and other schedule details for stop
  const extra = {
    'limit': Number(req.query.limit) || 0,
    'skip': Number(req.query.skip) || 0,
    'start': req.query.start || new Date().getTime()
  };
  console.log('STOPPPSS',req.params)
  const res = await getStopTimesById(config, req.params.id, extra);
  
  logger.debug(extra);

  result.json(res);
});

/**
 * OJPTripRequest
 */

 app.post('/plan/', async (req, result) => {
  //search a trip with given parameters:
  //origin, destination, waypoints, no transfers at, ...
  const params = req.body;
  logger.debug(params);

  const res = await planTrip(config, params.origin, params.destination, params.date, params);

  result.json(res);
});


/**
 * OJPTripInfoRequest
 */

 app.get('/trip/:id/:date', async (req, result) => {
  //search a trip with given parameters:
  //origin, destination, waypoints, no transfers at, ...
  const params = req.params;
  logger.debug(params);
  const res = await getTripsByIdAndDate(config, params.id, params.date, {})
  result.json(res);
});

/**
 * OJPMultiPointTripRequest
 */

 app.post('/multi-plan/', (req, result) => {
  //same as plan but with multiple origin-destinations
  //TODO: check if this is viable with otp
});

app.get(['/','/otp'], async (req, res) => {
  res.send({
    status: 'OK',   //TODO check otp is reachable
    version
  });
});

app.listen(Number(config.server.port), () => {
  logger.info( app._router.stack.filter(r => r.route).map(r => `${Object.keys(r.route.methods)[0]} ${r.route.path}`) );
  logger.info(`service ${serviceName} listening at http://localhost:${config.server.port}`)
})