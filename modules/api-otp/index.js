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


app.get('/stops/:id?', (req, result) => {
  //search a stop by id in PlaceRef
  //if id is undefined return all stops
  const extra = {
    'limit': req.query.limit || 10
  };
  const res = getStopById(config.endpoints, req.params.id, extra)
  result.send(res);
});

app.post('/search/', (req, result) => {
  //search stops with given name 
  //and filtered by:
  //1) bbox 2) circle 2) polygon

  /**
   * {
   *  type: 'name'||'bbox' || 'circle' || 'polygon'
   *  value: string || [[upper-left: x1, y1], [lower-right: x2, y2]] || [x, y, radius] || [...polyline]
   *  limit: integer
   *  mode: string
   * }
   */
  const params = req.body;
  const extra = {
    'limit': params.limit || 10
  };
  let res = null;
  switch(params.type){
    case 'name': 
      res = searchByName(config.endpoints, param.value, extra);
      break;
    case 'bbox':
      res = searchByBBox(config.endpoints, params.value, extra);
      break;
    case 'circle':
      res = searchByRadius(config.endpoints, params.value, extra);
      break;
  }
  result.send(res);
});

/**
 * OJPStopEventRequest
 */

app.get('/stops/:id/details', (req, result) => {
  //return stoptimes and other schedule details for stop
  const extra = {
    'limit': req.query.limit || 10,
    'start': req.quey.start || new Date().getTime()
  };
  const res = getStopTimesById(config.endpoints, req.params.id, extra)
  result.send(res);
});

/**
 * OJPTripRequest
 */

 app.post('/plan/', (req, result) => {
  //search a trip with given parameters:
  //origin, destination, waypoints, no transfers at, ...
  const params = req.body;
  const extra = {
    'limit': params.limit || 5,
    'timezone': params.timezone
  };
  const res = planTrip(config.endpoints, params.origin, params.destination, params.date, extra)
  result.send(res);
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