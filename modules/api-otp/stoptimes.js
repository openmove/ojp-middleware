const { request, GraphQLClient, gql } = require('graphql-request');

const _ = require('lodash');

module.exports = {
  'getStopTimesById': async (config, stopId, extra) => {

    const { logger } = config;

    const clientQL = new GraphQLClient(config.otp.baseUrl, { headers: config.otp.headers });

    const limit = Number(extra.limit || config.default_limit);

    const startime = ((extra.start || new Date().getTime()) / 1000).toFixed(0);

    const modes = extra.modes;

    //const transportModes = extra.modes.length > 0 ? `modes: "${modes.join(',')}"` : '';

    const query = gql`{
                stop (
                  id: "${stopId}"
                ) {
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
                      stoptimes {
                        stopSequence
                        scheduledDeparture
                        scheduledArrival
                        realtimeArrival
                        realtimeDeparture
                        stop {
                          gtfsId
                          name
                          lat
                          lon
                          zoneId
                          desc
                          code
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
              }`;

    logger.info('getTripsByIdAndDate');
    logger.debug(query);

    if(process.env['QUERY_DEBUG']) {
      console.log(query);
    }

    const data = await clientQL.request(query, {})

    //PATCH to filter by modes

    if(modes.length > 0 ) {
      data.stop.stoptimesWithoutPatterns = data.stop.stoptimesWithoutPatterns.filter(trip => {
        return modes.includes(trip.trip.route.mode);
      });
    }

    if(data!= null && data.stop){
      return {stop: data.stop};
    }
    return {
      stop: null
    }
  }
}
