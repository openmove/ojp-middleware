const { request, GraphQLClient, gql } = require('graphql-request');

module.exports = {
  'getStopTimesById': async (config, stopId, extra) => {
    const {logger} = config;

    const clientQL = new GraphQLClient(config.otp.baseUrl, { headers: config.otp.headers });

    const maxResults = Number(extra.limit || config.default_max_results);

    const query = gql`{
                stop(id: "${stopId}"){
                  gtfsId,
                  name
                  lat
                  lon
                  zoneId
                  desc
                  code
                  vehicleMode
                  stoptimesWithoutPatterns(
                    startTime: ${((extra.start || new Date().getTime()) / 1000).toFixed(0)}, 
                    numberOfDepartures: ${maxResults},
                    omitNonPickups: true
                  ){
                    trip {
                      gtfsId
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
                    },
                    headsign,
                    serviceDay
                    scheduledArrival
                    scheduledDeparture
                    realtimeArrival
                    realtimeDeparture
                    stopSequence
                  }
                }
              }`
  
    logger.debug(query);

    const data = await clientQL.request(query, {})

    if(data!= null && data.stop){
      return {stop: data.stop};
    }
    return {
      stop: null
    }
  }
}
