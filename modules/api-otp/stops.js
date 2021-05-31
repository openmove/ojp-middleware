const { request, GraphQLClient, gql } = require('graphql-request');
const https = require('https');

module.exports = {
  'getStopById': (config, stopId, extra) => {
    const options = {
      host: config.default.hostname,
      path: config.default.path + config.graphql.path,
      port: config.default.port
    };
    const endpoint = `https://${options.host}${options.path}`;
    const clientQL = new GraphQLClient(endpoint, { headers: config.default.headers });
    let filter = `stops (ids : ["${stopId}")`;
    if(!stopId) {
      filter = `stops (maxResults: ${extra.limit || 10})`;
    }
    const query = gql`
                {
                ${filter} {
                  gtfsId
                  name
                  code
                  desc
                  lat
                  lon
                  wheelchairBoarding
                  routes {
                    mode
                  }
                }
              }`
  
    clientQL.request(query, {})
        .catch((err) => {
          console.log("error", err)
          return []
        })
        .then((data) => {

          const res = {
            stops : data.stops.slice(0, extra.limit || 10)
          }
          console.log("result", res);
          return res;
        });
  
  }
}
