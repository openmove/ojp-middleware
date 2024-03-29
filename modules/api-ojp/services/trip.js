const xmlbuilder = require('xmlbuilder');
const qstr = require('querystring');
const _ = require('lodash');
const moment = require('moment-timezone');
const { 'v4': uuidv4 } = require('uuid');
const { time } = require('console');
const { MongoClient } = require("mongodb");
const polyline = require('@mapbox/polyline');

const { queryNodes, queryText, queryTags } = require('../lib/query');
const { parseParamsRestrictions, parseTripRestrictions } = require('../lib/restrictions');

const { doRequest, ptModesRequest} = require('../lib/request');
const { createErrorResponse, ptModesResponse, precisionMeters, stopText, lineText } = require('../lib/response');

const serviceName = 'OJPTrip';

const createResponse = (config,
                        itineraries,
                        startTime,
                        intermediateStops,
                        includeTracks,
                        question) => {

  const {location_digits} = config;

  const positionPrecision = precisionMeters(config);

  const {origin, destination, origin_type, destin_type} = question;

  const now = new Date()
    , tag = xmlbuilder.create(`ojp:${serviceName}Delivery`);
  tag.ele('siri:ResponseTimestamp', now.toISOString());
  tag.ele('ojp:CalcTime', now.getTime() - startTime);

  const {logger} = config;

  if(itineraries === null || itineraries.length === 0) {
    tag.ele('siri:Status', false);
    const err = tag.ele('siri:ErrorCondition');
    err.ele('siri:OtherError')
    err.ele('siri:Description', config.errors.noresults.trip);
  }
  else {
    tag.ele('siri:Status', true);
    const context = tag.ele('ojp:TripResponseContext');
    const stops = [];
    for(const itinerary of itineraries) {

      const tripresponse = tag.ele('ojp:TripResult');
      const tripId = uuidv4();

      try{
        MongoClient.connect(config.db.uri, {
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
      }catch (exc) {
        logger.warn(exc);
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
            const transfLeg = tripLeg.ele('ojp:TransferLeg');

            transfLeg.ele('ojp:TransferMode', 'walk');

            //legStart
            const start = transfLeg.ele('ojp:LegStart');

            if (origin_type==='PointRef') {
              start.ele('siri:StopPointRef', leg.from.stop ? leg.from.stop.gtfsId : origin);

              start.ele('ojp:LocationName').ele('ojp:Text', `${leg.from.name}`);
            }
            else if (origin_type==='PlaceRef') {
              start.ele('ojp:StopPlaceRef', origin);

              start.ele('ojp:LocationName').ele('ojp:Text', `${leg.from.name}`);
            }
            else if (origin_type==='Position') {
              const geoStart = start.ele('ojp:GeoPosition');
              geoStart.ele('siri:Longitude', _.round(leg.from.lon, location_digits) );
              geoStart.ele('siri:Latitude', _.round(leg.from.lat, location_digits) );

              start.ele('ojp:LocationName').ele('ojp:Text', `${leg.from.name}`);
            }

            //LegEnd
            const end = transfLeg.ele('ojp:LegEnd');

            //PATCH this https://github.com/openmove/ojp-middleware/issues/28
            if (destin_type==='PointRef') {
              end.ele('siri:StopPointRef', leg.to.stop ? leg.to.stop.gtfsId : destination);

              end.ele('ojp:LocationName').ele('ojp:Text', `${leg.to.name}`);
            }
            else if (destin_type==='PlaceRef') {
              end.ele('ojp:StopPlaceRef', destination);

              end.ele('ojp:LocationName').ele('ojp:Text', `${leg.to.name}`);
            }
            else if (destin_type==='Position') {

              const geoEnd = end.ele('ojp:GeoPosition');
              geoEnd.ele('siri:Longitude', _.round(leg.to.lon, location_digits) );
              geoEnd.ele('siri:Latitude', _.round(leg.to.lat, location_digits) );

              end.ele('ojp:LocationName').ele('ojp:Text', `${leg.to.name}`);
            }

            transfLeg.ele('ojp:TimeWindowStart', moment(leg.startTime).toISOString());
            transfLeg.ele('ojp:TimeWindowEnd', moment(leg.endTime).toISOString());
            transfLeg.ele('ojp:Duration', moment.duration(leg.duration, 's').toISOString());
            transfLeg.ele('ojp:WalkDuration', moment.duration(leg.duration, 's').toISOString())
          }
        }
        else {

          /// leg.transitLeg ===  true

          tripTransfers += 1;
          let sequence = 1;
          const timedLeg = tripLeg.ele('ojp:TimedLeg');
          const legBoard = timedLeg.ele('ojp:LegBoard');

          if(leg.from.stop) {
            stops.push(leg.from.stop);
            legBoard.ele('siri:StopPointRef', leg.from.stop.gtfsId);
          }

          legBoard.ele('ojp:StopPointName').ele('ojp:Text', `${leg.from.name}`);

          const serviceFrom = legBoard.ele('ojp:ServiceDeparture');
          serviceFrom.ele('ojp:TimetabledTime', moment(leg.startTime).toISOString())
          serviceFrom.ele('ojp:EstimatedTime', moment(leg.startTime - leg.departureDelay).toISOString())

          legBoard.ele('ojp:Order', 1);

          for(const intermediatePoint of leg.intermediatePlaces) {
            sequence += 1;

            if(intermediateStops) {

              const intermediate = timedLeg.ele('ojp:LegIntermediates');

              if(intermediatePoint.stop) {
                stops.push(intermediatePoint.stop);
                intermediate.ele('siri:StopPointRef', intermediatePoint.stop.gtfsId);
              }

              intermediate.ele('ojp:StopPointName').ele('ojp:Text', `${intermediatePoint.name}`);

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

          if(leg.to.stop) {
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

          service.ele('ojp:PublishedLineName').ele('ojp:Text', lineText(leg.route));

          service.ele('ojp:OperatorRef', leg.route.agency.gtfsId);
          service.ele('ojp:OriginStopPointRef', leg.trip.departureStoptime.stop.gtfsId);
          stops.push(leg.trip.departureStoptime.stop);

          service.ele('ojp:OriginText').ele('ojp:Text', `${leg.trip.departureStoptime.stop.name}`);
          service.ele('ojp:DestinationStopPointRef', leg.trip.arrivalStoptime.stop.gtfsId);
          stops.push(leg.trip.arrivalStoptime.stop);

          service.ele('ojp:DestinationText').ele('ojp:Text', `${leg.trip.arrivalStoptime.stop.name}`);

          if (includeTracks===true) {
            const legTrack = timedLeg.ele('ojp:LegTrack');

            const trackPoints = polyline.decode(leg.legGeometry.points, location_digits);

            const trackSection = legTrack.ele('ojp:TrackSection');

            //TrackStart
            const start = trackSection.ele('ojp:TrackStart');

            if (origin_type==='PointRef') {
              start.ele('siri:StopPointRef', leg.from.stop ? leg.from.stop.gtfsId : origin);

              start.ele('ojp:LocationName').ele('ojp:Text', `${leg.from.name}`);
            }
            else if (origin_type==='PlaceRef') {
              start.ele('ojp:StopPlaceRef', origin);

              start.ele('ojp:LocationName').ele('ojp:Text', `${leg.from.name}`);
            }
            else if (origin_type==='Position') {
              const geoStart = start.ele('ojp:GeoPosition');
              geoStart.ele('siri:Longitude', _.round(leg.from.lon, location_digits) );
              geoStart.ele('siri:Latitude', _.round(leg.from.lat, location_digits) );

              start.ele('ojp:LocationName').ele('ojp:Text', `${leg.from.name}`);
            }
            const end = trackSection.ele('ojp:TrackEnd');
            if (destin_type==='PointRef') {
              end.ele('siri:StopPointRef', leg.to.stop ? leg.to.stop.gtfsId : destination);

              end.ele('ojp:LocationName').ele('ojp:Text', `${leg.to.name}`);
            }
            else if (destin_type==='PlaceRef') {
              end.ele('ojp:StopPlaceRef', destination);
              end.ele('ojp:LocationName').ele('ojp:Text', `${leg.to.name}`);
            }
            else if (destin_type==='Position') {

              const geoEnd = end.ele('ojp:GeoPosition');
              geoEnd.ele('siri:Longitude', _.round(leg.to.lon, location_digits) );
              geoEnd.ele('siri:Latitude', _.round(leg.to.lat, location_digits) );

              end.ele('ojp:LocationName').ele('ojp:Text', `${leg.to.name}`);
            }

            const linkProjection = trackSection.ele('ojp:LinkProjection');
            for (const point of trackPoints) {
              const pos = linkProjection.ele('ojp:Position');
              const [lat, lon] = point;
              pos.ele('siri:Longitude', lon);
              pos.ele('siri:Latitude', lat);
              if (config.include_precision) {
                pos.ele('siri:Precision', positionPrecision);
              }
            }
          }

        }//end else
      }
      firstLeg.insertBefore('ojp:Transfers', tripTransfers -1 );
      firstLeg.insertBefore('ojp:Distance', tripDistance.toFixed(0));
    }

    const places = context.ele('ojp:Places');
    const ids = [];
    for(const stop of stops) {
      if(ids.indexOf(stop.gtfsId) === -1) {
        ids.push(stop.gtfsId);

        const place = places.ele('ojp:Location');

        const stopPlace = place.ele('ojp:StopPlace');
        stopPlace.ele('ojp:StopPlaceRef', stop.gtfsId);
        stopPlace.ele('ojp:StopPlaceName').ele('ojp:Text', `${stop.name}`);
        //stopPlace.ele('ojp:TopographicPlaceRef', stop.zoneId);

        place.ele('ojp:LocationName').ele('ojp:Text', `${stop.name}`);

        const geo = place.ele('ojp:GeoPosition');
        geo.ele('siri:Longitude', _.round(stop.lon, location_digits) );
        geo.ele('siri:Latitude', _.round(stop.lat, location_digits) );
      }
    }
  }

  return tag;
}

module.exports = {
  'tripsExecution' : async (doc, startTime, config) => {

    const serviceTag = `${serviceName}Request`;
    
    const {logger} = config;

    try{

      const { limit, ptModes, ptModeFilter, ptModeExclude } = parseParamsRestrictions(doc, serviceTag, config);

      const modes = ptModesRequest(ptModeFilter, ptModeExclude);  //convert siri to otp modes

      if(
        queryNodes(doc, [serviceTag, 'Origin','PlaceRef']).length > 0 &&
        queryNodes(doc, [serviceTag, 'Destination','PlaceRef']).length > 0
        ) {

        let originId = queryTags(doc, [serviceTag, 'Origin','PlaceRef','StopPointRef']);
        let destinationId = queryTags(doc, [serviceTag, 'Destination','PlaceRef','StopPointRef']);

        if(originId == null) {
          originId = queryTags(doc, [serviceTag, 'Origin','PlaceRef','StopPlaceRef']);
        }

        if(destinationId == null) {
          destinationId = queryTags(doc, [serviceTag, 'Destination','PlaceRef','StopPlaceRef']);
        }

        const {
          transferLimit,
          accessibility,
          intermediateStops,
          trackSections, legProjection,
          dateStart, dateEnd} = parseTripRestrictions(doc, serviceTag, config);

        const originName = queryTags(doc, [serviceTag, 'Origin','PlaceRef','LocationName','Text']);
        const originLat = queryTags(doc, [serviceTag, 'Origin','PlaceRef','GeoPosition','Latitude']);
        const originLon = queryTags(doc, [serviceTag, 'Origin','PlaceRef','GeoPosition','Longitude']);

        const destinationName = queryTags(doc, [serviceTag, 'Destination','PlaceRef','LocationName','Text']);
        const destinationLat = queryTags(doc, [serviceTag, 'Destination','PlaceRef','GeoPosition','Latitude']);
        const destinationLon = queryTags(doc, [serviceTag, 'Destination','PlaceRef','GeoPosition','Longitude']);

        //PATCH this https://github.com/openmove/ojp-middleware/issues/28
        let origin_type = originId ? 'PointRef' : 'PlaceRef';
        origin_type = originLat || originLon ? 'Position' : origin_type;

        let destin_type = destinationId ? 'PointRef' : 'PlaceRef';
        destin_type = destinationLat || destinationLon ? 'Position' : destin_type;

        const intermediatePlaces = [];

        const vias = queryNodes(doc, [serviceTag, 'Via','ViaPoint']);

        if(Array.isArray(vias) && vias.length > 0) {
          for(const via of vias) {

            if( via.childNodes[1].localName === 'StopPointRef' ||
                via.childNodes[1].localName === 'StopPlaceRef' ) {

              intermediatePlaces.push(via.childNodes[1].firstChild.data);
            }
            else if(via.childNodes[1].localName === 'GeoPosition') {
              let lat, lon = 0;
              for (const key in via.childNodes[1].childNodes) {
                const child = via.childNodes[1].childNodes[key];
                if(child.localName === 'Longitude') {
                  lon = child.firstChild.data;
                }else if (child.localName === 'Latitude') {
                  lat = child.firstChild.data;
                }
              }
              intermediatePlaces.push([lon,lat]);
            }
          }
        }

        let date = new Date().getTime();

        let arrivedBy = false;

        if(dateStart != null) {
          date = new Date(dateStart).getTime();
        }
        else if(dateEnd != null) {

          arrivedBy = true;

          date = new Date(dateEnd).getTime();
        }

        const includeTracks = (legProjection===true || trackSections ===true);

        const questionObj = {
          origin: originId || [originLon, originLat, originName || "Origin"],
          destination: destinationId || [destinationLon, destinationLat, destinationName || "Destination"],
          origin_type,
          destin_type,
          modes,
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

        //console.log('REQUEST-----------------', questionObj)

        const options = {
          path: `/plan`,
          host: config['api-otp'].host,
          port: config['api-otp'].port,
          method: 'POST',
          json: true,
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(json)
          }
        };
        logger.info(options);

        const response = await doRequest(options, json).catch(err => {
          throw err
        });


        if (response.plan && response.plan.itineraries) {
          return createResponse(config,
                                response.plan.itineraries,
                                startTime,
                                intermediateStops,
                                includeTracks,
                                questionObj
                                );
        }

      }else{
        return createErrorResponse(serviceName, config.errors.notagcondition, startTime);
      }
    }
    catch(err) {
      if (err.code === 'ECONNREFUSED') {
        return createErrorResponse(serviceName, config.errors.nootpservice, startTime, err);
      }
      else if (err.code === 'EJSONPARSE') {
        return createErrorResponse(serviceName, config.errors.noparseresponse, startTime, err);
      }
      else {
        return createErrorResponse(serviceName, config.errors.noparsing, startTime, err);
      }
    }
    
  }
}