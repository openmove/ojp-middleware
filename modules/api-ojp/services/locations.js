const xmlbuilder = require('xmlbuilder');

const {queryNode, queryNodes, queryText, queryTags} = require('../lib/query');
const {doRequest} = require('../lib/request');

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
      if(stop.vehicleMode === 'BUS'){
        mode.ele('siri:BusSubmode', 'unknown')
      }
      if(stop.vehicleMode === 'RAIL'){
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
    
    const {logger} = config;
    
    try {

      const ptModes = queryTags(doc, [
        'ojp:OJPLocationInformationRequest',
        'ojp:Restrictions',
        'ojp:IncludePtModes'
      ]);

      let limitRestrictions = queryTags(doc, [
        'ojp:OJPLocationInformationRequest',
        'ojp:Restrictions',
        'ojp:NumberOfResults'
      ]);

      let limitParams = queryTags(doc, [
        'ojp:OJPLocationInformationRequest',
        'ojp:Params',
        'ojp:NumberOfResults'
      ]);

      let limit = limitRestrictions || limitParams || 5;

      if(queryNodes(doc, "//*[name()='ojp:OJPLocationInformationRequest']/*[name()='ojp:PlaceRef']").length > 0){

        const stopName = queryTags(doc, [
          'ojp:OJPLocationInformationRequest',
          'ojp:PlaceRef',
          'ojp:StopPlaceRef'
        ]);

        const locationName = queryTags(doc, [
          'ojp:OJPLocationInformationRequest',
          'ojp:PlaceRef',
          'ojp:LocationName',
          'ojp:Text'
        ]);

        const text = stopName || locationName || '';

        const options = {
          host: config['api-otp'].host,
          port: config['api-otp'].port,
          path: `/stops/${text}?limit=${limit}`, //limit is not necessary in this case because we are looking for an ID.          
          method: 'GET',
          json: true
        };
        
        const response = await doRequest(options);

        return createLocationResponse(response.stops, startTime, ptModes === 'true');
      }
      else if(queryNodes(doc, "//*[name()='ojp:OJPLocationInformationRequest']/*[name()='ojp:InitialInput']").length > 0){

        const locationName = queryTags(doc, [
          'ojp:OJPLocationInformationRequest',
          'ojp:InitialInput',
          'ojp:LocationName'
        ]);

        //const locationPositionLat = queryText(doc, "//*[name()=]/*[name()=]/*[name()=]/*[name()=Latitude]"); 
        //const locationPositionLon = queryText(doc, "//*[name()='ojp:OJPLocationInformationRequest']/*[name()='ojp:InitialInput']/*[name()='ojp:GeoPosition']/*[name()=Longitude]"); 
        
        const locationPositionLat = queryTags(doc, [
          'ojp:OJPLocationInformationRequest',
          'ojp:InitialInput',
          'ojp:GeoPosition',
          'Latitude'
        ]);
        
        const locationPositionLon = queryTags(doc, [
          'ojp:OJPLocationInformationRequest',
          'ojp:InitialInput',
          'ojp:GeoPosition',
          'Longitude'
        ]);

        let data = null;
        const params = {
          value: locationName,
          position: [locationPositionLon, locationPositionLat],
          limit: limit
        };
        
        const restriction = queryNode(doc, "//*[name()='ojp:OJPLocationInformationRequest']/*[name()='ojp:InitialInput']/*[name()='ojp:GeoRestriction']");
  
        if(restriction){
          const rect = queryNode(doc, "//*[name()='ojp:OJPLocationInformationRequest']/*[name()='ojp:InitialInput']/*[name()='ojp:GeoRestriction']/*[name()='ojp:Rectangle']");
          const circle = queryNode(doc, "//*[name()='ojp:OJPLocationInformationRequest']/*[name()='ojp:InitialInput']/*[name()='ojp:GeoRestriction']/*[name()='ojp:Circle']");
          
          if(rect){
            const path = "//*[name()='ojp:OJPLocationInformationRequest']/*[name()='ojp:InitialInput']/*[name()='ojp:GeoRestriction']/*[name()='ojp:Rectangle']"
            const upperLat = queryText(doc, path+"/*[name()='ojp:UpperLeft']/*[name()=Latitude]");
            const upperLon = queryText(doc, path+"/*[name()='ojp:UpperLeft']/*[name()=Logitude]");

            const lowerLat = queryText(doc, path+"/*[name()='ojp:LowerRight']/*[name()=Latitude]");
            const lowerLon = queryText(doc, path+"/*[name()='ojp:LowerRight']/*[name()=Logitude]");

            //TODO check values and check if value maybe are expressed inside a Coordinates element

            params.restrictionType = 'bbox';
            params.restrictionValue= [[upperLon, upperLat],[lowerLon, lowerLat]];

          }else if(circle){
            const path = "//*[name()='ojp:OJPLocationInformationRequest']/*[name()='ojp:InitialInput']/*[name()='ojp:GeoRestriction']/*[name()='ojp:Circle']"
            const centerLat = queryText(doc, path+"/*[name()='ojp:Center']/*[name()=Latitude]");
            const centerLon = queryText(doc, path+"/*[name()='ojp:Center']/*[name()=Logitude]");

            //TODO check if value maybe are expressed inside a Coordinates element

            const radius = queryText(doc, path+"/*[name()='ojp:Radius']");
            params.restrictionType = 'circle';
            params.restrictionValue= [centerLon, centerLat, radius];
          }else{
            throw new Error('Unrecognize Restriction');
          }
        }

        if(locationName != null || (locationPositionLat != null && locationPositionLon != null) ){
          data = JSON.stringify(params);
        }

        const options = {
          host: config['api-otp'].host,
          port: config['api-otp'].port,
          path: `/search/`,
          json: true,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': data.length,
          }
        }
        const response = await doRequest(options, data);

        logger.info(response)
        return createLocationResponse(response.stops, startTime, ptModes === 'true');
      }else{
        return createLocationErrorResponse('E0001', startTime);
      }
    }catch(err){
      logger.error(err);
      return createLocationErrorResponse('E0002', startTime);
    }
    
  }
}