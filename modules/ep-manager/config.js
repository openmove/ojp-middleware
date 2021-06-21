'use strict';

module.exports = {
  server: {
    port: 8083
  },
  db: {
    //uri: 'mongodb://db:8085/',
    uri: 'mongodb://0.0.0.0:8085/',
    name: 'ojp',
    collection: 'exchange_points'
  },
  import: {
    version: '0.16',
    csvFile: '5T.csv'
  }
};