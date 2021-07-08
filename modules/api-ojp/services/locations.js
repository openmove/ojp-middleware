const xpath = require('xpath')
, http = require('http')
, dom = require('xmldom').DOMParser
, xmlbuilder = require('xmlbuilder')

const mapNS = {
  'siri' : 'http://www.siri.org.uk/siri',
  'ojp': 'http://www.vdv.de/ojp',
};

const queryNodes = (doc, path) => {
  const queryNS = xpath.useNamespaces(mapNS);
  const nodes = queryNS(path, doc);
  return nodes
}

const queryNode = (doc, path) => {
  const nodes = queryNodes(doc, path)
  if (nodes.length === 0) {
      return null;
  }

  return nodes[0]
}

const queryText = (doc, path) => {
  const queryNS = xpath.useNamespaces(mapNS);
  const node = queryNS(path, doc, true);
  if (!node) {
      return null;
  }

  const nodeText = node.textContent;

  return nodeText
}

const doRequest = (options, data) => {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      res.setEncoding('utf8');
      let responseBody = '';

      res.on('data', (chunk) => {
        responseBody += chunk;
      });

      res.on('end', () => {
        resolve(JSON.parse(responseBody));
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.write(data || '')
    req.end();
  });
}

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
  'locationExecution' : async (doc, startTime) => {
    try{
      if(queryNodes(doc, "//*[name()='ojp:OJPLocationInformationRequest']/*[name()='ojp:PlaceRef']").length > 0){
        const text = queryText(doc, "//*[name()='ojp:OJPLocationInformationRequest']/*[name()='ojp:PlaceRef']/*[name()='ojp:StopPlaceRef']"); 
        console.log(text);
        const ptModes = queryText(doc, "//*[name()='ojp:OJPLocationInformationRequest']/*[name()='ojp:Restrictions/*[name()=ojp:IncludePtModes]']");
        const limit = queryText(doc, "//*[name()='ojp:OJPLocationInformationRequest']/*[name()='ojp:Restrictions/*[name()=ojp:NumberOfResults]']");
        const options = {
          host: `localhost`, //from environment variable
          path: `/stops/${text || ''}?limit=${limit || 5}`, //limit is not necessary in this case because we are looking for an ID.
          port: 8090, //from environment variable
          method: 'GET',
          json:true
        };
        const response = await doRequest(options)   
        return createLocationResponse(response.stops, startTime, ptModes === 'true');
      } else if(queryNodes(doc, "//*[name()='ojp:OJPLocationInformationRequest']/*[name()='ojp:InitialInput']").length > 0){
        const locationName = queryText(doc, "//*[name()='ojp:OJPLocationInformationRequest']/*[name()='ojp:InitialInput']/*[name()='ojp:LocationName']"); 
        const locationPositionLat = queryText(doc, "//*[name()='ojp:OJPLocationInformationRequest']/*[name()='ojp:InitialInput']/*[name()='ojp:GeoPosition']/*[name()=Latitude]"); 
        const locationPositionLon = queryText(doc, "//*[name()='ojp:OJPLocationInformationRequest']/*[name()='ojp:InitialInput']/*[name()='ojp:GeoPosition']/*[name()=Longitude]"); 
        
        const ptModes = queryText(doc, "//*[name()='ojp:OJPLocationInformationRequest']/*[name()='ojp:Restrictions']/*[name()='ojp:IncludePtModes']");
        const limit = queryText(doc, "//*[name()='ojp:OJPLocationInformationRequest']/*[name()='ojp:Restrictions']/*[name()='ojp:NumberOfResults']");
  
        
        let data = null;
        const params = {
          value: locationName,
          position: [locationPositionLon, locationPositionLat],
          limit: Number(limit) || 5
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
          host: `localhost`, //from environment variable
          path: `/search/`,
          port: 8090, //from environment variable
          json:true,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': data.length,
          }
        }
        const response = await doRequest(options, data)   
        console.log(response)
        return createLocationResponse(response.stops, startTime, ptModes === 'true');
      }else{
        return createLocationErrorResponse('E0001', startTime);
      }
    }catch(err){
      console.log(err);
      return createLocationErrorResponse('E0002', startTime);
    }
    
  }
}