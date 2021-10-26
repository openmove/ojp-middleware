const { request, GraphQLClient, gql } = require('graphql-request');
const https = require('https');

const NodeCache = require('node-cache');

const Cache = new NodeCache({
  stdTTL: 300,
  //checkperiod: 60 * 3,
});

module.exports = {
  'getStopById': async (config, stopId, extra) => {

    const options = {
      host: config.otp.hostname,
      path: config.otp.path + config.graphql.path,
      port: config.otp.port
    };
    const endpoint = `https://${options.host}${options.path}`;
    const clientQL = new GraphQLClient(endpoint, { headers: config.otp.headers });

    let filter = `stops (ids : ["${stopId}"])`;

    if(!stopId) {

      const maxResults = Number(extra.limit || config.default_max_results);

      filter = `stops (maxResults: ${maxResults})`;
    }

    const query = gql`
                {${filter} {
                  gtfsId
                  name
                  code
                  zoneId
                  desc
                  lat
                  lon
                  vehicleMode
                }
              }`

    const data = await clientQL.request(query, {})

    if(data!= null && data.stops){
      const res = {stops: []}
      for(const stop of data.stops){
        if(stop){
          res.stops.push(stop);
        }
      }
      return res;
    }
    return {
      stops: []
    }
  },
  'getAllStops': async (config, extra) => {

    const options = {
      host: config.otp.hostname,
      path: config.otp.path + config.graphql.path,
      port: config.otp.port
    };
    const {logger} = config;
    const endpoint = `https://${options.host}${options.path}`;
    const clientQL = new GraphQLClient(endpoint, { headers: config.otp.headers });
    
    const maxResults = Number(extra.limit || config.default_max_results);

    const query = gql`
                {
                stops (maxResults: ${maxResults}) {
                  gtfsId
                  name
                  code
                  zoneId
                  desc
                  lat
                  lon
                  vehicleMode
                }
              }`
  
    logger.debug(query);

    let data = null;

    const cacheKey = `getAllStops_${maxResults}`;

    if(config.caching ===  true) {

      if(Cache.has(cacheKey)) {

        data = Cache.get(cacheKey);

        logger.debug('USE CACHE response')
      }
      else {
        data = await clientQL.request(query, {});

        logger.debug('NOT USE CACHE response')

        Cache.set(cacheKey, data);
      }
    }
    else {
      data = await clientQL.request(query, {});
    }

    if(data!= null && data.stops){
      const res = {stops: []}
      for(const stop of data.stops){
        if(stop){
          res.stops.push(stop);
        }
      }
      return res;
    }
    return {
      stops: []
    }
  },
  'searchByName': async (config, name, extra) => {
    const options = {
      host: config.otp.hostname,
      path: config.otp.path + config.graphql.path,
      port: config.otp.port
    };
    const {logger} = config;
    const endpoint = `https://${options.host}${options.path}`;
    const clientQL = new GraphQLClient(endpoint, { headers: config.otp.headers });

    const maxResults = Number(extra.limit || config.default_max_results);
    
    const query = gql`
                {
                stopsByName (name: "${name}", maxResults: ${maxResults}) {
                  gtfsId
                  name
                  code
                  zoneId
                  desc
                  lat
                  lon
                  vehicleMode
                }
              }`
  
    logger.debug(query);
    
    const data = await clientQL.request(query, {});
    
    if(data!= null && data.stopsByName){
      const res = {stops: []}
      for(const stop of data.stopsByName){
        if(stop){
          res.stops.push(stop);
        }
      }
      return res;
    }
    return {
      stops: []
    }
  
  },
  'searchByRadius': async (config, params, extra) => {
    const options = {
      host: config.otp.hostname,
      path: config.otp.path + config.graphql.path,
      port: config.otp.port
    };
    const endpoint = `https://${options.host}${options.path}`;
    const clientQL = new GraphQLClient(endpoint, { headers: config.otp.headers });

    //const maxResults = Number(extra.limit || config.default_max_results);

    const query = gql`
                {
                stopsByRadius (
                    lat : ${params[1]},
                    lon : ${params[0]},
                    radius: ${params[2] || 1000}) {
                  edges {
                    node {
                      stop {
                        gtfsId
                        name
                        code
                        zoneId
                        desc
                        lat
                        lon
                        vehicleMode
                      }
                    }
                  }
              }`
  
    const data = await clientQL.request(query, {});

    if(data!= null && data.stopsByRadius){
      const res = {stops: []}
      for(const stop of data.stopsByRadius){
        if(stop){
          res.stops.push(stop);
        }else{
          break;
        }
      }
      return res;
    }
    return {
      stops: []
    }
  },
  'searchByBBox': async (config, params, extra) => {
    const options = {
      host: config.otp.hostname,
      path: config.otp.path + config.graphql.path,
      port: config.otp.port
    };
    const endpoint = `https://${options.host}${options.path}`;
    const clientQL = new GraphQLClient(endpoint, { headers: config.otp.headers });
    
    const query = gql`
                {
                  stopsByBbox (
                    minLat : ${params[1][1]},
                    minLon : ${params[1][0]},
                    maxLat: ${params[0][1]},
                    maxLon: ${params[0][0]}) {
                      gtfsId
                      name
                      code
                      zoneId
                      desc
                      lat
                      lon
                      vehicleMode
                  }
              }`
  
    const data = await clientQL.request(query, {});

    if(data!= null && data.stopsByBbox){
      const res = {stops: []}
      for(const stop of data.stopsByBbox){
        if(stop){
          res.stops.push(stop);
        }else{
          break;
        }
      }
      return res;
    }
    return {
      stops: []
    }
  }
}
