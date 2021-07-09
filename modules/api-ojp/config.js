'use strict';

module.exports = {
  server: {
    port: 8080
  },
  db: {
    //uri: 'mongodb://db/',
    uri: 'mongodb://0.0.0.0:8085/',
    name: 'ojp',
    collection: 'exchange_points'
  }
};