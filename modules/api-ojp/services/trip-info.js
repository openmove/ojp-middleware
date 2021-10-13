const xmlbuilder = require('xmlbuilder');
const qstr = require('querystring');
const _ = require('lodash');
const moment = require('moment-timezone');
const mongoClient = require("mongodb").MongoClient;
const {queryNode, queryNodes, queryText, queryTags} = require('../lib/query');
const {doRequest} = require('../lib/request');
const {parseParamsRestrictions} = require('../lib/restrictions');

const createTripInfoResponse = (trip, date, startTime) => {
  const responseTimestamp = new Date().toISOString();
  const calcTime = (new Date().getTime()) - startTime
  const tripInfo = xmlbuilder.create('ojp:OJPTripInfoDelivery');
  tripInfo.ele('siri:ResponseTimestamp', responseTimestamp);
  
  tripInfo.ele('ojp:CalcTime', calcTime);
  
  if(trip === null || trip.stoptimesForDate.length === 0){
    tripInfo.ele('siri:Status', false);
    const err = tripInfo.ele('siri:ErrorCondition');
    err.ele('siri:OtherError')
    err.ele('siri:Description', 'TRIPINFO_TRIP_UNAVAILABLE');
  } else {
    tripInfo.ele('siri:Status', true);
    const context = tripInfo.ele('ojp:TripInfoResponseContext');
		const loc = context.ele('ojp:Places');
		const tripResponse = tripInfo.ele('ojp:TripInfoResult');
    const stopsIds = [];
		
    for(const schedule of trip.stoptimesForDate){
      const stop = schedule.stop;
			const realtimeData = schedule.realtime;

			if(stopsIds.indexOf(stop.gtfsId) === -1){
				stopsIds.push(stop.gtfsId);
				
				const place = loc.ele('ojp:Location');
				const stopPlace = place.ele('ojp:StopPlace');
				stopPlace.ele('ojp:StopPlaceRef', stop.gtfsId);
				stopPlace.ele('ojp:StopPlaceName').ele('ojp:Text', `${stop.name}`);
				stopPlace.ele('ojp:TopographicPlaceRef', stop.zoneId);
				place.ele('ojp:LocationName').ele('ojp:Text', `${stop.name}`);
				const geo = place.ele('ojp:GeoPosition');
				geo.ele('siri:Longitude', stop.lon);
				geo.ele('siri:Latitude', stop.lat);
			}

			const timeStop = (schedule.serviceDay + schedule.scheduledDeparture) * 1000;
			const now = new Date().getTime();

			let isOnward = false;
			if(now < timeStop){
				isOnward = true;
			}

			const arrivalStopId = trip.arrivalStoptime.stop.gtfsId;


      let call = null;
			if(isOnward){
				call = tripResponse.ele('ojp:OnwardCall')
			}else{
				call = tripResponse.ele('ojp:PreviousCall')
			}			
      call.ele('siri:StopPointRef', stop.gtfsId);
      call.ele('ojp:StopPointName').ele('ojp:Text', `${stop.name}`);
      if(stop.gtfsId != arrivalStopId){
        const dep = call.ele('ojp:ServiceDeparture');
        dep.ele('ojp:TimetabledTime', moment((schedule.serviceDay + schedule.scheduledDeparture) * 1000).tz(trip.route.agency.timezone).toISOString());
        if(realtimeData){
          dep.ele('ojp:EstimatedTime', moment((schedule.serviceDay + schedule.realtimeDeparture) * 1000).tz(trip.route.agency.timezone).toISOString());
        }
      }else{
				const arr = call.ele('ojp:ServiceArrival');
        arr.ele('ojp:TimetabledTime', moment((schedule.serviceDay + schedule.scheduledArrival) * 1000).tz(trip.route.agency.timezone).toISOString());
        if(realtimeData){
          arr.ele('ojp:EstimatedTime', moment((schedule.serviceDay + schedule.realtimeArrival) * 1000).tz(trip.route.agency.timezone).toISOString());
        }
			}
      
      call.ele('ojp:Order', schedule.stopSequence)        
    }
		const service = tripResponse.ele('ojp:Service');
		service.ele('ojp:OperatingDayRef', moment(date, "YYYYMMDD").tz(trip.route.agency.timezone).format("YYYY-MM-DD"));
		service.ele('ojp:JourneyRef', trip.gtfsId);
		service.ele('siri:LineRef', trip.route.gtfsId);
		const mode = service.ele('ojp:Mode');
		mode.ele('ojp:PtMode', trip.route.mode.toLowerCase());
		service.ele('siri:DirectionRef', trip.directionId);
		service.ele('ojp:PublishedLineName').ele('ojp:Text', trip.route.longName || trip.route.shortName || trip.route.gtfsId)
		service.ele('ojp:OperatorRef', trip.route.agency.gtfsId);
		service.ele('ojp:OriginStopPointRef', trip.departureStoptime.stop.gtfsId);
		service.ele('ojp:OriginText').ele('ojp:Text', `${trip.departureStoptime.stop.name}`);
		service.ele('ojp:DestinationStopPointRef', trip.arrivalStoptime.stop.gtfsId);
		service.ele('ojp:DestinationText').ele('ojp:Text', `${trip.arrivalStoptime.stop.name}`);
  }

  return tripInfo;
}

const createTripInfoErrorResponse = (errorCode, startTime) => {
  const responseTimestamp = new Date().toISOString();
  const calcTime = (new Date().getTime()) - startTime
  const trip = xmlbuilder.create('ojp:OJPTripInfoDelivery');
  trip.ele('siri:ResponseTimestamp', responseTimestamp);
  trip.ele('siri:Status', false);
  trip.ele('ojp:CalcTime', calcTime);

  const err = trip.ele('siri:ErrorCondition');
  err.ele('siri:OtherError')
  err.ele('siri:Description', errorCode);

  return trip;
}

//TODO
module.exports = {
	'tripInfoExecution' : async (doc, startTime, config) => {

		const serviceTag = 'ojp:OJPTripInfoRequest';   //replace
		
		const {logger} = config;

    try {
			if(
        queryNodes(doc, "//*[name()='ojp:OJPTripInfoRequest']/*[name()='ojp:JourneyRef']").length > 0
        &&
        queryNodes(doc, "//*[name()='ojp:OJPTripInfoRequest']/*[name()='ojp:OperatingDayRef']").length > 0
        ){
					const tripId = queryText(doc, "//*[name()='ojp:OJPTripInfoRequest']/*[name()='ojp:JourneyRef']");
					const date = queryText(doc, "//*[name()='ojp:OJPTripInfoRequest']/*[name()='ojp:OperatingDayRef']");

					console.log(tripId, date)

					const options = {
						host: config['api-otp'].host,
						port: config['api-otp'].port,
						path: `/trip/${tripId}/${date.replace(/-/g, '')}`,
						json: true,
						method: 'GET'
					}
					const response = await doRequest(options)   
					logger.info(response)
					return createTripInfoResponse(response.trip, date, startTime);

				}else{
					return createTripInfoErrorResponse('UNSUPPORTED', startTime);
				}
		} catch (err){
      logger.error(err);
      return createTripInfoErrorResponse('E0002', startTime);
    }
	}
}