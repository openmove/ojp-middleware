const { request, GraphQLClient, gql } = require('graphql-request');

const NodeCache = require('node-cache');

const Cache = new NodeCache({
  stdTTL: 300,
  //checkperiod: 60 * 3,
});

module.exports = {
  'getStopById': async (config, stopId, extra) => {

    const { logger } = config;

    const clientQL = new GraphQLClient(config.otp.baseUrl, { headers: config.otp.headers });

    let filter = `stops (ids : ["${stopId}"])`;

    if(!stopId) {

      const limit = Number(extra.limit || config.default_limit);

      filter = `stops (limit: ${limit})`;
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

    logger.info('getStopById');
    logger.debug(query);

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

    const {logger} = config;
    const clientQL = new GraphQLClient(config.otp.baseUrl, { headers: config.otp.headers });
    
    const limit = Number(extra.limit || config.default_limit);
    const skip = Number(extra.skip || config.default_skip);

    const query = gql`
                {
                  stops (limit: ${limit}, skip: ${skip}) {
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

    logger.info('getAllStops');
    logger.debug(query);

    let data = null;

    const cacheKey = `getAllStops_${limit}`;

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

    const { logger } = config;
    const clientQL = new GraphQLClient(config.otp.baseUrl, { headers: config.otp.headers });

    const limit = Number(extra.limit || config.default_limit);
    const skip = Number(extra.skip || config.default_skip);

    const query = gql`
                {
                  stopsByName (name: "${name}", limit: ${limit}, skip: ${skip}) {
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

    logger.info('searchByName');
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

    const { logger, default_radius } = config;
    const clientQL = new GraphQLClient(config.otp.baseUrl, { headers: config.otp.headers });

    //const limit = Number(extra.limit || config.default_limit);

    const circle = params.split(',').map(Number);
    const [centerLon, centerLat, radius] = circle;

    const query = gql`
                {
                  stopsByRadius (
                      lat: ${centerLat},
                      lon: ${centerLon},
                      radius: ${rad || default_radius}) {
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
                }`;

    logger.info('searchByRadius');
    logger.debug(query);

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

    const { logger } = config;
    const clientQL = new GraphQLClient(config.otp.baseUrl, { headers: config.otp.headers });
    
    const bbox = params.split(',').map(Number);
    const [upperLon, upperLat, lowerLon, lowerLat] = bbox;

    const query = gql`
                {
                  stopsByBbox (
                    minLat : ${lowerLat},
                    minLon : ${upperLon},
                    maxLat: ${upperLat},
                    maxLon: ${lowerLon}) {
                      gtfsId
                      name
                      code
                      zoneId
                      desc
                      lat
                      lon
                      vehicleMode
                  }
                }`;

    logger.info('searchByBBox');
    logger.debug(query);

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
