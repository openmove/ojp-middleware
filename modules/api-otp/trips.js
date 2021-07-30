const { request, GraphQLClient, gql } = require('graphql-request');
const https = require('https');

module.exports = {
  'getTripsByIdAndDate': async (config, tripId, date, extra) => {
    const options = {
      host: config.otp.hostname,
      path: config.otp.path + config.graphql.path,
      port: config.otp.port
    };
    const {logger} = config;
    const endpoint = `https://${options.host}${options.path}`;
    const clientQL = new GraphQLClient(endpoint, { headers: config.otp.headers });
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
    const data = await clientQL.request(query, {})

    if(data!= null && data.trip){
      return {trip: data.trip};
    }
    return {
      trip: null
    }
  }
}
