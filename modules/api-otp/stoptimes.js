const { request, GraphQLClient, gql } = require('graphql-request');

module.exports = {
  'getStopTimesById': async (config, stopId, extra) => {
    const {logger} = config;

    const clientQL = new GraphQLClient(config.otp.baseUrl, { headers: config.otp.headers });

    const limit = Number(extra.limit || config.default_limit);

    const startime = ((extra.start || new Date().getTime()) / 1000).toFixed(0);

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
                    startTime: "${startime}",
                    numberOfDepartures: ${limit},
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

    if(process.env['QUERY_DEBUG']) {
      console.log(query);
    }

    const data = await clientQL.request(query, {})

    if(data!= null && data.stop){
      return {stop: data.stop};
    }
    return {
      stop: null
    }
  }
}
