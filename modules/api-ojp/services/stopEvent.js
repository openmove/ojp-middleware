const xmlbuilder = require('xmlbuilder');
const qstr = require('querystring');
const _ = require('lodash');
const moment = require('moment-timezone');
const { v4: uuidv4 } = require('uuid');

const {queryNode, queryNodes, queryText, queryTags} = require('../lib/query');
const {doRequest} = require('../lib/request');
const {parseParamsRestrictions} = require('../lib/restrictions');
const {createErrorResponse} = require('../lib/response');

const serviceName = 'OJPStopEvent';

const createResponse = (stop, startTime, isDeparture, isArrival, realtimeData) => {

  const now = new Date()
    , tag = xmlbuilder.create(`ojp:${serviceName}Delivery`);
  tag.ele('siri:ResponseTimestamp', now.toISOString());
  tag.ele('ojp:CalcTime', now.getTime() - startTime);
  
  if(stop === null || stop.stoptimesWithoutPatterns.length === 0){
    tag.ele('siri:Status', false);
    const err = tag.ele('siri:ErrorCondition');
    err.ele('siri:OtherError')
    err.ele('siri:Description', 'STOPEVENT_LOCATION_UNSERVED');
  } else {
    tag.ele('siri:Status', true);
    const context = tag.ele('ojp:StopEventResponseContext');
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
      const eventresponse = tag.ele('ojp:StopEventResult');
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
      service.ele('siri:DirectionRef', schedule.trip.directionId);
      service.ele('ojp:PublishedLineName').ele('ojp:Text', schedule.trip.route.longName || schedule.trip.route.shortName || schedule.trip.route.gtfsId)
      service.ele('ojp:OperatorRef', schedule.trip.route.agency.gtfsId);
      service.ele('ojp:OriginStopPointRef', schedule.trip.departureStoptime.stop.gtfsId);
      service.ele('ojp:OriginText').ele('ojp:Text', `${schedule.trip.departureStoptime.stop.name}`);
      service.ele('ojp:DestinationStopPointRef', schedule.trip.arrivalStoptime.stop.gtfsId);
      service.ele('ojp:DestinationText').ele('ojp:Text', `${schedule.trip.arrivalStoptime.stop.name}`);
    }
  }

  return tag;
}

module.exports = {
  'eventExecution' : async (doc, startTime, config) => {
    
    const serviceTag = `ojp:${serviceName}Request`;

    const {logger} = config;

    try{

      const { limit, skip, ptModes } = parseParamsRestrictions(doc, serviceTag, config);

      if(queryNodes(doc, [serviceTag, 'ojp:Location', 'ojp:PlaceRef']).length > 0) {

        let stopId = queryTags(doc, [serviceTag, 'ojp:Location', 'ojp:PlaceRef', 'ojp:StopPlaceRef']);

        if(stopId == null){
          stopId = queryTags(doc, [serviceTag, 'ojp:Location', 'ojp:PlaceRef', 'ojp:StopPointRef']);
        }

        const date = queryTags(doc, [serviceTag, 'ojp:Location', 'ojp:DepArrTime']);

        let startDate = new Date().getTime();
        if(date != null){
          startDate = new Date(date).getTime();
        }
        
        const querystr = qstr.stringify({limit, skip, start: startDate})
            , options = {
              host: config['api-otp'].host,
              port: config['api-otp'].port,
              path: `/stops/${stopId}/details?${querystr}`,
              method: 'GET',
              json:true
            };
        
        logger.info(options);

        const response = await doRequest(options);

        let isDeparture = true;
        let isArrival = false;
        let showRealtime = false;

        const eventType = queryTags(doc, [serviceTag, 'ojp:Params', 'ojp:StopEventType']);
        const realtime = queryTags(doc, [serviceTag, 'ojp:Params', 'ojp:IncludeRealtimeData']);

        if(eventType === 'arrival'){
          isDeparture = false;
          isArrival = true;
        }

        if(eventType === 'both'){
          isDeparture = true;
          isArrival = true;
        }
        showRealtime = realtime === 'true';
        return createResponse(response.stop, startTime, isDeparture, isArrival, showRealtime);
      }
      else{
        return createErrorResponse(serviceName, config.errors.notagcondition, startTime);
      }
    }catch(err){
      logger.info(err);
      return createErrorResponse(serviceName, config.errors.noparsing, startTime);
    }
    
  }
}