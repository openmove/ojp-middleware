const xmlbuilder = require('xmlbuilder');
const qstr = require('querystring');
const _ = require('lodash');

const {queryNode, queryNodes, queryText, queryTags} = require('../lib/query');
const {doRequest} = require('../lib/request');
const {parseParamsRestrictions, parseGeoRestriction} = require('../lib/restrictions');
const {createErrorResponse, ptModesResponse} = require('../lib/response');

const serviceName = 'OJPExchangePoints';

const createResponse = (config, stops, startTime, ptModes, skip = 0, limit = null) => {

  const {location_digits} = config;

  const now = new Date()
    , tag = xmlbuilder.create(`ojp:${serviceName}Delivery`);
  tag.ele('siri:ResponseTimestamp', now.toISOString());
  tag.ele('siri:Status', stops.length === 0 ? false : true);

  tag.ele('ojp:CalcTime', now.getTime() - startTime);

  if ( limit !== null && limit === stops.length) {
    tag.ele('ojp:ContinueAt', skip + limit);
  }

  for(const stop of stops) {
    const loc = tag.ele('ojp:Place')
    const place = loc.ele('ojp:Place');
    const stopPlace = place.ele('ojp:StopPlace');
    stopPlace.ele('ojp:StopPlaceRef', stop['MetaID']);
    stopPlace.ele('ojp:StopPlaceName').ele('ojp:Text', `${stop.Name}`);
    const private = stopPlace.ele('ojp:PrivateCode');
    private.ele('ojp:System', 'LinkingAlps');
    private.ele('ojp:Value', stop['GlobalID'])
    stopPlace.ele('ojp:TopographicPlaceRef', stop.zoneId);
    place.ele('ojp:LocationName').ele('ojp:Text', `${stop.Name}`);

    const geo = place.ele('ojp:GeoPosition');
    geo.ele('siri:Longitude', _.round(stop['long'], location_digits) );
    geo.ele('siri:Latitude', _.round(stop['lat'], location_digits) );

    if(ptModes) {

      const mode = loc.ele('ojp:Mode');
      
      const ojpMode = ptModesResponse( stop['MainMode'] );

      mode.ele('ojp:PtMode', ojpMode);

     /* if(stop['MainMode'].toLowerCase() === '~bus~'){
        mode.ele('ojp:PtMode', 'BUS');
      }
      if(stop['MainMode'].toLowerCase() === '~train~'){
        mode.ele('ojp:PtMode', 'RAIL');
      }*/
    }
  }

  if(stops.length === 0){
    const err = tag.ele('siri:ErrorCondition');
    err.ele('siri:OtherError')
    err.ele('siri:Description', 'EXCHANGEPOINTS_NO_RESULTS');
  }

  return tag;
}

module.exports = {
  'exchangePointsExecution' : async (doc, startTime, config) => {
    
    const serviceTag = `ojp:${serviceName}Request`;

    const {logger} = config;
    
    try{

      const { limit, skip, ptModes } = parseParamsRestrictions(doc, serviceTag, config);

      const params = {
        limit,
        skip
      };
      let path = '/all';

      if(queryNodes(doc, [serviceTag, 'ojp:PlaceRef']).length > 0) {

        const stopId = queryTags(doc, [serviceTag,'ojp:PlaceRef','ojp:StopPlaceRef']);

        const pointId = queryTags(doc, [serviceTag,'ojp:PlaceRef','StopPointRef']);

        const LocationName = queryTags(doc, [serviceTag,'ojp:PlaceRef','ojp:LocationName','ojp:Text']);

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
      else if(queryNodes(doc, [serviceTag, 'ojp:InitialInput']).length > 0) {

        const LocationName = queryTags(doc, [serviceTag,'ojp:InitialInput','ojp:LocationName']);

        const geoRestriction = queryNode(doc, [serviceTag,'ojp:InitialInput','ojp:GeoRestriction']);

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

        const geoPositionLat = queryTags(doc, [serviceTag,'ojp:InitialInput','ojp:GeoPosition','Latitude'])
            , geoPositionLon = queryTags(doc, [serviceTag,'ojp:InitialInput','ojp:GeoPosition','Longitude']);

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