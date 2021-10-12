const xmlbuilder = require('xmlbuilder');
const qstr = require('querystring');
const _ = require('lodash');

const {queryNode, queryNodes, queryText, queryTags} = require('../lib/query');
const {doRequest} = require('../lib/request');
const {parseParamsRestrictions} = require('../lib/restrictions');

const createLocationResponse = (stops, startTime, ptModes) => {
  const responseTimestamp = new Date().toISOString();
  const calcTime = (new Date().getTime()) - startTime
  const location = xmlbuilder.create('ojp:OJPLocationInformationDelivery');
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
    loc.ele('ojp:Probability', 1 / stops.length); //TODO: other criteria?
    if(ptModes === true){
      const mode = loc.ele('ojp:Mode');
      mode.ele('ojp:PtMode', stop.vehicleMode.toLowerCase());
    }
  }

  if(stops.length === 0){
    const err = location.ele('siri:ErrorCondition');
    err.ele('siri:OtherError')
    err.ele('siri:Description', 'LOCATION_NORESULTS');
  }

  return location;
}

const createLocationErrorResponse = (errorCode, startTime) => {
  const responseTimestamp = new Date().toISOString();
  const calcTime = (new Date().getTime()) - startTime
  const location = xmlbuilder.create('ojp:OJPLocationInformationDelivery');
  location.ele('siri:ResponseTimestamp', responseTimestamp);
  location.ele('siri:Status', false);
  location.ele('ojp:CalcTime', calcTime);

  const err = location.ele('siri:ErrorCondition');
  err.ele('siri:OtherError')
  err.ele('siri:Description', errorCode);

  return location;
}

module.exports = {
  'locationExecution' : async (doc, startTime, config) => {
    
    const serviceTag = 'ojp:OJPLocationInformationRequest';

    const {logger} = config;
    
    try {

      const { limit, skip, ptModes } = parseParamsRestrictions(doc, serviceTag);

      if(queryNodes(doc, [serviceTag,'ojp:PlaceRef']).length > 0) {

        const stopId = queryTags(doc, [
          serviceTag,
          'ojp:PlaceRef',
          'ojp:StopPlaceRef'
        ]);

        const locationName = queryTags(doc, [
          serviceTag,
          'ojp:PlaceRef',
          'ojp:LocationName',
          'ojp:Text'
        ]);

        if (stopId) {

          const querystr = qstr.stringify({limit/*, skip*/})
              , options = {
                host: config['api-otp'].host,
                port: config['api-otp'].port,
                path: `/stops/${stopId}?${querystr}`, //limit is not necessary in this case because we are looking for an ID.
                method: 'GET',
                json: true
              };
          const response = await doRequest(options);
        }

        if (locationName) {
          const name = encodeURIComponent(locationName || '');

          const json = JSON.stringify({value: name});

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
        }

        const stops = _.slice(response.stops, skip, limit);

        return createLocationResponse(stops, startTime, ptModes);
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

        const params = {
          value: LocationName,
          limit: limit
        };
        
        let json = JSON.stringify(params);

        const geoRestriction = queryNode(doc, [
          serviceTag,
          'ojp:InitialInput',
          'ojp:GeoRestriction'
        ]);
  
        if(geoRestriction){
          const rect = queryNode(doc, `//*[name()='${serviceTag}']/*[name()='ojp:InitialInput']/*[name()='ojp:GeoRestriction']/*[name()='ojp:Rectangle']`);
          const circle = queryNode(doc, `//*[name()='${serviceTag}']/*[name()='ojp:InitialInput']/*[name()='ojp:GeoRestriction']/*[name()='ojp:Circle']`);
          
          if(rect){
            const path = `//*[name()='${serviceTag}']/*[name()='ojp:InitialInput']/*[name()='ojp:GeoRestriction']/*[name()='ojp:Rectangle']`;
            const upperLat = queryText(doc, path+"/*[name()='ojp:UpperLeft']/*[name()=Latitude]");
            const upperLon = queryText(doc, path+"/*[name()='ojp:UpperLeft']/*[name()=Logitude]");

            const lowerLat = queryText(doc, path+"/*[name()='ojp:LowerRight']/*[name()=Latitude]");
            const lowerLon = queryText(doc, path+"/*[name()='ojp:LowerRight']/*[name()=Logitude]");

            //TODO check values and check if value maybe are expressed inside a Coordinates element

            params.restrictionType = 'bbox';
            params.restrictionValue= [[upperLon, upperLat],[lowerLon, lowerLat]];

          }else if(circle){
            const path = `//*[name()='${serviceTag}']/*[name()='ojp:InitialInput']/*[name()='ojp:GeoRestriction']/*[name()='ojp:Circle']`;            const centerLat = queryText(doc, path+"/*[name()='ojp:Center']/*[name()=Latitude]");
            const centerLon = queryText(doc, path+"/*[name()='ojp:Center']/*[name()=Logitude]");

            //TODO check if value maybe are expressed inside a Coordinates element

            const radius = queryText(doc, path+"/*[name()='ojp:Radius']");
            params.restrictionType = 'circle';
            params.restrictionValue= [centerLon, centerLat, radius];
          }else{
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

        //console.log('POST PARAMS',params, json)

        //logger.info(response)
        return createLocationResponse(stops, startTime, ptModes);
      }
      else{
        return createLocationErrorResponse('E0001', startTime);
      }
    }catch(err){
      logger.error(err);
      return createLocationErrorResponse('E0002', startTime);
    }
    
  }
}