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
        mode.ele('siri:BusSubmode', 'unknown')
      }
      if(stop['MainMode'].toLowerCase() === '~train~'){
        mode.ele('ojp:PtMode', 'RAIL');
        mode.ele('siri:RailSubmode', 'unknown')
      }
    }
  }

  if(stops.length === 0){
    const err = location.ele('siri:ErrorCondition');
    err.ele('siri:OtherError')
    err.ele('siri:Description', 'LOCATION_NORESULTS');
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
          path = `/searchByName/${LocationName}`;
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

        if(geoRestriction) {
          
          logger.debug('GeoRestriction',geoRestriction);

          /* TODO const rect = queryNode(doc, "//*[name()=serviceTag]/*[name()='ojp:InitialInput']/*[name()='ojp:GeoRestriction']/*[name()='ojp:Rectangle']");
            const circle = queryNode(doc, "//*[name()=serviceTag]/*[name()='ojp:InitialInput']/*[name()='ojp:GeoRestriction']/*[name()='ojp:Circle']");
            
            let data = null;
            const params = {
              value: LocationName,
              position: [locationPositionLon, locationPositionLat],
              limit: limit
            };

            if(rect){
              const path = "//*[name()=serviceTag]/*[name()='ojp:InitialInput']/*[name()='ojp:GeoRestriction']/*[name()='ojp:Rectangle']"
              const upperLat = queryText(doc, path+"/*[name()='ojp:UpperLeft']/*[name()=Latitude]");
              const upperLon = queryText(doc, path+"/*[name()='ojp:UpperLeft']/*[name()=Logitude]");

              const lowerLat = queryText(doc, path+"/*[name()='ojp:LowerRight']/*[name()=Latitude]");
              const lowerLon = queryText(doc, path+"/*[name()='ojp:LowerRight']/*[name()=Logitude]");

              //TODO check values and check if value maybe are expressed inside a Coordinates element

              params.restrictionType = 'bbox';
              params.restrictionValue= [[upperLon, upperLat],[lowerLon, lowerLat]];

            }else if(circle){
              const path = "//*[name()=serviceTag]/*[name()='ojp:InitialInput']/*[name()='ojp:GeoRestriction']/*[name()='ojp:Circle']"
              const centerLat = queryText(doc, path+"/*[name()='ojp:Center']/*[name()=Latitude]");
              const centerLon = queryText(doc, path+"/*[name()='ojp:Center']/*[name()=Logitude]");

              //TODO check if value maybe are expressed inside a Coordinates element

              const radius = queryText(doc, path+"/*[name()='ojp:Radius']");
              params.restrictionType = 'circle';
              params.restrictionValue= [centerLon, centerLat, radius];
            }else{
              throw new Error('Unrecognize Restriction');
            }
          */
        }

        if(LocationName) {
          path = `/searchByName/${LocationName}`;
        }
        else {
          path = '/';
        }
      }
      else if(queryNodes(doc, [serviceTag]).length > 0) {
        path = '/';  //return all points
      }
      else {
        return createExchangePointsErrorResponse('E0001', startTime);
      }

      const querystr = qstr.stringify({limit, skip})
          , options = {
            host: config['ep-manager'].host,
            port: config['ep-manager'].port,
            path: `${path}?${querystr}`,          
            method: 'GET',
            json: true
          };

      logger.debug(options);
      
      const response = await doRequest(options);

      return createExchangePointsResponse(response, startTime, ptModes === 'true');
      
    }catch(err){
      logger.error(err);
      return createExchangePointsErrorResponse('E0002', startTime);
    }
    
  }
}