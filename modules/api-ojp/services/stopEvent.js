const xmlbuilder = require('xmlbuilder');
const qstr = require('querystring');
const _ = require('lodash');
const moment = require('moment-timezone');
const { v4: uuidv4 } = require('uuid');

const {queryNode, queryNodes, queryText, queryTags} = require('../lib/query');
const {parseParamsRestrictions} = require('../lib/restrictions');

const {doRequest, ptModesRequest} = require('../lib/request');
const {createErrorResponse, ptModesResponse} = require('../lib/response');

const serviceName = 'OJPStopEvent';

const createResponse = (config,
                        stop,
                        startTime,
                        isDeparture,
                        isArrival,
                        realtimeData,
                        previousStop = false, /* IncludePreviousCalls */
                        nextStop = false      /* IncludeOnwardCalls */
                      ) => {

  const {location_digits} = config;

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
    geo.ele('siri:Longitude', _.round(stop.lon, location_digits) );
    geo.ele('siri:Latitude', _.round(stop.lat, location_digits) );

    const stopsIds = [];
    stopsIds.push(stop.gtfsId);
    for(const schedule of stop.stoptimesWithoutPatterns){
      const eventresponse = tag.ele('ojp:StopEventResult');
      eventresponse.ele('ojp:ResultId', uuidv4())
      const stopevent = eventresponse.ele('ojp:StopEvent');

      for(const sequenceStop of schedule.trip.stoptimes){

        if(previousStop && (sequenceStop.stopSequence < schedule.stopSequence)) {

          if(stopsIds.indexOf(sequenceStop.stop.gtfsId) === -1){
            stopsIds.push(sequenceStop.stop.gtfsId);
            const previousPlace = loc.ele('ojp:Location');
            const stopPlace = previousPlace.ele('ojp:StopPlace');
            stopPlace.ele('ojp:StopPlaceRef', sequenceStop.stop.gtfsId);
            stopPlace.ele('ojp:StopPlaceName').ele('ojp:Text', `${sequenceStop.stop.name}`);
            stopPlace.ele('ojp:TopographicPlaceRef', sequenceStop.stop.zoneId);
            previousPlace.ele('ojp:LocationName').ele('ojp:Text', `${sequenceStop.stop.name}`);

            const geo = previousPlace.ele('ojp:GeoPosition');
            geo.ele('siri:Longitude', _.round(sequenceStop.stop.lon, location_digits) );
            geo.ele('siri:Latitude', _.round(sequenceStop.stop.lat, location_digits) );
          }


          const previousCall = stopevent.ele('ojp:PreviousCall').ele('ojp:CallAtStop');
          previousCall.ele('siri:StopPointRef', sequenceStop.stop.gtfsId);
          previousCall.ele('ojp:StopPointName').ele('ojp:Text', `${sequenceStop.stop.name}`);


          const arr = previousCall.ele('ojp:ServiceArrival');
          arr.ele('ojp:TimetabledTime', moment((schedule.serviceDay + sequenceStop.scheduledArrival) * 1000).tz(schedule.trip.route.agency.timezone).toISOString());
          if(realtimeData){
            arr.ele('ojp:EstimatedTime', moment((schedule.serviceDay + sequenceStop.realtimeArrival) * 1000).tz(schedule.trip.route.agency.timezone).toISOString());
          }

          const dep = previousCall.ele('ojp:ServiceDeparture');
          dep.ele('ojp:TimetabledTime', moment((schedule.serviceDay + sequenceStop.scheduledDeparture) * 1000).tz(schedule.trip.route.agency.timezone).toISOString());
          if(realtimeData){
            dep.ele('ojp:EstimatedTime', moment((schedule.serviceDay + sequenceStop.realtimeDeparture) * 1000).tz(schedule.trip.route.agency.timezone).toISOString());
          }

          previousCall.ele('ojp:Order', sequenceStop.stopSequence)
        }

        //
        // START ThisCall
        //
        if(sequenceStop.stopSequence === schedule.stopSequence) {

          const call = stopevent.ele('ojp:ThisCall').ele('ojp:CallAtStop');
          call.ele('siri:StopPointRef', stop.gtfsId);
          call.ele('ojp:StopPointName').ele('ojp:Text', `${stop.name}`);

          if(isDeparture) {
            const dep = call.ele('ojp:ServiceDeparture');
            dep.ele('ojp:TimetabledTime', moment((schedule.serviceDay + schedule.scheduledDeparture) * 1000).tz(schedule.trip.route.agency.timezone).toISOString());
            if(realtimeData){
              dep.ele('ojp:EstimatedTime', moment((schedule.serviceDay + schedule.realtimeDeparture) * 1000).tz(schedule.trip.route.agency.timezone).toISOString());
            }
          }

          if(isArrival) {
            const arr = call.ele('ojp:ServiceArrival');
            arr.ele('ojp:TimetabledTime', moment((schedule.serviceDay + schedule.scheduledArrival) * 1000).tz(schedule.trip.route.agency.timezone).toISOString());
            if(realtimeData){
              arr.ele('ojp:EstimatedTime', moment((schedule.serviceDay + schedule.realtimeArrival) * 1000).tz(schedule.trip.route.agency.timezone).toISOString());
            }
          }
          call.ele('ojp:Order', schedule.stopSequence)
        }
        //
        //END ThisCall
        //

        if(nextStop && (sequenceStop.stopSequence > schedule.stopSequence)){
          if(stopsIds.indexOf(sequenceStop.stop.gtfsId) === -1){
            stopsIds.push(sequenceStop.stop.gtfsId);
            const onWardPlace = loc.ele('ojp:Location');
            const stopPlace = onWardPlace.ele('ojp:StopPlace');
            stopPlace.ele('ojp:StopPlaceRef', sequenceStop.stop.gtfsId);
            stopPlace.ele('ojp:StopPlaceName').ele('ojp:Text', `${sequenceStop.stop.name}`);
            stopPlace.ele('ojp:TopographicPlaceRef', sequenceStop.stop.zoneId);
            onWardPlace.ele('ojp:LocationName').ele('ojp:Text', `${sequenceStop.stop.name}`);

            const geo = onWardPlace.ele('ojp:GeoPosition');
            geo.ele('siri:Longitude', _.round(sequenceStop.stop.lon, location_digits) );
            geo.ele('siri:Latitude', _.round(sequenceStop.stop.lat, location_digits) );
          }

          const onWardCall = stopevent.ele('ojp:OnwardCall').ele('ojp:CallAtStop');
          onWardCall.ele('siri:StopPointRef', sequenceStop.stop.gtfsId);
          onWardCall.ele('ojp:StopPointName').ele('ojp:Text', `${sequenceStop.stop.name}`);

          const arr = onWardCall.ele('ojp:ServiceArrival');
          arr.ele('ojp:TimetabledTime', moment((schedule.serviceDay + sequenceStop.scheduledArrival) * 1000).tz(schedule.trip.route.agency.timezone).toISOString());
          if(realtimeData){
            arr.ele('ojp:EstimatedTime', moment((schedule.serviceDay + sequenceStop.realtimeArrival) * 1000).tz(schedule.trip.route.agency.timezone).toISOString());
          }

          const dep = onWardCall.ele('ojp:ServiceDeparture');
          dep.ele('ojp:TimetabledTime', moment((schedule.serviceDay + sequenceStop.scheduledDeparture) * 1000).tz(schedule.trip.route.agency.timezone).toISOString());
          if(realtimeData){
            dep.ele('ojp:EstimatedTime', moment((schedule.serviceDay + sequenceStop.realtimeDeparture) * 1000).tz(schedule.trip.route.agency.timezone).toISOString());
          }

          onWardCall.ele('ojp:Order', sequenceStop.stopSequence)
        }
      }

      const service = stopevent.ele('ojp:Service');
      service.ele('ojp:OperatingDayRef', moment(schedule.serviceDay * 1000).tz(schedule.trip.route.agency.timezone).format("YYYY-MM-DD"));
      service.ele('ojp:JourneyRef', schedule.trip.gtfsId);
      service.ele('siri:LineRef', schedule.trip.route.gtfsId);

      const mode = service.ele('ojp:Mode');
      const ojpMode = ptModesResponse( stop.vehicleMode );
      mode.ele('ojp:PtMode', ojpMode);

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

      const { limit, skip, ptModes, ptModeFilter, ptModeExclude } = parseParamsRestrictions(doc, serviceTag, config);

      const modes = ptModesRequest(ptModeFilter, ptModeExclude);  //convert siri to otp modes

      if(queryNodes(doc, [serviceTag, 'ojp:Location', 'ojp:PlaceRef']).length > 0) {

        let stopId = queryTags(doc, [serviceTag, 'ojp:Location', 'ojp:PlaceRef', 'ojp:StopPlaceRef']);

        if(stopId == null){
          stopId = queryTags(doc, [serviceTag, 'ojp:Location', 'ojp:PlaceRef', 'StopPointRef']);
          //don't add ojp: in tag StopPointRef
        }

        const date = queryTags(doc, [serviceTag, 'ojp:Location', 'ojp:DepArrTime']);

        let startDate = new Date().getTime();
        if(date != null){
          startDate = new Date(date).getTime();
        }

        const querystr = qstr.stringify({limit, skip, start: startDate, modes});
        const path = `/stops/${stopId}/details?${querystr}`;
        const options = {
              host: config['api-otp'].host,
              port: config['api-otp'].port,
              path,
              method: 'GET',
              json:true
            };
        
        logger.info(options);

        const response = await doRequest(options);

        const includePreviousStopsString = queryTags(doc, [
          serviceTag,
          'ojp:Params',
          'ojp:IncludePreviousCalls'
        ]);
    
        const includeNextStopsString = queryTags(doc, [
          serviceTag,
          'ojp:Params',
          'ojp:IncludeOnwardCalls'
        ]);

        let isDeparture = true;
        let isArrival = false;
        let showRealtime = false;
        let includePreviousStops = includePreviousStopsString === 'true';
        let includeNextStops = includeNextStopsString === 'true';

        const eventType = queryTags(doc, [serviceTag, 'ojp:Params', 'ojp:StopEventType']);
        const realtime = queryTags(doc, [serviceTag, 'ojp:Params', 'ojp:IncludeRealtimeData']);

        if(eventType === 'arrival') {
          isDeparture = false;
          isArrival = true;
        }

        if(eventType === 'both') {
          isDeparture = true;
          isArrival = true;
        }

        if(eventType === 'departure') {
          isDeparture = true;
          isArrival = false;
        }

        showRealtime = realtime === 'true';
        return createResponse(config,
                              response.stop,
                              startTime,
                              isDeparture,
                              isArrival,
                              showRealtime,
                              includePreviousStops, // IncludePreviousCalls
                              includeNextStops      // IncludeOnwardCalls
                            );
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