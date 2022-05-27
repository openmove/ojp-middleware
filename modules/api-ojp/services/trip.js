const xmlbuilder = require('xmlbuilder');
const qstr = require('querystring');
const _ = require('lodash');
const moment = require('moment-timezone');
const { 'v4': uuidv4 } = require('uuid');
const { time } = require('console');
const mongoClient = require("mongodb").MongoClient;

const {queryNode, queryNodes, queryText, queryTags} = require('../lib/query');
const {doRequest} = require('../lib/request');
const {parseParamsRestrictions, parseTripRestrictions} = require('../lib/restrictions');
const {createErrorResponse, ptModesResponse} = require('../lib/response');

const serviceName = 'OJPTrip';

const createResponse = (config,
                        itineraries,
                        startTime,
                        intermediateStops,
                        question) => {

  const {location_digits} = config;

//console.log('QUESTION',question)

  const {origin, destination, origin_type, destin_type} = question;

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
      trip.ele('ojp:Duration', moment.duration(itinerary.duration, 's').toISOString() )
      trip.ele('ojp:StartTime', moment(itinerary.startTime).toISOString());
      trip.ele('ojp:EndTime', moment(itinerary.endTime).toISOString());

      let tripDistance = 0;
      let tripTransfers = 0;
      let legId = 0;

      let firstLeg;

      for(const leg of itinerary.legs) {

        legId += 1
        const tripLeg = trip.ele('ojp:TripLeg');

        if(!firstLeg) {
          firstLeg = tripLeg;
        }

        tripLeg.ele('ojp:LegId', legId);
        tripDistance += leg.distance;

        if(leg.transitLeg === false) {

          if(leg.mode === 'WALK') {
            const transferLeg = tripLeg.ele('ojp:TransferLeg');

            transferLeg.ele('ojp:TransferMode', 'walk');

          //LegStart
            const legStart = transferLeg.ele('ojp:LegStart');

            if (origin_type==='PointRef') {
              legStart.ele('siri:StopPointRef', leg.from.stop ? leg.from.stop.gtfsId : origin);
            }
            else if (origin_type==='PlaceRef') {
              legStart.ele('ojp:StopPlaceRef', origin);
            }
            else if (origin_type==='Position') {
              const geoS = legStart.ele('ojp:GeoPosition');
              geoS.ele('siri:Longitude', _.round(leg.from.lon, location_digits) );
              geoS.ele('siri:Latitude', _.round(leg.from.lat, location_digits) );
            }

            legStart.ele('ojp:LocationName').ele('ojp:Text', `${leg.from.name}`);

          //LegEnd
            const legEnd = transferLeg.ele('ojp:LegEnd');

            //PATCH this https://github.com/openmove/ojp-middleware/issues/28
            if (destin_type==='PointRef') {
              legEnd.ele('siri:StopPointRef', leg.to.stop ? leg.to.stop.gtfsId : destination);
            }
            else if (destin_type==='PlaceRef') {
              legEnd.ele('ojp:StopPlaceRef', destination);
            }
            else if (destin_type==='Position') {
              const geoE = legEnd.ele('ojp:GeoPosition');
              geoE.ele('siri:Longitude', _.round(leg.to.lon, location_digits) );
              geoE.ele('siri:Latitude', _.round(leg.to.lat, location_digits) );
            }

            legEnd.ele('ojp:LocationName').ele('ojp:Text', `${leg.to.name}`);

            transferLeg.ele('ojp:TimeWindowStart', moment(leg.startTime).toISOString());
            transferLeg.ele('ojp:TimeWindowEnd', moment(leg.endTime).toISOString());
            transferLeg.ele('ojp:Duration', moment.duration(leg.duration, 's').toISOString());
            transferLeg.ele('ojp:WalkDuration', moment.duration(leg.duration, 's').toISOString())
          }
        }
        else {

          tripTransfers += 1;
          let sequence = 1;
          const timedLeg = tripLeg.ele('ojp:TimedLeg');
          const board = timedLeg.ele('ojp:LegBoard');

          if(leg.from.stop){
            stops.push(leg.from.stop);
            board.ele('siri:StopPointRef', leg.from.stop.gtfsId);
          }

          board.ele('ojp:StopPointName').ele('ojp:Text', `${leg.from.name}`);

          const serviceFrom = board.ele('ojp:ServiceDeparture');
          serviceFrom.ele('ojp:TimetabledTime', moment(leg.startTime).toISOString())
          serviceFrom.ele('ojp:EstimatedTime', moment(leg.startTime - leg.departureDelay).toISOString())

          board.ele('ojp:Order', 1);

          for(const intermediatePoint of leg.intermediatePlaces) {
            sequence += 1;

            if(intermediateStops) {

              const intermediate = timedLeg.ele('ojp:LegIntermediates');

              intermediate.ele('ojp:StopPointName').ele('ojp:Text', `${intermediatePoint.name}`);
              if(intermediatePoint.stop){
                stops.push(intermediatePoint.stop);
                intermediate.ele('siri:StopPointRef', intermediatePoint.stop.gtfsId);
              }
              const serviceIntermediateArr = intermediate.ele('ojp:ServiceArrival');
              serviceIntermediateArr.ele('ojp:TimetabledTime', moment(intermediatePoint.arrivalTime).toISOString())
              serviceIntermediateArr.ele('ojp:EstimatedTime', moment(intermediatePoint.arrivalTime - leg.departureDelay).toISOString())

              const serviceIntermediateDep = intermediate.ele('ojp:ServiceDeparture');
              serviceIntermediateDep.ele('ojp:TimetabledTime', moment(intermediatePoint.departureTime).toISOString())
              serviceIntermediateDep.ele('ojp:EstimatedTime', moment(intermediatePoint.departureTime - leg.departureDelay).toISOString())

              intermediate.ele('ojp:Order', sequence);
            }
          }

          const alight = timedLeg.ele('ojp:LegAlight');

          if(leg.to.stop){
            alight.ele('siri:StopPointRef', leg.to.stop.gtfsId);
            stops.push(leg.to.stop);
          }

          alight.ele('ojp:StopPointName').ele('ojp:Text', `${leg.to.name}`);

          const serviceTo = alight.ele('ojp:ServiceArrival');
          serviceTo.ele('ojp:TimetabledTime', moment(leg.endTime).toISOString())
          serviceTo.ele('ojp:EstimatedTime', moment(leg.endTime - leg.arrivalDelay).toISOString())
          alight.ele('ojp:Order', sequence+1);

          const service = timedLeg.ele('ojp:Service');
          service.ele('ojp:OperatingDayRef', moment(leg.serviceDate).tz(leg.route.agency.timezone).format("YYYY-MM-DD"));
          service.ele('ojp:JourneyRef', leg.trip.gtfsId);
          service.ele('siri:LineRef', leg.route.gtfsId);

          const mode = service.ele('ojp:Mode');

          const ojpMode = ptModesResponse( leg.mode );

          mode.ele('ojp:PtMode', ojpMode);

          service.ele('siri:DirectionRef', leg.trip.directionId);
          service.ele('ojp:PublishedLineName').ele('ojp:Text', leg.route.longName || leg.route.shortName || leg.route.gtfsId)
          service.ele('ojp:OperatorRef', leg.route.agency.gtfsId);
          service.ele('ojp:OriginStopPointRef', leg.trip.departureStoptime.stop.gtfsId);
          stops.push(leg.trip.departureStoptime.stop);
          service.ele('ojp:OriginText').ele('ojp:Text', `${leg.trip.departureStoptime.stop.name}`);
          service.ele('ojp:DestinationStopPointRef', leg.trip.arrivalStoptime.stop.gtfsId);
          stops.push(leg.trip.arrivalStoptime.stop);
          service.ele('ojp:DestinationText').ele('ojp:Text', `${leg.trip.arrivalStoptime.stop.name}`);
        }//end else
      }
      firstLeg.insertBefore('ojp:Transfers', tripTransfers -1 );
      firstLeg.insertBefore('ojp:Distance', tripDistance.toFixed(0));
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

        const geo = place.ele('ojp:GeoPosition');
        geo.ele('siri:Longitude', _.round(stop.lon, location_digits) );
        geo.ele('siri:Latitude', _.round(stop.lat, location_digits) )

        place.ele('ojp:LocationName').ele('ojp:Text', `${stop.name}`);
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

      const { limit, ptModes } = parseParamsRestrictions(doc, serviceTag, config);

      if(
        queryNodes(doc, [serviceTag, 'ojp:Origin', 'ojp:PlaceRef']).length > 0 &&
        queryNodes(doc, [serviceTag, 'ojp:Destination', 'ojp:PlaceRef']).length > 0
        ){

        let originId = queryTags(doc, [serviceTag, 'ojp:Origin', 'ojp:PlaceRef', 'StopPointRef']);
        let destinationId = queryTags(doc, [serviceTag, 'ojp:Destination', 'ojp:PlaceRef', 'StopPointRef']);

        if(originId == null){
          originId = queryTags(doc, [serviceTag, 'ojp:Origin', 'ojp:PlaceRef', 'ojp:StopPlaceRef']);
        }

        if(destinationId == null){
          destinationId = queryTags(doc, [serviceTag, 'ojp:Destination', 'ojp:PlaceRef', 'ojp:StopPlaceRef']);
        }

        const {transferLimit, accessibility, intermediateStops, dateStart, dateEnd} = parseTripRestrictions(doc, serviceTag, config);

        const originName = queryTags(doc, [serviceTag, 'ojp:Origin', 'ojp:PlaceRef', 'ojp:LocationName', 'ojp:Text']);
        const originLat = queryTags(doc, [serviceTag, 'ojp:Origin', 'ojp:PlaceRef', 'ojp:GeoPosition', 'Latitude']);
        const originLon = queryTags(doc, [serviceTag, 'ojp:Origin', 'ojp:PlaceRef', 'ojp:GeoPosition', 'Longitude']);

        const destinationName = queryTags(doc, [serviceTag, 'ojp:Destination', 'ojp:PlaceRef', 'ojp:LocationName', 'ojp:Text']);
        const destinationLat = queryTags(doc, [serviceTag, 'ojp:Destination', 'ojp:PlaceRef', 'ojp:GeoPosition', 'Latitude']);
        const destinationLon = queryTags(doc, [serviceTag, 'ojp:Destination', 'ojp:PlaceRef', 'ojp:GeoPosition', 'Longitude']);

        //PATCH this https://github.com/openmove/ojp-middleware/issues/28
        let origin_type = originId ? 'PointRef' : 'PlaceRef';
        origin_type = originLat || originLon ? 'Position' : origin_type;

        let destin_type = destinationId ? 'PointRef' : 'PlaceRef';
        destin_type = destinationLat || destinationLon ? 'Position' : destin_type;

        const intermediatePlaces = [];

        const vias = queryNodes(doc, [serviceTag, 'ojp:Via', 'ojp:ViaPoint']);

        if(Array.isArray(vias) && vias.length > 0) {
          for(const via of vias) {

            if( via.childNodes[1].localName === 'StopPointRef' ||
                via.childNodes[1].localName === 'StopPlaceRef' ) {

              intermediatePlaces.push(via.childNodes[1].firstChild.data);
            }
            else if(via.childNodes[1].localName === 'GeoPosition'){
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
          origin_type,
          destin_type,
          date,
          limit,
          arrivedBy,
          transfers: transferLimit,
          wheelchair: accessibility,
          intermediatePlaces
        }

        ////config, origin, destination, date, extra
        ///
        const json = JSON.stringify(questionObj);

        const options = {
          path: `/plan`,
          host: config['api-otp'].host,
          port: config['api-otp'].port,
          method: 'POST',
          json:true,
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(json)
         }
        };
        logger.info(options);

        const response = await doRequest(options, json);

        return createResponse(config,
                              response.plan.itineraries,
                              startTime,
                              intermediateStops,
                              questionObj
                              );

      }else{
        return createErrorResponse(serviceName, config.errors.notagcondition, startTime);
      }
    }catch(err){
      logger.error(err);
      return createErrorResponse(serviceName, config.errors.noparsing, startTime);
    }
    
  }
}