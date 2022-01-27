const xmlbuilder = require('xmlbuilder');
const qstr = require('querystring');
const _ = require('lodash');

const {queryNode, queryNodes, queryText, queryTags} = require('../lib/query');
const {doRequest} = require('../lib/request');
const {parseParamsRestrictions, parseGeoRestriction} = require('../lib/restrictions');
const {createErrorResponse} = require('../lib/response');

const serviceName = 'OJPLocationInformation';

const createResponse = (stops, startTime, ptModes) => {

  const now = new Date()
    , tag = xmlbuilder.create(`ojp:${serviceName}Delivery`);
  tag.ele('siri:ResponseTimestamp', now.toISOString());
  tag.ele('ojp:CalcTime', now.getTime() - startTime);

  tag.ele('siri:Status', stops.length === 0 ? false : true);

  for(const stop of stops){
    const loc = tag.ele('ojp:Location')
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
    const err = tag.ele('siri:ErrorCondition');
    err.ele('siri:OtherError')
    err.ele('siri:Description', 'LOCATION_NO_RESULTS');
  }

  return tag;
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

          const querystr = qstr.stringify({limit, skip});

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

          const querystr = qstr.stringify({limit, skip});

          options = {
            host: config['api-otp'].host,
            port: config['api-otp'].port,
            path: `/stops/?${querystr}`, //limit is not necessary in this case because we are looking for an ID.
            method: 'GET',
            json: true
          };
        }

        const response = await doRequest(options, json);

        //const stops = _.slice(response.stops, skip, limit);

        return createResponse(response.stops, startTime, ptModes);
      }
      else if(queryNodes(doc, [serviceTag, 'ojp:InitialInput']).length > 0) {

        const LocationName = queryTags(doc, [serviceTag,'ojp:InitialInput','ojp:LocationName']);

        const params = {
          value: LocationName,
          limit,
          skip
        };
        
        const geoRestriction = queryNode(doc, [serviceTag,'ojp:InitialInput','ojp:GeoRestriction']);

        if(geoRestriction) {

          logger.debug('GeoRestriction', geoRestriction);

          const { rect, upperLon, upperLat, lowerLon, lowerLat
                , circle, radius, centerLon, centerLat } = parseGeoRestriction(doc, serviceTag, config);

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

        const geoPositionLat = queryTags(doc, [serviceTag,'ojp:InitialInput','ojp:GeoPosition','Latitude'])
            , geoPositionLon = queryTags(doc, [serviceTag,'ojp:InitialInput','ojp:GeoPosition','Longitude']);

        if(geoPositionLat != null && geoPositionLon != null) {
          params.position = [geoPositionLon, geoPositionLat].join(',');
        }

        const json = JSON.stringify(params);

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

        //const stops = _.slice(response.stops, skip, limit);

        //logger.info(response)
        return createResponse(response.stops, startTime, ptModes);
      }
      else {
        return createErrorResponse(serviceName, config.errors.notagcondition, startTime);
      }
    }
    catch(err){
      logger.error(err);
      return createErrorResponse(serviceName, config.errors.noparsing, startTime);
    }
    
  }
}