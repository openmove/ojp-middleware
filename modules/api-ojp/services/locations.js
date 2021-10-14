const xmlbuilder = require('xmlbuilder');
const qstr = require('querystring');
const _ = require('lodash');

const {queryNode, queryNodes, queryText, queryTags} = require('../lib/query');
const {doRequest} = require('../lib/request');
const {parseParamsRestrictions, parseGeoRestrictions} = require('../lib/restrictions');
const {createErrorResponse} = require('../lib/response');

const serviceName = 'OJPLocationInformation';

const createLocationResponse = (stops, startTime, ptModes) => {
  const responseTimestamp = new Date().toISOString();
  const calcTime = (new Date().getTime()) - startTime
  const location = xmlbuilder.create(`ojp:${serviceName}Delivery`);
  location.ele('siri:ResponseTimestamp', responseTimestamp);
  location.ele('siri:Status', stops.length === 0 ? false : true);
  location.ele('ojp:CalcTime', calcTime);

  for(const stop of stops){
    const loc = location.ele('ojp:Location')
    const place = loc.ele('ojp:Location');
    const stopPlace = place.ele('ojp:StopPlace');
    stopPlace.ele('ojp:StopPlaceRef', stop.gtfsId);
    stopPlace.ele('ojp:StopPlaceName').ele('ojp:Text', `${stop.name}`);
    stopPlace.ele('ojp:TopographicPlaceRef', stop.zoneId);
    place.ele('ojp:LocationName').ele('ojp:Text', `${stop.name}`);
    const geo = place.ele('ojp:GeoPosition');
    geo.ele('siri:Longitude', stop.lon);
    geo.ele('siri:Latitude', stop.lat);
    loc.ele('ojp:Complete', true);
    loc.ele('ojp:Probability', (1 / stops.length).toFixed(2)); //TODO: other criteria?
    if(ptModes === true){
      const mode = loc.ele('ojp:Mode');
      mode.ele('ojp:PtMode', stop.vehicleMode.toLowerCase());
    }
  }

  if(stops.length === 0){
    const err = location.ele('siri:ErrorCondition');
    err.ele('siri:OtherError')
    err.ele('siri:Description', 'LOCATION_NO_RESULTS');
  }

  return location;
}

module.exports = {
  'locationExecution' : async (doc, startTime, config) => {
    
    const serviceTag = `ojp:${serviceName}Request`;

    const {logger} = config;

    try {

      const { limit, skip, ptModes } = parseParamsRestrictions(doc, serviceTag, config);

      if(queryNodes(doc, [serviceTag,'ojp:PlaceRef']).length > 0) {

        let stopId = queryTags(doc, [serviceTag, 'ojp:PlaceRef', 'ojp:StopPlaceRef']);

        if(stopId == null){
          stopId = queryTags(doc, [serviceTag, 'ojp:PlaceRef', 'ojp:StopPointRef']);
        }

        const stopName = queryTags(doc, [serviceTag, 'ojp:PlaceRef', 'ojp:LocationName', 'ojp:Text']);

        const locationName = queryNodes(doc, [serviceTag, 'ojp:PlaceRef', 'ojp:LocationName']);

        let json = '', options = {};

        if (stopId) {

          const querystr = qstr.stringify({limit/*, skip*/});

          options = {
            host: config['api-otp'].host,
            port: config['api-otp'].port,
            path: `/stops/${stopId}?${querystr}`, //limit is not necessary in this case because we are looking for an ID.
            method: 'GET',
            json: true
          };
        }
        else if (stopName) {

          json = JSON.stringify({value: stopName});

          options = {
            host: config['api-otp'].host,
            port: config['api-otp'].port,
            path: `/search/`,
            method: 'POST',
            json: true,
            headers: {
              'Content-Type': 'application/json',
              'Content-Length': json.length,
            }
          };
        }
        else if(locationName) { //GET ALL

          const querystr = qstr.stringify({limit/*, skip*/});

          options = {
            host: config['api-otp'].host,
            port: config['api-otp'].port,
            path: `/stops/?${querystr}`, //limit is not necessary in this case because we are looking for an ID.
            method: 'GET',
            json: true
          };
        }

        const response = await doRequest(options, json);

        const stops = _.slice(response.stops, skip, limit);

        return createLocationResponse(stops, startTime, ptModes);
      }
      else if(queryNodes(doc, [serviceTag, 'ojp:InitialInput']).length > 0) {

        const LocationName = queryTags(doc, [serviceTag,'ojp:InitialInput','ojp:LocationName']);

        const locationPositionLat = queryTags(doc, [serviceTag,'ojp:InitialInput','ojp:GeoPosition','Latitude']);
        
        const locationPositionLon = queryTags(doc, [serviceTag,'ojp:InitialInput','ojp:GeoPosition','Longitude']);

        const params = {
          value: LocationName,
          limit: limit
        };
        
        let json = JSON.stringify(params);

        const geoRestriction = queryNode(doc, [serviceTag,'ojp:InitialInput','ojp:GeoRestriction']);

         if(geoRestriction) {

          logger.debug('GeoRestriction', geoRestriction);

          const { rect, upperLon, upperLat, lowerLon, lowerLat
                , circle, radius, centerLon, centerLat } = parseGeoRestrictions(doc, serviceTag, config);

          if(rect) {
            params.restrictionType = 'bbox';
            params.restrictionValue = [upperLon, upperLat, lowerLon, lowerLat].join(',');
          }
          else if(circle) {
            params.restrictionType = 'circle';
            params.restrictionValue = [centerLon, centerLat, radius].join(',');
          }
          else{
            throw new Error('Unrecognize Restriction');
          }
        }

        if(locationPositionLat != null && locationPositionLon != null){
          
          params.position = [locationPositionLon, locationPositionLat];

          json = JSON.stringify(params);
        }

        const options = {
          host: config['api-otp'].host,
          port: config['api-otp'].port,
          path: `/search/`,
          json: true,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': json.length,
          }
        };

        const response = await doRequest(options, json);

        const stops = _.slice(response.stops, skip, limit);

        //logger.info(response)
        return createLocationResponse(stops, startTime, ptModes);
      }
      else {
        return createErrorResponse(serviceName, 'E0001', startTime);
      }
    }
    catch(err){
      logger.error(err);
      return createErrorResponse(serviceName, 'E0002', startTime);
    }
    
  }
}