const xpath = require('xpath')
, http = require('http')
, dom = require('xmldom').DOMParser
, xmlbuilder = require('xmlbuilder')
, moment = require('moment-timezone')
, { v4: uuidv4 } = require('uuid');

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

const createEventResponse = (stop, startTime, isDeparture, isArrival, realtimeData) => {
  const responseTimestamp = new Date().toISOString();
  const calcTime = (new Date().getTime()) - startTime
  const event = xmlbuilder.create('ojp:OJPStopEventDelivery');
  event.ele('siri:ResponseTimestamp', responseTimestamp);
  
  event.ele('ojp:CalcTime', calcTime);
  
  if(stop === null || stop.stoptimesWithoutPatterns.length === 0){
    event.ele('siri:Status', false);
    const err = event.ele('siri:ErrorCondition');
    err.ele('siri:OtherError')
    err.ele('siri:Description', 'STOPEVENT_LOCATIONUNSERVED');
  } else {
    event.ele('siri:Status', true);
    const context = event.ele('ojp:StopEventResponseContext');
    const loc = context.ele('ojp:Places');
    const place = loc.ele('ojp:Location');
    const stopPlace = place.ele('ojp:StopPlace');
    stopPlace.ele('ojp:StopPlaceRef', stop.gtfsId);
    stopPlace.ele('ojp:StopPlaceName').ele('ojp:Text', `${stop.name}`);
    stopPlace.ele('ojp:TopographicPlaceRef', stop.zoneId);
    place.ele('ojp:LocationName').ele('ojp:Text', `${stop.name}`);
    const geo = place.ele('ojp:GeoPosition');
    geo.ele('siri:Longitude', stop.lon);
    geo.ele('siri:Latitude', stop.lat);
    for(const schedule of stop.stoptimesWithoutPatterns){
      const eventresponse = event.ele('ojp:StopEventResult');
      eventresponse.ele('ojp:ResultId', uuidv4())
      const stopevent = eventresponse.ele('ojp:StopEvent');
      const call = stopevent.ele('ojp:ThisCall').ele('ojp:CallAtStop');
      call.ele('siri:StopPointRef', stop.gtfsId);
      call.ele('ojp:StopPointName').ele('ojp:Text', `${stop.name}`);
      if(isDeparture){
        const dep = call.ele('ojp:ServiceDeparture');
        dep.ele('ojp:TimetabledTime', moment((schedule.serviceDay + schedule.scheduledDeparture) * 1000).tz(schedule.trip.route.agency.timezone).toISOString());
        if(realtimeData){
          dep.ele('ojp:EstimatedTime', moment((schedule.serviceDay + schedule.realtimeDeparture) * 1000).tz(schedule.trip.route.agency.timezone).toISOString());
        }
      }
      
      if(isArrival){
        const arr = call.ele('ojp:ServiceArrival');
        arr.ele('ojp:TimetabledTime', moment((schedule.serviceDay + schedule.scheduledArrival) * 1000).tz(schedule.trip.route.agency.timezone).toISOString());
        if(realtimeData){
          arr.ele('ojp:EstimatedTime', moment((schedule.serviceDay + schedule.realtimeArrival) * 1000).tz(schedule.trip.route.agency.timezone).toISOString());
        }
      }
      call.ele('ojp:Order', schedule.stopSequence)        
      const service = stopevent.ele('ojp:Service');
      service.ele('ojp:OperatingDayRef', moment(schedule.serviceDay * 1000).tz(schedule.trip.route.agency.timezone).format("YYYY-MM-DD"));
      service.ele('ojp:JourneyRef', schedule.trip.gtfsId);
      service.ele('siri:LineRef', schedule.trip.route.gtfsId);
      const mode = service.ele('ojp:Mode');
      mode.ele('ojp:PtMode', stop.vehicleMode.toLowerCase());
      if(schedule.trip.route.mode === 'BUS'){
        mode.ele('siri:BusSubmode', 'unknown')
      }
      if(schedule.trip.route.mode === 'RAIL'){
        mode.ele('siri:RailSubmode', 'unknown')
      }
      service.ele('siri:DirectionRef', schedule.trip.directionId);
      service.ele('ojp:PublishedLineName').ele('ojp:Text', schedule.trip.route.longName || schedule.trip.route.shortName || schedule.trip.route.gtfsId)
      service.ele('ojp:OperatorRef', schedule.trip.route.agency.gtfsId);
      service.ele('ojp:OriginStopPointRef', schedule.trip.departureStoptime.stop.gtfsId);
      service.ele('ojp:OriginText').ele('ojp:Text', `${schedule.trip.departureStoptime.stop.name}`);
      service.ele('ojp:DestinationStopPointRef', schedule.trip.arrivalStoptime.stop.gtfsId);
      service.ele('ojp:DestinationText').ele('ojp:Text', `${schedule.trip.arrivalStoptime.stop.name}`);
    }
  }

  return event;
}

const createEventErrorResponse = (errorCode, startTime) => {
  const responseTimestamp = new Date().toISOString();
  const calcTime = (new Date().getTime()) - startTime
  const event = xmlbuilder.create('ojp:OJPStopEventDelivery');
  event.ele('siri:ResponseTimestamp', responseTimestamp);
  event.ele('siri:Status', false);
  event.ele('ojp:CalcTime', calcTime);

  const err = event.ele('siri:ErrorCondition');
  err.ele('siri:OtherError')
  err.ele('siri:Description', errorCode);

  return event;
}

module.exports = {
  'eventExecution' : async (doc, startTime) => {
    try{
      if(queryNodes(doc, "//*[name()='ojp:OJPStopEventRequest']/*[name()='ojp:Location']/*[name()='ojp:PlaceRef']").length > 0){
        const text = queryText(doc, "//*[name()='ojp:OJPStopEventRequest']/*[name()='ojp:Location']/*[name()='ojp:PlaceRef']/*[name()='ojp:StopPlaceRef']"); 
        console.log(text);
        const date = queryText(doc, "//*[name()='ojp:OJPStopEventRequest']/*[name()='ojp:Location']/*[name()='ojp:DepArrTime']");
        const limit = queryText(doc, "//*[name()='ojp:OJPStopEventRequest']/*[name()='ojp:Params']/*[name()='ojp:NumberOfResults']");
        console.log(limit);
        console.log(date);
        let startDate = new Date().getTime();
        if(date != null){
          startDate = new Date(date).getTime();
        }
        
        const options = {
          host: `localhost`, //from environment variable
          path: `/stops/${text}/details?limit=${Number(limit) || 5}&start=${startDate}`,
          port: 8090, //from environment variable
          method: 'GET',
          json:true
        };
        console.log(options);
        const response = await doRequest(options);
        
        let isDeparture = true;
        let isArrival = false;
        let showRealtime = false;
        const eventType = queryText(doc, "//*[name()='ojp:OJPStopEventRequest']/*[name()='ojp:Params']/*[name()='ojp:StopEventType']");
        const realtime = queryText(doc, "//*[name()='ojp:OJPStopEventRequest']/*[name()='ojp:Params']/*[name()='ojp:IncludeRealtimeData']");
        if(eventType === 'arrival'){
          isDeparture = false;
          isArrival = true;
        }

        if(eventType === 'both'){
          isDeparture = true;
          isArrival = true;
        }
        showRealtime = realtime === 'true';
        return createEventResponse(response.stop, startTime, isDeparture, isArrival, showRealtime);
      }else{
        return createEventErrorResponse('E0001', startTime);
      }
    }catch(err){
      console.log(err);
      return createEventErrorResponse('E0002', startTime);
    }
    
  }
}