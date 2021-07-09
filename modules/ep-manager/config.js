'use strict';

module.exports = {
  server: {
    port: 8083
  },
  db: {
    //uri: 'mongodb://db/',
    uri: 'mongodb://0.0.0.0:8085/',
    name: 'ojp',
    collection: 'exchange_points'
  },
  import: {
    version: '0.16',
    csvFile: '5T.csv',
    headers: [
      "NeTEx Id",
      "GlobalID",
      "MetaID",
      "Name",
      "Steward",
      "Destination Systems",
      "Crossborder",
      "long",
      "lat",
      "Main Mode",
      "epPrio",
      "CheckIn",
      "Checkout",
      "Main Operator",
      "Country"
    ]
  }
};