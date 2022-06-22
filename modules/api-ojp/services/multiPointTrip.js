const xmlbuilder = require('xmlbuilder');
const qstr = require('querystring');
const _ = require('lodash');
const moment = require('moment-timezone');
const { 'v4': uuidv4 } = require('uuid');
const { time } = require('console');
const mongoClient = require("mongodb").MongoClient;

const {queryNode, queryNodes, queryText, queryTags} = require('../lib/query');
const {parseParamsRestrictions, parseTripRestrictions} = require('../lib/restrictions');

const {doRequest, doMultiRequests, ptModesRequest} = require('../lib/request');
const {createErrorResponse, ptModesResponse, precisionMeters} = require('../lib/response');

const serviceName = 'OJPMultiPointTrip';

const createResponse = (config, results, startTime) => {

  const {location_digits} = config;

  const positionPrecision = precisionMeters(config);

  const now = new Date()
    , tag = xmlbuilder.create(`ojp:${serviceName}Delivery`);
  tag.ele('siri:ResponseTimestamp', now.toISOString());
  tag.ele('ojp:CalcTime', now.getTime() - startTime);

  const {logger} = config;

	if(results.length === 0) {
		tag.ele('siri:Status', false);
		const err = tag.ele('siri:ErrorCondition');
		err.ele('siri:OtherError')
		err.ele('siri:Description', config.errors.noresults.trip);
		return tag;
	}
	
	tag.ele('siri:Status', true);
	const context = tag.ele('ojp:TripResponseContext');
	const stops = [];

	let q = 1;

	for(const {itineraries, intermediateStops, config, question} of results) {

		const {origin, destination, origin_type, destin_type} = question;

		for(const itinerary of itineraries){
			const tripresponse = tag.ele(`ojp:MultiPointTripResult`);
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

			for(const leg of itinerary.legs){
				legId += 1
				const tripLeg = trip.ele('ojp:TripLeg');
				tripLeg.ele('ojp:LegId', legId);
				tripDistance += leg.distance;

				if(!firstLeg) {
          firstLeg = tripLeg;
        }

				if(leg.transitLeg === false) {
					if(leg.mode === 'WALK') {
						const transferLeg = tripLeg.ele('ojp:TransferLeg');

						transferLeg.ele('ojp:TransferMode', 'walk');

						//legStart
            const start = transferLeg.ele('ojp:LegStart');

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

              start.ele('ojp:LocationName').ele('ojp:Text', `${leg.from.name}`)
            }

            //LegEnd
            const end = transferLeg.ele('ojp:LegEnd');

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
					const legBoard = timedLeg.ele('ojp:LegBoard');

					if(leg.from.stop){
						stops.push(leg.from.stop);
						legBoard.ele('siri:StopPointRef', leg.from.stop.gtfsId);
					}

					legBoard.ele('ojp:StopPointName').ele('ojp:Text', `${leg.from.name}`);

					const serviceFrom = legBoard.ele('ojp:ServiceDeparture');
					serviceFrom.ele('ojp:TimetabledTime', moment(leg.startTime).toISOString())
					serviceFrom.ele('ojp:EstimatedTime', moment(leg.startTime - leg.departureDelay).toISOString())

					legBoard.ele('ojp:Order', 1);

					for(const intermediatePoint of leg.intermediatePlaces){
						sequence += 1;
						if(intermediateStops) {
							const intermediate = timedLeg.ele('ojp:LegIntermediates')

							if(intermediatePoint.stop){
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

					const serviceTo = alight.ele('ojp:ServiceDeparture');
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
			firstLeg.insertBefore('ojp:Transfers', tripTransfers -1 );
			firstLeg.insertBefore('ojp:Distance', tripDistance.toFixed(0));
		}
			
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
	    geo.ele('siri:Latitude', _.round(stop.lat, location_digits) );

			place.ele('ojp:LocationName').ele('ojp:Text', `${stop.name}`);
		}
	}

  return tag;
}

module.exports = {
	'multipointTripExecution' : async (doc, startTime, config) => {
	
		const serviceTag = `ojp:${serviceName}Request`;

		const {logger} = config;

		const {limit, skip, ptModes} = parseParamsRestrictions(doc, serviceTag, config);

		const {transferLimit, includeAccessibility, intermediateStops, dateStart, dateEnd} = parseTripRestrictions(doc, serviceTag, config);

		try {
			let requests = [];
			let responses = [];

			const origins = queryNodes(doc, [serviceTag, 'ojp:Origin']);
			const destinations = queryNodes(doc, [serviceTag, 'ojp:Destination']);

			logger.info(`Origins count ${origins.length}`);
			logger.info(`Destinations count ${destinations.length}`);

			if(
				origins.length > 0
				&&
				destinations.length > 0
			) {

				//TODO limit length

				const intermediatePlaces = [];

				const vias = queryNodes(doc, [serviceTag, 'ojp:Via', 'ojp:ViaPoint']);

				if(Array.isArray(vias) && vias.length > 0) {
					for(const via of vias){
						if( via.childNodes[1].localName === 'StopPointRef'||
	              via.childNodes[1].localName === 'StopPlaceRef') {

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

				for (const origin of origins) {


					let originId = null
						, originLon = null
						, originLat = null
						, originName = null;


					let originPlace;
          if( origin.childNodes[1].localName === 'PlaceRef' ) {
          	originPlace = origin.childNodes[1];
          }

					for (const childkey in originPlace.childNodes) {

						const child = originPlace.childNodes[childkey];

						if(child.localName === 'StopPointRef' || child.localName === 'StopPlaceRef'){

							originId = child.firstChild.data;

						}
						else if (child.localName === 'GeoPosition') {
							for (const key in child.childNodes){
								const c = child.childNodes[key];
								if (c.localName === 'Longitude') {
									originLon = c.firstChild.data;
								}
								else if (c.localName === 'Latitude') {
									originLat = c.firstChild.data;
								}
							}
						}
						else if (child.localName === 'LocationName'){
							for (const key in child.childNodes){
								const c = child.childNodes[key];
								if(c.localName === 'Text'){
									originName = c.firstChild.data;
								}
							}
						}
					}

					logger.info(`Origin ${originId}, ${originName}`);

					for (const destination of destinations) {
						let destinationId = null
							, destinationLon = null
							, destinationLat = null
							, destinationName = null;

						let destinationPlace;

	          if (destination.childNodes[1].localName === 'PlaceRef') {
	          	destinationPlace = destination.childNodes[1];
	          }

						for (const childkeyDst in destinationPlace.childNodes) {

							const child = destinationPlace.childNodes[childkeyDst];

							if(child.localName === 'StopPointRef' || child.localName === 'StopPlaceRef'){
								destinationId = child.firstChild.data;

							}
							else if(child.localName === 'GeoPosition'){
								for (const key in child.childNodes) {
									const c = child.childNodes[key];
									if (c.localName === 'Longitude') {
										destinationLon = c.firstChild.data;
									}
									else if (c.localName === 'Latitude') {
										destinationLat = c.firstChild.data;
									}
								}
							}
							else if (child.localName === 'LocationName'){
								for (const key in child.childNodes) {
									const c = child.childNodes[key];
									if (c.localName === 'Text') {
										destinationName = c.firstChild.data;
									}
								}
							}
						}

		        let origin_type = originId ? 'PointRef' : 'PlaceRef';
		        origin_type = originLat || originLon ? 'Position' : origin_type;

		        let destin_type = destinationId ? 'PointRef' : 'PlaceRef';
		        destin_type = destinationLat || destinationLon ? 'Position' : destin_type;

						logger.info(`Destination ${destinationLat}, ${destinationLon}, ${destinationId}, ${destinationName}`)

						const questionObj = {
							origin: originId || [originLon, originLat, originName || "Origin"],
							destination: destinationId || [destinationLon, destinationLat, destinationName || "Destination"],
							origin_type,
							destin_type,
          		date,
							limit: 1,
							arrivedBy,
							transfers: transferLimit,
							wheelchair: includeAccessibility,
							intermediatePlaces
						}
						const json = JSON.stringify(questionObj);
						
						//logger.debug('REQUEST',json)

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

						//const response = await doRequest(options, json);

						requests.push({
							options,
							json,
							questionObj
						});

						/*responses.push({
							'itineraries' : response.plan.itineraries, 
							startTime, 
							intermediateStops,
							config,
							'question': questionObj
						});*/

					} //end of destinations

				} //end for origins

				const maxReqs = Number(config.otp_max_parallel_requests) || config.default_otp_max_parallel_requests;

        const multiRequests = _.slice(requests, 0, maxReqs); //trunc max requests

				const multiResponses = await doMultiRequests(multiRequests);


				responses = multiResponses.map((resp, indexResp) => {
					const req = requests[indexResp]

					return {
						'itineraries': resp.plan.itineraries,
						startTime,
						intermediateStops,
						config,
						question: req.questionObj  //TODO include in returns inside doMultiRequests
					}
				})

				return createResponse(config, responses, startTime);
			}
			else{
				return createErrorResponse(serviceName, config.errors.notagcondition, startTime);
			}
		} catch (err) {
			logger.error(err);
			return createErrorResponse(serviceName, config.errors.noparsing, startTime);
		}
	}
}