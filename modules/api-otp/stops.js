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
                  vehicleMode
                }
              }`
  
    clientQL.request(query, {})
        .catch((err) => {
          console.log("error", err)
          return {stops: []}
        })
        .then((data) => {

          const res = {
            stops : data.stops.slice(0, extra.limit || 10)
          }
          console.log("result", res);
          return res;
        });
  
  },
  'searchByName': (config, name, extra) => {
    const options = {
      host: config.default.hostname,
      path: config.default.path + config.graphql.path,
      port: config.default.port
    };
    const endpoint = `https://${options.host}${options.path}`;
    const clientQL = new GraphQLClient(endpoint, { headers: config.default.headers });
    
    const query = gql`
                {
                stopsByName (name : "${name}", maxResults: ${extra.limit || 10}) {
                  gtfsId
                  name
                  code
                  desc
                  lat
                  lon
                  vehicleMode
                }
              }`
  
    clientQL.request(query, {})
        .catch((err) => {
          console.log("error", err)
          return {stops: []}
        })
        .then((data) => {
          return data;
        });
  
  },
  'searchByRadius': (config, params, extra) => {
    const options = {
      host: config.default.hostname,
      path: config.default.path + config.graphql.path,
      port: config.default.port
    };
    const endpoint = `https://${options.host}${options.path}`;
    const clientQL = new GraphQLClient(endpoint, { headers: config.default.headers });
    
    const query = gql`
                {
                stopsByRadius (lat : ${params[1]}, lon : ${params[0]}, radius: ${params[2] || 1000}) {
                  edges {
                    node {
                      stop {
                        gtfsId
                        name
                        code
                        desc
                        lat
                        lon
                        vehicleMode
                      }
                    }
                  }
              }`
  
    clientQL.request(query, {})
        .catch((err) => {
          console.log("error", err)
          return {stops: []}
        })
        .then((data) => {
          const res = {
            stops : []
          };

          for(const {node} of data.stopsByRadius.edges){
            if(res.stops.length < extra.limit){
              res.stops.push(node.stop);
            }else{
              break;
            }            
          }
          return res;
        });
  },
  'searchByBBox': (config, params, extra) => {
    const options = {
      host: config.default.hostname,
      path: config.default.path + config.graphql.path,
      port: config.default.port
    };
    const endpoint = `https://${options.host}${options.path}`;
    const clientQL = new GraphQLClient(endpoint, { headers: config.default.headers });
    
    const query = gql`
                {
                  stopsByBbox (minLat : ${params[1][1]}, minLon : ${params[1][0]}, maxLat: ${params[0][1]}, maxLon: ${params[0][0]}) {
                    gtfsId
                    name
                    code
                    desc
                    lat
                    lon
                    vehicleMode
                  }
              }`
  
    clientQL.request(query, {})
        .catch((err) => {
          console.log("error", err)
          return {stops: []}
        })
        .then((data) => {
          const res = {
            stops : []
          };
          for(const stop of data.stopsByBbox){
            if(res.stops.length < extra.limit){
              res.stops.push(stop);
            }else{
              break;
            }
          }
          return res;
        });
  
  }
}
