const express = require('express');
const app = express()
const config = require('config-yml');
const {getStopById, searchByName, searchByBBox, searchByRadius} = require('./stops');
const {getStopTimesById} = require('./stoptimes');
const {planTrip} = require('./plan');
const { request } = require('express');
const port =  config.server.port || 5000;


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
  const res = await getStopById(config.endpoints, req.params.id, extra)
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
  console.log(params);
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
          resTmp = await searchByBBox(config.endpoints, params.restrictionValue, extra);
          break;
        case 'circle':
          resTmp = await searchByRadius(config.endpoints, params.restrictionValue, extra);
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
      res = await searchByName(config.endpoints, params.value, extra);
    }
  }else if(position && position.length == 2){ //search at specific position (tricky: radius 1 meter)
    res = await searchByRadius(config.endpoints, [...position,1], extra);
  }else{
    //TODO wrong request, manage this ?
  }
  
  
  console.log(res);
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
  const res = await getStopTimesById(config.endpoints, req.params.id, extra);
  console.log(res);
  result.json(res);
});

/**
 * OJPTripRequest
 */

 app.post('/plan/', async (req, result) => {
  //search a trip with given parameters:
  //origin, destination, waypoints, no transfers at, ...
  const params = req.body;
  console.log(params);
  const extra = {
    'limit': params.limit || 5,
    'timezone': params.timezone || "Europe/Rome"
  };
  const res = await planTrip(config.endpoints, params.origin, params.destination, params.date, extra)
  result.json(res);
});

/**
 * OJPMultiPointTripRequest
 */

 app.post('/multi-plan/', (req, result) => {
  //same as plan but with multiple origin-destinations
  //TODO: check if this is viable with otp
});

app.listen(port, () => {
  console.log(`API OTP service running on port ${port}`)
})