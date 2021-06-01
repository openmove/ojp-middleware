const { request, GraphQLClient, gql } = require('graphql-request');
const https = require('https');

module.exports = {
  'getStopTimesById': (config, stopId, extra) => {
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
                  desc
                  code
                  vehicleMode
                  stoptimesWithoutPatterns(
                    startTime: ${extra.start || new Date().getTime()}, 
                    numberOfDepartures: ${extra.limit || 10}, 
                    omitNonPickups: true
                  ){
                    trip {
                      gtfsId,
                      tripHeadsign,
                      tripShortName,
                      directionId,          
                      route {
                        longName,
                        shortName
                        agency {
                          gtfsId,
                          name
                        }
                      }
                    },
                    headsign,
                    serviceDay,
                    scheduledArrival,
                    scheduledDeparture,
                    realtimeArrival,
                    realtimeDeparture,
                    stopSequence
                  }
                }
              }`
  
    clientQL.request(query, {})
        .catch((err) => {
          console.log("error", err)
          return {stop: null}
        })
        .then((data) => {

          return data;
        });
  
  }
}
