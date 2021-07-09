const { time } = require('console');
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
  //console.log(data);
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

const createTripResponse = (itineraries, startTime, showIntermediates) => {
  const responseTimestamp = new Date().toISOString();
  const calcTime = (new Date().getTime()) - startTime
  const trips = xmlbuilder.create('ojp:OJPTripDelivery');
  trips.ele('siri:ResponseTimestamp', responseTimestamp);
  
  trips.ele('ojp:CalcTime', calcTime);


  if(itineraries === null || itineraries.length === 0){
    trips.ele('siri:Status', false);
    const err = trip.ele('siri:ErrorCondition');
    err.ele('siri:OtherError')
    err.ele('siri:Description', 'TRIP_NOTRIPFOUND');
  } else {
    trips.ele('siri:Status', true);
    const context = trips.ele('ojp:TripResponseContext');
    const stops = [];
    for(const itinerary of itineraries){
      const tripresponse = trips.ele('ojp:TripResult');
      const tripId = uuidv4();
      tripresponse.ele('ojp:ResultId', tripId)
      const trip = tripresponse.ele('ojp:Trip');
      trip.ele('ojp:TripId', tripId);
      trip.ele('ojp:StartTime', moment(itinerary.startTime).toISOString());
      trip.ele('ojp:EndTime', moment(itinerary.endTime).toISOString());
      trip.ele('ojp:Duration', moment.duration(itinerary.duration, 's').toISOString() )
      let tripDistance = 0;
      let tripTransfers = 0;
      let legId = 0;
      for(const leg of itinerary.legs){
        legId += 1
        const tripLeg = trip.ele('ojp:TripLeg');
        tripLeg.ele('ojp:LegId', legId);
        tripDistance += leg.distance;
        if(leg.transitLeg === false){
          if(leg.mode === 'WALK'){
            const transferLeg = tripLeg.ele('ojp:TransferLeg');
            transferLeg.ele('ojp:TransferMode', 'walk');
            const legStart = transferLeg.ele('ojp:LegStart');
            legStart.ele('ojp:LocationName').ele('ojp:Text', `${leg.from.name}`);
            if(leg.from.stop){
              legStart.ele('siri:StopPointRef', leg.from.stop.gtfsId);
            }
            const legEnd = transferLeg.ele('ojp:LegEnd');
            legEnd.ele('ojp:LocationName').ele('ojp:Text', `${leg.to.name}`);
            if(leg.to.stop){
              legEnd.ele('siri:StopPointRef', leg.to.stop.gtfsId);
            }
            transferLeg.ele('ojp:TimeWindowStart', moment(leg.startTime).toISOString());
            transferLeg.ele('ojp:TimeWindowEnd', moment(leg.endTime).toISOString());
            transferLeg.ele('ojp:Duration', moment.duration(leg.duration, 's').toISOString());
            transferLeg.ele('ojp:WalkDuration', moment.duration(leg.duration, 's').toISOString())
          }          
        }else{
          tripTransfers += 1;
          let sequence = 1;
          const timedLeg = tripLeg.ele('ojp:TimedLeg');
          const board = timedLeg.ele('ojp:LegBoard');
          board.ele('ojp:StopPointName').ele('ojp:Text', `${leg.from.name}`);
          if(leg.from.stop){
            stops.push(leg.from.stop);
            board.ele('siri:StopPointRef', leg.from.stop.gtfsId);
          }
          const serviceFrom = board.ele('ojp:ServiceDeparture');
          serviceFrom.ele('ojp:TimetabledTime', moment(leg.startTime).toISOString())
          serviceFrom.ele('ojp:EstimatedTime', moment(leg.startTime - leg.departureDelay).toISOString())
          board.ele('ojp:Order', 1);
          for(const intermediatePoint of leg.intermediatePlaces){
            sequence += 1;
            if(showIntermediates){
              const intermediate = timedLeg.ele('ojp:LegIntermediates')
              intermediate.ele('ojp:StopPointName').ele('ojp:Text', `${intermediatePoint.name}`);
              if(intermediatePoint.stop){
                stops.push(intermediatePoint.stop);
                intermediate.ele('siri:StopPointRef', leg.from.stop.gtfsId);
              }
              const serviceIntermediateDep = intermediate.ele('ojp:ServiceDeparture');
              serviceIntermediateDep.ele('ojp:TimetabledTime', moment(intermediatePoint.departureTime).toISOString())
              serviceIntermediateDep.ele('ojp:EstimatedTime', moment(intermediatePoint.departureTime - leg.departureDelay).toISOString())
              const serviceIntermediateArr = intermediate.ele('ojp:ServiceArrival');
              serviceIntermediateArr.ele('ojp:TimetabledTime', moment(intermediatePoint.arrivalTime).toISOString())
              serviceIntermediateArr.ele('ojp:EstimatedTime', moment(intermediatePoint.arrivalTime - leg.departureDelay).toISOString())
              intermediate.ele('ojp:Order', sequence);
            }            
          }

          const alight = timedLeg.ele('ojp:LegAlight');
          alight.ele('ojp:StopPointName').ele('ojp:Text', `${leg.to.name}`);
          
          if(leg.to.stop){
            alight.ele('siri:StopPointRef', leg.to.stop.gtfsId);
            stops.push(leg.to.stop);
          }
          const serviceTo = alight.ele('ojp:ServiceDeparture');
          serviceTo.ele('ojp:TimetabledTime', moment(leg.endTime).toISOString())
          serviceTo.ele('ojp:EstimatedTime', moment(leg.endTime - leg.arrivalDelay).toISOString())
          alight.ele('ojp:Order', sequence+1);

          

          const service = timedLeg.ele('ojp:Service');
          service.ele('ojp:OperatingDayRef', moment(leg.serviceDate).tz(leg.route.agency.timezone).format("YYYY-MM-DD"));
          service.ele('ojp:JourneyRef', leg.trip.gtfsId);
          service.ele('siri:LineRef', leg.route.gtfsId);
          const mode = service.ele('ojp:Mode');
          mode.ele('ojp:PtMode', leg.mode.toLowerCase());
          if(leg.mode === 'BUS'){
            mode.ele('siri:BusSubmode', 'unknown')
          }
          if(leg.mode === 'RAIL'){
            mode.ele('siri:RailSubmode', 'unknown')
          }
          service.ele('siri:DirectionRef', leg.trip.directionId);
          service.ele('ojp:PublishedLineName').ele('ojp:Text', leg.route.longName || leg.route.shortName || leg.route.gtfsId)
          service.ele('ojp:OperatorRef', leg.route.agency.gtfsId);
          service.ele('ojp:OriginStopPointRef', leg.trip.departureStoptime.stop.gtfsId);
          stops.push(leg.trip.departureStoptime.stop);
          service.ele('ojp:OriginText').ele('ojp:Text', `${leg.trip.departureStoptime.stop.name}`);
          service.ele('ojp:DestinationStopPointRef', leg.trip.arrivalStoptime.stop.gtfsId);
          stops.push(leg.trip.arrivalStoptime.stop);
          service.ele('ojp:DestinationText').ele('ojp:Text', `${leg.trip.arrivalStoptime.stop.name}`);
        }
      }
      trip.ele('ojp:Distance', tripDistance.toFixed(0)); 
      trip.ele('ojp:Transfers', tripTransfers -1 ); 
    }
    const places = context.ele('ojp:Places');
    const ids = [];
    for(const stop of stops){
      if(ids.indexOf(stop.gtfsId) === -1){
        ids.push(stop.gtfsId);
        const place = places.ele('ojp:Location');
        const stopPlace = place.ele('ojp:StopPlace');
        stopPlace.ele('ojp:StopPlaceRef', stop.gtfsId);
        stopPlace.ele('ojp:StopPlaceName').ele('ojp:Text', `${stop.name}`);
        //stopPlace.ele('ojp:TopographicPlaceRef', stop.zoneId);
        place.ele('ojp:LocationName').ele('ojp:Text', `${stop.name}`);
        const geo = place.ele('ojp:GeoPosition');
        geo.ele('siri:Longitude', stop.lon);
        geo.ele('siri:Latitude', stop.lat);
      }
    }
  }

  return trips;
}

