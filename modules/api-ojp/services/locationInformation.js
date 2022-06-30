const xmlbuilder = require('xmlbuilder');
const qstr = require('querystring');
const _ = require('lodash');

const {queryNode, queryNodes, queryText, queryTags} = require('../lib/query');
const {doRequest} = require('../lib/request');
const {parseParamsRestrictions, parseGeoRestriction} = require('../lib/restrictions');
const {createErrorResponse, ptModesResponse, precisionMeters, stopText, lineText} = require('../lib/response');

const serviceName = 'OJPLocationInformation';

const createResponse = (config,
                        stops,
                        startTime,
                        ptModes,
                        skip = 0,
                        limit = null
                      ) => {

  const {location_digits} = config;

  const positionPrecision = precisionMeters(config);

  const now = new Date()
    , tag = xmlbuilder.create(`ojp:${serviceName}Delivery`);
  tag.ele('siri:ResponseTimestamp', now.toISOString());
  tag.ele('siri:Status', stops.length === 0 ? false : true);

  tag.ele('ojp:CalcTime', now.getTime() - startTime);

  if ( limit !== null && limit === stops.length) {
    tag.ele('ojp:ContinueAt', skip + limit);
  }

  for(const stop of stops){
    const loc = tag.ele('ojp:Location')
    const place = loc.ele('ojp:Location');
    const stopPlace = place.ele('ojp:StopPlace');
    stopPlace.ele('ojp:StopPlaceRef', stop.gtfsId);
    stopPlace.ele('ojp:StopPlaceName').ele('ojp:Text', `${stop.name}`);
    stopPlace.ele('ojp:TopographicPlaceRef', stop.zoneId);

    place.ele('ojp:LocationName').ele('ojp:Text', stopText(stop));

    const geo = place.ele('ojp:GeoPosition');
    geo.ele('siri:Longitude', _.round(stop.lon, location_digits) );
    geo.ele('siri:Latitude', _.round(stop.lat, location_digits) );

    loc.ele('ojp:Complete', true);
    loc.ele('ojp:Probability', (1 / stops.length).toFixed(2)); //TODO: other criteria?
    if(ptModes === true) {
      const mode = loc.ele('ojp:Mode');

      const ojpMode = ptModesResponse( stop.vehicleMode );

      //mode.ele('ojp:PtMode', stop.vehicleMode != null ? stop.vehicleMode.toLowerCase() : 'unknown');
      mode.ele('ojp:PtMode', ojpMode);
    }
  }

  if(stops.length === 0){
    const err = tag.ele('siri:ErrorCondition');
    err.ele('siri:OtherError');
    err.ele('siri:Description', 'LOCATION_NO_RESULTS');
  }

  return tag;
}

module.exports = {
  'locationExecution' : async (doc, startTime, config) => {
    
    const serviceTag = `ojp:${serviceName}Request`;

    const {logger} = config;

    try {

      const { limit, skip, ptModes, type } = parseParamsRestrictions(doc, serviceTag, config);

      if(type != 'stop') {
        //XXX: we supports only stops
        return createErrorResponse(serviceName, config.errors.noresults.locations, startTime);
      }

      if(queryNodes(doc, [serviceTag,'ojp:PlaceRef']).length > 0) {

        let stopId = queryTags(doc, [serviceTag, 'ojp:PlaceRef', 'ojp:StopPlaceRef']);

        if(stopId == null){
          stopId = queryTags(doc, [serviceTag, 'ojp:PlaceRef', 'StopPointRef']);
        }

        const stopName = queryTags(doc, [serviceTag, 'ojp:PlaceRef', 'ojp:LocationName', 'ojp:Text']);

        const locationName = queryNodes(doc, [serviceTag, 'ojp:PlaceRef', 'ojp:LocationName']);

        //
        //TODO TopographicPlace here
        //
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

        return createResponse(config, response.stops, startTime, ptModes, skip, limit);
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

        return createResponse(config, response.stops, startTime, ptModes, skip, limit);
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