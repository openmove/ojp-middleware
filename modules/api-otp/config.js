'use strict';

module.exports = {
  server: {
    port: 8090
  },
  endpoints: {
    default: {
      hostname: 'map.muoversinpiemonte.it',
      path: '/otp/routers/mip',
      port: 443,
      headers: {
        'User-Agent': 'ojp-middleware-client'
      }
    },
    rest: {
      path: '/index'
    },
    graphql: {
      path: '/index/graphql'
    }
  }
};
