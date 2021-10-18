const xmlbuilder = require('xmlbuilder');
const qstr = require('querystring');
const _ = require('lodash');
const moment = require('moment-timezone');
const { v4: uuidv4 } = require('uuid');
const { time } = require('console');
const mongoClient = require("mongodb").MongoClient;

const {queryNode, queryNodes, queryText, queryTags} = require('../lib/query');
const {doRequest} = require('../lib/request');
const {parseParamsRestrictions} = require('../lib/restrictions');
const {createErrorResponse} = require('../lib/response');

const serviceName = 'OJPTrip';

const createResponse = (itineraries, startTime, showIntermediates, config, question) => {

  const now = new Date()
    , tag = xmlbuilder.create(`ojp:${serviceName}Delivery`);
  tag.ele('siri:ResponseTimestamp', now.toISOString());
  tag.ele('ojp:CalcTime', now.getTime() - startTime);

  const {logger} = config;

  if(itineraries === null || itineraries.length === 0){
    tag.ele('siri:Status', false);
    const err = trip.ele('siri:ErrorCondition');
    err.ele('siri:OtherError')
    err.ele('siri:Description', config.errors.noresults.trip);
  } else {
    tag.ele('siri:Status', true);
    const context = tag.ele('ojp:TripResponseContext');
    const stops = [];
    for(const itinerary of itineraries){
      const tripresponse = tag.ele('ojp:TripResult');
      const tripId = uuidv4();

      try{
        mongoClient.connect(config.db.uri, {
          useNewUrlParser: true,
          useUnifiedTopology: true
        }, (err, client) => {
          if (err) {
            logger.error(err);
          }else{
            client
            .db('ojp')
            .collection('trip-requests')
            .insertOne({
              tripId,
              itinerary,
              'request': question
            }, function(err, queryres) {
              if (err) {
                logger.error(err);
              } 
              client.close();
            });
          }          
        });
      }catch (exc){
        logger.error(exc);
      }
      
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

  return tag;
}

module.exports = {
  'tripsExecution' : async (doc, startTime, config) => {

    const serviceTag = `ojp:${serviceName}Request`;
    
    const {logger} = config;

    try{

      const { limit, skip, ptModes } = parseParamsRestrictions(doc, serviceTag, config);

      if(
        queryNodes(doc, "//*[name()='ojp:OJPTripRequest']/*[name()='ojp:Origin']/*[name()='ojp:PlaceRef']").length > 0
        &&
        queryNodes(doc, "//*[name()='ojp:OJPTripRequest']/*[name()='ojp:Destination']/*[name()='ojp:PlaceRef']").length > 0
        ){
        let originId = queryText(doc, "//*[name()='ojp:OJPTripRequest']/*[name()='ojp:Origin']/*[name()='ojp:PlaceRef']/*[name()='StopPointRef']"); 
        let destinationId = queryText(doc, "//*[name()='ojp:OJPTripRequest']/*[name()='ojp:Destination']/*[name()='ojp:PlaceRef']/*[name()='StopPointRef']"); 

        if(originId == null){
          originId = queryText(doc, "//*[name()='ojp:OJPTripRequest']/*[name()='ojp:Origin']/*[name()='ojp:PlaceRef']/*[name()='ojp:StopPlaceRef']");
        }

        if(destinationId == null){
          destinationId = queryText(doc, "//*[name()='ojp:OJPTripRequest']/*[name()='ojp:Destination']/*[name()='ojp:PlaceRef']/*[name()='ojp:StopPlaceRef']");
        }

        const dateStart = queryText(doc, "//*[name()='ojp:OJPTripRequest']/*[name()='ojp:Origin']/*[name()='ojp:DepArrTime']");
        const dateEnd = queryText(doc, "//*[name()='ojp:OJPTripRequest']/*[name()='ojp:Destination']/*[name()='ojp:DepArrTime']");

        const intermediateStops = queryText(doc, "//*[name()='ojp:OJPTripRequest']/*[name()='ojp:Params']/*[name()='ojp:IncludeIntermediateStops']")

        const originLat = queryText(doc, "//*[name()='ojp:OJPTripRequest']/*[name()='ojp:Origin']/*[name()='ojp:PlaceRef']/*[name()='ojp:GeoPosition']/*[name()='Latitude']"); 
        const originLon = queryText(doc, "//*[name()='ojp:OJPTripRequest']/*[name()='ojp:Origin']/*[name()='ojp:PlaceRef']/*[name()='ojp:GeoPosition']/*[name()='Longitude']"); 
        const destinationLat = queryText(doc, "//*[name()='ojp:OJPTripRequest']/*[name()='ojp:Destination']/*[name()='ojp:PlaceRef']/*[name()='ojp:GeoPosition']/*[name()='Latitude']"); 
        const destinationLon = queryText(doc, "//*[name()='ojp:OJPTripRequest']/*[name()='ojp:Destination']/*[name()='ojp:PlaceRef']/*[name()='ojp:GeoPosition']/*[name()='Longitude']"); 
        
        const originName = queryText(doc, "//*[name()='ojp:OJPTripRequest']/*[name()='ojp:Origin']/*[name()='ojp:PlaceRef']/*[name()='ojp:LocationName']/*[name()='ojp:Text']"); 
        const destinationName = queryText(doc, "//*[name()='ojp:OJPTripRequest']/*[name()='ojp:Destination']/*[name()='ojp:PlaceRef']/*[name()='ojp:LocationName']/*[name()='ojp:Text']"); 

        const transfersValue = queryText(doc, "//*[name()='ojp:OJPTripRequest']/*[name()='ojp:Params']/*[name()='ojp:TransferLimit']");
        //TODO move inside parseParamsRestrictions() 

        const useWheelchair = queryText(doc, "//*[name()='ojp:OJPTripRequest']/*[name()='ojp:Params']/*[name()='ojp:IncludeAccessibility']");
        
        const intermediatePlaces = [];

        const vias = queryNodes(doc, "//*[name()='ojp:OJPTripRequest']/*[name()='ojp:Via']/*[name()='ojp:ViaPoint']")
        for(const via of vias){
          if(via.childNodes[1].localName === 'StopPointRef'){
            intermediatePlaces.push(via.childNodes[1].firstChild.data);
          } else if(via.childNodes[1].localName === 'GeoPosition'){
            let lat, lon = 0;
            for (const key in via.childNodes[1].childNodes){
              const child = via.childNodes[1].childNodes[key];
              if(child.localName === 'Longitude'){
                lon = child.firstChild.data;
              }else if (child.localName === 'Latitude'){
                lat = child.firstChild.data;
              }
            }
            intermediatePlaces.push([lon,lat]);
          }
        }

        let date = new Date().getTime();

        let arrivedBy = false;

        if(dateStart != null){
          date = new Date(dateStart).getTime();
        }
        else if(dateEnd != null){

          arrivedBy = true;

          date = new Date(dateEnd).getTime();
        }

        const questionObj = {
          origin: originId || [originLon, originLat, originName || "Origin"],
          destination: destinationId || [destinationLon, destinationLat, destinationName || "Destination"],
          date,
          limit,
          arrivedBy,
          transfers: Number(transfersValue) || 2,
          wheelchair: useWheelchair === 'true',
          intermediatePlaces
        }
        const data = JSON.stringify(questionObj);
        
        const options = {
          path: `/plan`,
          host: config['api-otp'].host,
          port: config['api-otp'].port,
          method: 'POST',
          json:true,
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(data)
         }
        };
        logger.info(options);
        const response = await doRequest(options, data);
        return createResponse(response.plan.itineraries, startTime, intermediateStops === 'true', config, questionObj);
      }else{
        return createErrorResponse(serviceName, config.errors.notagcondition, startTime);
      }
    }catch(err){
      logger.error(err);
      return createErrorResponse(serviceName, config.errors.noparsing, startTime);
    }
    
  }
}