const createTripErrorResponse = (errorCode, startTime) => {
  const responseTimestamp = new Date().toISOString();
  const calcTime = (new Date().getTime()) - startTime
  const trip = xmlbuilder.create('ojp:OJPTripDelivery');
  trip.ele('siri:ResponseTimestamp', responseTimestamp);
  trip.ele('siri:Status', false);
  trip.ele('ojp:CalcTime', calcTime);

  const err = trip.ele('siri:ErrorCondition');
  err.ele('siri:OtherError')
  err.ele('siri:Description', errorCode);

  return trip;
}

module.exports = {
  'tripsExecution' : async (doc, startTime) => {
    try{
      if(
        queryNodes(doc, "//*[name()='ojp:OJPTripRequest']/*[name()='ojp:Origin']/*[name()='ojp:PlaceRef']").length > 0
        &&
        queryNodes(doc, "//*[name()='ojp:OJPTripRequest']/*[name()='ojp:Destination']/*[name()='ojp:PlaceRef']").length > 0
        ){
        const originId = queryText(doc, "//*[name()='ojp:OJPTripRequest']/*[name()='ojp:Origin']/*[name()='ojp:PlaceRef']/*[name()='StopPointRef']"); 
        const destinationId = queryText(doc, "//*[name()='ojp:OJPTripRequest']/*[name()='ojp:Destination']/*[name()='ojp:PlaceRef']/*[name()='StopPointRef']"); 

        const dateStart = queryText(doc, "//*[name()='ojp:OJPTripRequest']/*[name()='ojp:Origin']/*[name()='ojp:DepArrTime']");
        const dateEnd = queryText(doc, "//*[name()='ojp:OJPTripRequest']/*[name()='ojp:Destination']/*[name()='ojp:DepArrTime']");

        const intermediateStops = queryText(doc, "//*[name()='ojp:OJPTripRequest']/*[name()='ojp:Params']/*[name()='ojp:IncludeIntermediateStops']")

        const originLat = queryText(doc, "//*[name()='ojp:OJPTripRequest']/*[name()='ojp:Origin']/*[name()='ojp:PlaceRef']/*[name()='ojp:GeoPosition']/*[name()='Latitude']"); 
        const originLon = queryText(doc, "//*[name()='ojp:OJPTripRequest']/*[name()='ojp:Origin']/*[name()='ojp:PlaceRef']/*[name()='ojp:GeoPosition']/*[name()='Longitude']"); 
        const destinationLat = queryText(doc, "//*[name()='ojp:OJPTripRequest']/*[name()='ojp:Destination']/*[name()='ojp:PlaceRef']/*[name()='ojp:GeoPosition']/*[name()='Latitude']"); 
        const destinationLon = queryText(doc, "//*[name()='ojp:OJPTripRequest']/*[name()='ojp:Destination']/*[name()='ojp:PlaceRef']/*[name()='ojp:GeoPosition']/*[name()='Longitude']"); 
        
        const originName = queryText(doc, "//*[name()='ojp:OJPTripRequest']/*[name()='ojp:Origin']/*[name()='ojp:PlaceRef']/*[name()='ojp:LocationName']/*[name()='ojp:Text']"); 
        const destinationName = queryText(doc, "//*[name()='ojp:OJPTripRequest']/*[name()='ojp:Destination']/*[name()='ojp:PlaceRef']/*[name()='ojp:LocationName']/*[name()='ojp:Text']"); 

        const limitValue = queryText(doc, "//*[name()='ojp:OJPTripRequest']/*[name()='ojp:Params']/*[name()='ojp:NumberOfResults']");
        const transfersValue = queryText(doc, "//*[name()='ojp:OJPTripRequest']/*[name()='ojp:Params']/*[name()='ojp:TransferLimit']");

        const useWheelchair = queryText(doc, "//*[name()='ojp:OJPTripRequest']/*[name()='ojp:Params']/*[name()='ojp:IncludeAccessibility']");
        

        let date = new Date().getTime();
        let arrivedBy = false;
        if(dateStart != null){
          date = new Date(dateStart).getTime();
        }else if(dateEnd != null){
          arrivedBy = true;
          date = new Date(dateEnd).getTime();
        }

        const data = JSON.stringify({
          origin: originId || [originLon, originLat, originName || "Origin"],
          destination: destinationId || [destinationLon, destinationLat, destinationName || "Destination"],
          date,
          limit: Number(limitValue) || 1,
          arrivedBy,
          transfers: Number(transfersValue) || 2,
          wheelchair: useWheelchair === 'true',
          intermediatePlaces: []
        });
        
        const options = {
          host: `localhost`, //from environment variable
          path: `/plan`,
          port: 8090, //from environment variable
          method: 'POST',
          json:true,
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(data)
         }
        };
        console.log(options);
        const response = await doRequest(options, data);
        return createTripResponse(response.plan.itineraries, startTime, intermediateStops === 'true');
      }else{
        return createTripErrorResponse('E0001', startTime);
      }
    }catch(err){
      console.log(err);
      return createTripErrorResponse('E0002', startTime);
    }
    
  }
}