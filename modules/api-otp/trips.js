const { request, GraphQLClient, gql } = require('graphql-request');

module.exports = {
  'getTripsByIdAndDate': async (config, tripId, date, extra) => {

    const {logger} = config;
    const clientQL = new GraphQLClient(config.otp.baseUrl, { headers: config.otp.headers });
    const query = gql`{
                trip (id: "${tripId}") {
                  gtfsId
                  tripHeadsign
                  route {
                    gtfsId
                    longName
                    shortName
                    mode
                    agency {
                      gtfsId
                      name
                      timezone
                    }
                  }
                  tripHeadsign
                  tripShortName
                  directionId   
                  departureStoptime {
                    stop {
                      gtfsId
                      name
                      desc
                    }
                  }
                  arrivalStoptime {
                    stop {
                      gtfsId
                      name
                      desc
                    }
                  }      
                  stoptimesForDate(serviceDate: "${date}"){
                    scheduledArrival
                    scheduledDeparture
                    realtime
                    realtimeArrival
                    realtimeDeparture
                    stopSequence
                    serviceDay
                    stop {
                      gtfsId
                      zoneId
                      lat
                      lon
                      name
                      desc
                      vehicleMode
                    }
                  }
                }
              }`;
  
    logger.debug(query);

    if(process.env['QUERY_DEBUG']) {
      console.log(query);
    }

    const data = await clientQL.request(query, {})

    if(data!= null && data.trip){
      return {trip: data.trip};
    }
    return {
      trip: null
    }
  }
}
