'use strict';

const express = require('express')
, app = express()
, {getStopById, searchByName, searchByBBox, searchByRadius} = require('./stops')
, {getStopTimesById} = require('./stoptimes')
, {planTrip} = require('./plan')
, {getTripsByIdAndDate} = require('./trips')
, {request} = require('express')
, pino = require('pino');

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

app.use(express.json())

/**
 * OJPLocationInformationRequest
 */


app.get('/stops/:id?', async (req, result) => {
  //search a stop by id in PlaceRef
  //if id is undefined return all stops
  const extra = {
    'limit': req.query.limit || 10
  };
  const res = await getStopById(config, req.params.id, extra)
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
   *  limit: integer
   * }
   */
  const params = req.body;
  logger.debug(params);
  const extra = {
    'limit': params.limit || 10,
    'arriveBy': params.arriveBy || false
  };
  let res = {stops: []};
  if(value != null){
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
  }else if(position && position.length == 2){ //search at specific position (tricky: radius 1 meter)
    res = await searchByRadius(config, [...position,1], extra);
  }else{
    //TODO wrong request, manage this ?
  }
  
  
  logger.debug(res);
  result.json(res);
});

/**
 * OJPStopEventRequest
 */

app.get('/stops/:id/details', async (req, result) => {
  //return stoptimes and other schedule details for stop
  const extra = {
    'limit': req.query.limit || 10,
    'start': req.query.start || new Date().getTime()
  };
  const res = await getStopTimesById(config, req.params.id, extra);
  logger.debug(res);
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
  const res = await planTrip(config, params.origin, params.destination, params.date, params)
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

app.listen(Number(config.server.port), () => {
  logger.info(`listening at http://localhost:${config.server.port}`)
})