const { request, GraphQLClient, gql } = require('graphql-request');
const https = require('https');

module.exports = {
  'getStopTimesById': async (config, stopId, extra) => {
    const options = {
      host: config.default.hostname,
      path: config.default.path + config.graphql.path,
      port: config.default.port
    };
    const endpoint = `https://${options.host}${options.path}`;
    const clientQL = new GraphQLClient(endpoint, { headers: config.default.headers });
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
                    numberOfDepartures: ${extra.limit || 10}, 
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
  
              console.log(query);
    const data = await clientQL.request(query, {})

    if(data!= null && data.stop){
      return {stop: data.stop};
    }
    return {
      stop: null
    }
  }
}
