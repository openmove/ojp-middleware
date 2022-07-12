const xmlbuilder = require('xmlbuilder');
const qstr = require('querystring');
const _ = require('lodash');

const {queryNode, queryNodes, queryText, queryTags} = require('../lib/query');
const {doRequest} = require('../lib/request');
const {parseParamsRestrictions, parseGeoRestriction} = require('../lib/restrictions');
const {createErrorResponse, ptModesResponse, precisionMeters} = require('../lib/response');

const serviceName = 'OJPExchangePoints';

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
    , tag = xmlbuilder.create(`${serviceName}Delivery`);
  tag.ele('siri:ResponseTimestamp', now.toISOString());
  tag.ele('siri:Status', stops.length === 0 ? false : true);

  tag.ele('CalcTime', now.getTime() - startTime);

  if ( limit !== null && limit === stops.length) {
    tag.ele('ContinueAt', skip + limit);
  }

  for(const stop of stops) {
    const loc = tag.ele('Place')
    const place = loc.ele('Place');
    const stopPlace = place.ele('StopPlace');
    stopPlace.ele('StopPlaceRef', stop['MetaID']);
    stopPlace.ele('StopPlaceName').ele('Text', `${stop.Name}`);
    const private = stopPlace.ele('PrivateCode');
    private.ele('System', 'LinkingAlps');
    private.ele('Value', stop['GlobalID'])
    stopPlace.ele('TopographicPlaceRef', stop.zoneId);
    place.ele('LocationName').ele('Text', `${stop.Name}`);

    const geo = place.ele('GeoPosition');
    geo.ele('siri:Longitude', _.round(stop['long'], location_digits) );
    geo.ele('siri:Latitude', _.round(stop['lat'], location_digits) );

    if(ptModes) {

      const mode = loc.ele('Mode');
      
      const ojpMode = ptModesResponse( stop['MainMode'] );

      mode.ele('PtMode', ojpMode);

     /* if(stop['MainMode'].toLowerCase() === '~bus~'){
        mode.ele('PtMode', 'BUS');
      }
      if(stop['MainMode'].toLowerCase() === '~train~'){
        mode.ele('PtMode', 'RAIL');
      }*/
    }
  }

  if(stops.length === 0){
    const err = tag.ele('siri:ErrorCondition');
    err.ele('siri:OtherError')
    err.ele('siri:Description', 'EXCHANGEPOINTS_NO_RESULTS');
    //TODO use config errors
  }

  return tag;
}

module.exports = {
  'exchangePointsExecution' : async (doc, startTime, config) => {
    
    const serviceTag = `${serviceName}Request`;

    const {logger} = config;
    
    try{

      const { limit, skip, ptModes } = parseParamsRestrictions(doc, serviceTag, config);

      const params = {
        limit,
        skip
      };
      let path = '/all';

      if(queryNodes(doc, [serviceTag, 'PlaceRef']).length > 0) {

        const stopId = queryTags(doc, [serviceTag,'PlaceRef','StopPlaceRef']);

        const pointId = queryTags(doc, [serviceTag,'PlaceRef','StopPointRef']);

        const LocationName = queryTags(doc, [serviceTag,'PlaceRef','LocationName','Text']);

        if(LocationName) {
          path = `/searchByName/${encodeURIComponent(LocationName)}`;
        }
        else if(stopId) {
          path = `/searchByNetexId/${stopId}`;
        }
        else if(pointId) {
          path = `/searchByNetexId/${pointId}`;
        }
      }
      else if(queryNodes(doc, [serviceTag, 'InitialInput']).length > 0) {

        const LocationName = queryTags(doc, [serviceTag,'InitialInput','LocationName']);

        const geoRestriction = queryNode(doc, [serviceTag,'InitialInput','GeoRestriction']);

        //if(LocationName) {
        path = `/searchByName/${encodeURIComponent(LocationName)}`;

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

        const geoPositionLat = queryTags(doc, [serviceTag,'InitialInput','GeoPosition','Latitude'])
            , geoPositionLon = queryTags(doc, [serviceTag,'InitialInput','GeoPosition','Longitude']);

        if(geoPositionLat != null && geoPositionLon != null) {
          params.position = [geoPositionLon, geoPositionLat].join(',');
        }

      }
      else if(queryNodes(doc, [serviceTag]).length > 0) {
        path = '/all';  //return all points
      }
      else {
        return createErrorResponse(serviceName, config.errors.notagcondition, startTime);
      }

      const querystr = qstr.stringify(params)
          , options = {
            host: config['ep-manager'].host,
            port: config['ep-manager'].port,
            path: `${path}?${querystr}`,          
            method: 'GET',
            json: true
          };
      
      const response = await doRequest(options);

      return createResponse(config, response, startTime, ptModes, skip, limit);
      
    }
    catch(err){
      logger.error(err);
      return createErrorResponse(serviceName, config.errors.noparsing, startTime);
    }
    
  }
}