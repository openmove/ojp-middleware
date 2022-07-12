const xmlbuilder = require('xmlbuilder');
const qstr = require('querystring');
const _ = require('lodash');
const moment = require('moment-timezone');
const { MongoClient } = require("mongodb");
const { queryNode, queryNodes, queryText, queryTags } = require('../lib/query');
const { doRequest } = require('../lib/request');
const { parseParamsRestrictions } = require('../lib/restrictions');
const { createErrorResponse, ptModesResponse, precisionMeters } = require('../lib/response');

const serviceName = 'OJPTripInfo';

const createResponse = (config,
												trip,
												date,
												startTime,
												includeCalls = true,
												includeService = true) => {

  const { location_digits } = config;

  const positionPrecision = precisionMeters(config);

  const now = new Date()
      , tag = xmlbuilder.create(`ojp:${serviceName}Delivery`);
  tag.ele('siri:ResponseTimestamp', now.toISOString());
  tag.ele('ojp:CalcTime', now.getTime() - startTime);
  
  if(trip === null || trip.stoptimesForDate.length === 0) {
    tag.ele('siri:Status', false);
    const err = tag.ele('siri:ErrorCondition');
    err.ele('siri:OtherError')
    err.ele('siri:Description', config.errors.noresults.tripinfo);
  }
  else {
    tag.ele('siri:Status', true);
    const context = tag.ele('ojp:TripInfoResponseContext');
		const loc = context.ele('ojp:Places');
		const tripResponse = tag.ele('ojp:TripInfoResult');
    const stopsIds = [];
		
    for(const schedule of trip.stoptimesForDate) {
      const stop = schedule.stop;
			const realtimeData = schedule.realtime;

			if(stopsIds.indexOf(stop.gtfsId) === -1) {
				stopsIds.push(stop.gtfsId);
				
				const place = loc.ele('ojp:Location');
				const stopPlace = place.ele('ojp:StopPlace');
				stopPlace.ele('ojp:StopPlaceRef', stop.gtfsId);
				stopPlace.ele('ojp:StopPlaceName').ele('ojp:Text', `${stop.name}`);
				stopPlace.ele('ojp:TopographicPlaceRef', stop.zoneId);
				place.ele('ojp:LocationName').ele('ojp:Text', `${stop.name}`);

		    const geo = place.ele('ojp:GeoPosition');
		    geo.ele('siri:Longitude', _.round(stop.lon, location_digits) );
		    geo.ele('siri:Latitude', _.round(stop.lat, location_digits) );
			}


			if(includeCalls) {
				const timeStop = (schedule.serviceDay + schedule.scheduledDeparture) * 1000;
				const now = new Date().getTime();
	
				let isOnward = false;
				if(now < timeStop) {
					isOnward = true;
				}
	
				const arrivalStopId = trip.arrivalStoptime.stop.gtfsId;
	
				
				let call = null;
				if(isOnward) {
					call = tripResponse.ele('ojp:OnwardCall')
				}else{
					call = tripResponse.ele('ojp:PreviousCall')
				}			
				call.ele('siri:StopPointRef', stop.gtfsId);
				call.ele('ojp:StopPointName').ele('ojp:Text', `${stop.name}`);
				if(stop.gtfsId != arrivalStopId) {
					const dep = call.ele('ojp:ServiceDeparture');
					dep.ele('ojp:TimetabledTime', moment((schedule.serviceDay + schedule.scheduledDeparture) * 1000).tz(trip.route.agency.timezone).toISOString());
					if(realtimeData) {
						dep.ele('ojp:EstimatedTime', moment((schedule.serviceDay + schedule.realtimeDeparture) * 1000).tz(trip.route.agency.timezone).toISOString());
					}
				}else{
					const arr = call.ele('ojp:ServiceArrival');
					arr.ele('ojp:TimetabledTime', moment((schedule.serviceDay + schedule.scheduledArrival) * 1000).tz(trip.route.agency.timezone).toISOString());
					if(realtimeData) {
						arr.ele('ojp:EstimatedTime', moment((schedule.serviceDay + schedule.realtimeArrival) * 1000).tz(trip.route.agency.timezone).toISOString());
					}
				}
				
				call.ele('ojp:Order', schedule.stopSequence)        
			}
			
    }
		if(includeService) {
			const service = tripResponse.ele('ojp:Service');
			service.ele('ojp:OperatingDayRef', moment(date, "YYYYMMDD").tz(trip.route.agency.timezone).format("YYYY-MM-DD"));
			service.ele('ojp:JourneyRef', trip.gtfsId);
			service.ele('siri:LineRef', trip.route.gtfsId);

			const mode = service.ele('ojp:Mode');

      const ojpMode = ptModesResponse( trip.route.mode );

      mode.ele('ojp:PtMode', ojpMode);

			service.ele('ojp:PublishedLineName').ele('ojp:Text', trip.route.longName || trip.route.shortName || trip.route.gtfsId)
			service.ele('ojp:OperatorRef', trip.route.agency.gtfsId);
			service.ele('ojp:OriginStopPointRef', trip.departureStoptime.stop.gtfsId);
			service.ele('ojp:OriginText').ele('ojp:Text', `${trip.departureStoptime.stop.name}`);
			service.ele('ojp:DestinationStopPointRef', trip.arrivalStoptime.stop.gtfsId);
			service.ele('ojp:DestinationText').ele('ojp:Text', `${trip.arrivalStoptime.stop.name}`);
		}		
  }

  return tag;
}

module.exports = {
	'tripInfoExecution' : async (doc, startTime, config) => {

		const serviceTag = `ojp:${serviceName}Request`;
		
		const {logger} = config;

    try {
			if(
        queryNodes(doc, [serviceTag, 'ojp:JourneyRef']).length > 0 &&
        queryNodes(doc, [serviceTag, 'ojp:OperatingDayRef']).length > 0
        ) {
					const tripId = queryTags(doc, [serviceTag, 'ojp:JourneyRef']);
					const date = queryTags(doc, [serviceTag, 'ojp:OperatingDayRef']);

					const options = {
						host: config['api-otp'].host,
						port: config['api-otp'].port,
						path: `/trip/${tripId}/${moment(date, 'YYYY-MM-DD').format('YYYYMMDD')}`,
						json: true,
						method: 'GET'
					}
					const response = await doRequest(options)   

					logger.info(response);

					const includeServiceString = queryTags(doc, [
						serviceTag,
						'ojp:Params',
						'ojp:IncludeService'
					]);
			
					const includeCallsString = queryTags(doc, [
						serviceTag,
						'ojp:Params',
						'ojp:IncludeCalls'
					]);

					return createResponse(config, response.trip, date, startTime, includeCallsString === 'true', includeServiceString === 'true');

				}else{
					return createErrorResponse(serviceName, config.errors.notagcondition, startTime);
				}
		} catch (err) {
      logger.error(err);
      return createErrorResponse(serviceName, config.errors.noparsing, startTime);
    }
	}
}