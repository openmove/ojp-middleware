const express = require('express');
const app = express()
const config = require('config-yml');
const {getStopById} = require('./stops');
const { request } = require('express');
const port =  config.server.port || 5000;

/**
 * OJPLocationInformationRequest
 */


app.get('/stops/:id?', (req, result) => {
  //search a stop by id in PlaceRef
  //if id is undefined return all stops
  const extra = {
    'mode': req.query.mode || false,
    'limit': req.query.limit || 10
  };
  const res = getStopById(config.endpoints, req.params.id, extra)
  console.log("Done");
  result.send(res);
});

app.post('/search/', (req, result) => {
  //search stops with given name 
  //and filtered by:
  //1) bbox 2) circle 2) polygon

  /**
   * {
   *  name: XXXX
   *  filter: {
   *    type: 'bbox' || 'circle' || 'polygon'
   *    value: [upper-left, lower-right] || radius || [...polyline]
   *  }
   * }
   * 
   */

});

/**
 * OJPStopEventRequest
 */

app.get('/stops/:id/details', (req, result) => {
  //return stoptimes and other schedule details for stop

});

/**
 * OJPExchangePointsRequest
 */

 app.get('/exchange/:id', (req, result) => {
  //return an exchange by id in PlaceRef
});

/**
 * OJPTripRequest
 */

 app.post('/plan/', (req, result) => {
  //search a trip with given parameters:
  //origin, destination, waypoints, no transfers at, ...

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