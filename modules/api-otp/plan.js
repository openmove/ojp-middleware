const { request, GraphQLClient, gql } = require('graphql-request');
const moment = require('moment-timezone');
const https = require('https');

module.exports = {
  'planTrip': (config, origin, destination, date, extra) => {
    const options = {
      host: config.default.hostname,
      path: config.default.path + config.graphql.path,
      port: config.default.port
    };
    const endpoint = `https://${options.host}${options.path}`;
    const clientQL = new GraphQLClient(endpoint, { headers: config.default.headers });
    const query = gql`{
      plan(
        from: {lat: ${origin[1]}, lon: ${origin[0]}}, 
        to: {lat: ${destination[1]}, lon: ${destination[0]}}, 
        numItineraries: ${extra.limit || 3},
        date: ${moment(date).tz(extra.timezone || "Europe/Rome").format("YYYY-MM-DD")},
        time: ${moment(date).tz(extra.timezone || "Europe/Rome").format("HH:mm:ss")},
        ){
        date
        from {
          name
          lat
          lon
          stop {
            gtfsId
            name
            lat
            lon
          }
        }
        to{
          name
          lat
          lon
          stop {
            gtfsId
            name
            lat
            lon
          }
        }
        itineraries{
          startTime
          endTime
          duration
          waitingTime
          walkTime
          walkDistance
          legs {
            startTime
            endTime
            departureDelay
            arrivalDelay
            mode
            duration
            legGeometry{
              length
              points
            }
            agency{
              gtfsId
              name
            }
            realTime
            realtimeState
            distance
            transitLeg
            from {
              name
              lat
              lon
            }
            to {
              name
              lat
              lon
              
            }
            route{
              gtfsId
              shortName
              longName
            }
            trip{
              gtfsId
            }
            serviceDate
            intermediatePlaces {
              name
              lat
              lon
              arrivalTime
              departureTime
              stop {
                gtfsId
                name
                desc
              }
            }
          }
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
