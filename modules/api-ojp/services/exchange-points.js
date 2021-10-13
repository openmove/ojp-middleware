const xmlbuilder = require('xmlbuilder');
const qstr = require('querystring');
const _ = require('lodash');

const {queryNode, queryNodes, queryText, queryTags} = require('../lib/query');
const {doRequest} = require('../lib/request');
const {parseParamsRestrictions} = require('../lib/restrictions');

const createExchangePointsResponse = (stops, startTime, ptModes) => {
  const responseTimestamp = new Date().toISOString();
  const calcTime = (new Date().getTime()) - startTime
  const location = xmlbuilder.create('ojp:OJPExchangePointsDelivery');
  location.ele('siri:ResponseTimestamp', responseTimestamp);
  location.ele('siri:Status', stops.length === 0 ? false : true);
  location.ele('ojp:CalcTime', calcTime);

  for(const stop of stops){
    const loc = location.ele('ojp:Location')
    const place = loc.ele('ojp:Location');
    const stopPlace = place.ele('ojp:StopPlace');
    stopPlace.ele('ojp:StopPlaceRef', stop['NeTExId']);
    stopPlace.ele('ojp:StopPlaceName').ele('ojp:Text', `${stop.Name}`);
    stopPlace.ele('ojp:TopographicPlaceRef', stop.zoneId);
    place.ele('ojp:LocationName').ele('ojp:Text', `${stop.Name}`);
    const geo = place.ele('ojp:GeoPosition');
    geo.ele('siri:Longitude', Number(stop['long']));
    geo.ele('siri:Latitude', Number(stop['lat']));
    loc.ele('ojp:Complete', true);
    loc.ele('ojp:Probability', 1 / stops.length);
    if(ptModes === true) {

      const mode = loc.ele('ojp:Mode');
      
      if(stop['MainMode'].toLowerCase() === '~bus~'){
        mode.ele('ojp:PtMode', 'BUS');
      }
      if(stop['MainMode'].toLowerCase() === '~train~'){
        mode.ele('ojp:PtMode', 'RAIL');
      }
    }
  }

  if(stops.length === 0){
    const err = location.ele('siri:ErrorCondition');
    err.ele('siri:OtherError')
    err.ele('siri:Description', 'EXCHANGEPOINTS_NO_RESULTS');
  }

  return location;
}

const createExchangePointsErrorResponse = (errorCode, startTime) => {
  const responseTimestamp = new Date().toISOString();
  const calcTime = (new Date().getTime()) - startTime
  const location = xmlbuilder.create('ojp:OJPExchangePointsDelivery');
  location.ele('siri:ResponseTimestamp', responseTimestamp);
  location.ele('siri:Status', false);
  location.ele('ojp:CalcTime', calcTime);

  const err = location.ele('siri:ErrorCondition');
  err.ele('siri:OtherError')
  err.ele('siri:Description', errorCode);

  return location;
}

module.exports = {
  'exchangePointsExecution' : async (doc, startTime, config) => {
    
    const serviceTag = 'ojp:OJPExchangePointsRequest';

    const {logger} = config;
    
    try{

      const { limit, skip, ptModes } = parseParamsRestrictions(doc, serviceTag);

      const params = {
        limit,
        skip
      };
      let path = '/';

      if(queryNodes(doc, [serviceTag, 'ojp:PlaceRef']).length > 0) {

        const stopId = queryTags(doc, [
          serviceTag,
          'ojp:PlaceRef',
          'ojp:StopPlaceRef'
        ]);
        const pointId = queryTags(doc, [
          serviceTag,
          'ojp:PlaceRef',
          'ojp:StopPointRef'
        ]);
        const LocationName = queryTags(doc, [
          serviceTag,
          'ojp:PlaceRef',
          'ojp:LocationName',
          'ojp:Text'
        ]);

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

        const LocationName = queryTags(doc, [
          serviceTag,
          'ojp:InitialInput',
          'ojp:LocationName'
        ]);

        const locationPositionLat = queryTags(doc, [
          serviceTag,
          'ojp:InitialInput',
          'ojp:GeoPosition',
          'Latitude'
        ]);
        
        const locationPositionLon = queryTags(doc, [
          serviceTag,
          'ojp:InitialInput',
          'ojp:GeoPosition',
          'Longitude'
        ]);
        
        const geoRestriction = queryNode(doc, [
          serviceTag,
          'ojp:InitialInput',
          'ojp:GeoRestriction'
        ]);

        //if(LocationName) {
          path = `/searchByName/${encodeURIComponent(LocationName)}`;

        if(geoRestriction) {
          
          logger.debug('GeoRestriction',geoRestriction);

            const rect = queryNode(doc, [
              serviceTag,
              'ojp:InitialInput',
              'ojp:GeoRestriction',
              'ojp:Rectangle'
            ]);

            const circle = queryNode(doc, [
              serviceTag,
              'ojp:InitialInput',
              'ojp:GeoRestriction',
              'ojp:Circle'
            ]);

            if(rect) {

              const upperLat = queryTags(doc, [
                serviceTag,
                'ojp:InitialInput',
                'ojp:GeoRestriction',
                'ojp:Rectangle',
                'ojp:UpperLeft',
                'Latitude'
              ]);
              const upperLon = queryTags(doc, [
                serviceTag,
                'ojp:InitialInput',
                'ojp:GeoRestriction',
                'ojp:Rectangle',
                'ojp:UpperLeft',
                'Longitude'
              ]);
              const lowerLat = queryTags(doc, [
                serviceTag,
                'ojp:InitialInput',
                'ojp:GeoRestriction',
                'ojp:Rectangle',
                'ojp:LowerRight',
                'Latitude'
              ]);
              const lowerLon = queryTags(doc, [
                serviceTag,
                'ojp:InitialInput',
                'ojp:GeoRestriction',
                'ojp:Rectangle',
                'ojp:LowerRight',
                'Longitude'
              ]);

              params.restrictionType = 'bbox';
              params.restrictionValue = [upperLon, upperLat,lowerLon, lowerLat].join(',');

            }
            else if(circle) {
              const centerLat = queryTags(doc, [
                serviceTag,
                'ojp:InitialInput',
                'ojp:GeoRestriction',
                'ojp:Circle',
                'ojp:Center',
                'Latitude'
              ]);
              const centerLon = queryTags(doc, [
                serviceTag,
                'ojp:InitialInput',
                'ojp:GeoRestriction',
                'ojp:Circle',
                'ojp:Center',
                'Longitude'
              ]);
              const radius = queryTags(doc, [
                serviceTag,
                'ojp:InitialInput',
                'ojp:GeoRestriction',
                'ojp:Circle',
                'ojp:Radius'
              ]);

              params.restrictionType = 'circle';
              params.restrictionValue = [centerLon, centerLat, radius].join(',');

            }else{
              throw new Error('Unrecognize Restriction');
            }
        }
      }
      else if(queryNodes(doc, [serviceTag]).length > 0) {
        path = '/';  //return all points
      }
      else {
        return createExchangePointsErrorResponse('E0001', startTime);
      }

      const querystr = qstr.stringify(params)
          , options = {
            host: config['ep-manager'].host,
            port: config['ep-manager'].port,
            path: `${path}?${querystr}`,          
            method: 'GET',
            json: true
          };

      console.log(options);
      
      const response = await doRequest(options);

      return createExchangePointsResponse(response, startTime, ptModes);
      
    }catch(err){
      logger.error(err);
      return createExchangePointsErrorResponse('E0002', startTime);
    }
    
  }
}