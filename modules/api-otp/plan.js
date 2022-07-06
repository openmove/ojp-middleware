const { request, GraphQLClient, gql } = require('graphql-request');
const moment = require('moment-timezone');

module.exports = {
  'planTrip': async(config, origin, destination, date, extra) => {

    const clientQL = new GraphQLClient(config.otp.baseUrl, { headers: config.otp.headers });

    let from = null
      , to = null
      , modes = [];

    if(Array.isArray(origin)){
      from = `from: {lat: ${origin[1]}, lon: ${origin[0]}, address: "${origin[2]}"}`;   
    }else{
      from = `fromPlace: "${origin}"`; 
    }

    if(Array.isArray(destination)){
      to = `to: {lat: ${destination[1]}, lon: ${destination[0]}, address: "${destination[2]}"}`
    }else{
      to = `toPlace: "${destination}"`
    }

    const intermediatePlacesStrings = [];
    for(const iplace of extra.intermediatePlaces){
      if(Array.isArray(iplace)){
        intermediatePlacesStrings.push(`{lat: ${iplace[1]}, lon: ${iplace[0]}, address: "${iplace[2] || 'Via-Point'}"}`);
      }else{
        const stopQuery = gql`{
          stop (id:"${iplace}"){
            lat
            lon
            name
          }
        }`
        const data = await clientQL.request(stopQuery, {});
        if(data.stop != null){
          intermediatePlacesStrings.push(`{lat: ${data.stop.lat}, lon: ${data.stop.lon}, address: "${data.stop.name}"}`);
        }
      }
    }

    if(Array.isArray(extra.modes)) {
      modes = extra.modes;
    }

    const intermediatePlacesQuery = intermediatePlacesStrings.length>0 ? `intermediatePlaces: [${intermediatePlacesStrings.join(",")}],` : '';

    //TODO when otp support https://github.com/openmove/OpenTripPlanner/issues/12
    //modes = modes.map(M => {return `{mode: ${M}}`});
    //const transportModes = modes.length > 0 ? `transportModes: [${modes.join(',')}]` : '';*/

    const transportModes = modes.length > 0 ? `modes: "${modes.join(',')}"` : '';

    const query = gql`{
      plan(
        ${from}, 
        ${to}, 
        numItineraries: ${extra.limit || 5},
        date: "${moment(date).tz(extra.timezone || "Europe/Rome").format("YYYY-MM-DD")}",
        time: "${moment(date).tz(extra.timezone || "Europe/Rome").format("HH:mm:ss")}",
        arriveBy: ${extra.arriveBy || false},
        maxTransfers: ${extra.transfers || 2},
        wheelchair: ${extra.wheelchair || false},
        ${intermediatePlacesQuery}
        ${transportModes}
        ) {
        date
        from {
          name
          stop {
            gtfsId
            name
            lat
            lon
          }
        }
        to {
          name
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
            distance
            transitLeg
            from {
              name
              lat
              lon
              stop {
                gtfsId
                name
                desc
                lat
                lon
              }
            }
            to {
              name
              lat
              lon
              stop {
                gtfsId
                name
                desc
                lat
                lon
              }
            }
            route{
              gtfsId
              shortName
              longName
              agency {
                gtfsId
                name
                timezone
              }
            }
            trip{
              gtfsId
              directionId   
              departureStoptime {
                stop {
                  gtfsId
                  name
                  desc
                  lat
                  lon
                }
              }
              arrivalStoptime {
                stop {
                  gtfsId
                  name
                  desc
                  lat
                  lon
                }
              }   
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
                lat
                lon
              }
            }
          }
        }
      }
    }`

    if(process.env['QUERY_DEBUG']) {
      console.log(query);
    }
    try{
      return await clientQL.request(query, {});
    }catch(err){
      config.logger.error(err);
      return {};
    }    
  }
}
