'use strict';

const fs = require("fs");
const path = require('path');
//const fastcsv = require("fast-csv");
const _ = require('lodash');
const csvtojson = require('csvtojson');
const { MongoClient } = require("mongodb");
const pino = require('pino');

const request = require('request');

const dotenv = require('dotenv').config()
    , config = require('@stefcud/configyml')
    , logger = pino({
      level: config.logs.level || "info",
      prettyPrint: {
        translateTime: "SYS:standard",
        colorize: config.logs.colorize == null ? true : config.logs.colorize, 
        ignore: config.logs.ignore,
        messageFormat: `{msg}`
      },
    });

config.logger = logger;

const lastVersion = config.import.version

const importCsvFile = (ver, basedir) => {

    const version = ver || lastVersion;
    const basepath = basedir || __dirname+'/csvs/'+version+'/';

    logger.info(`import csv file: ${version}, ${basepath}`)
    
    let files = [];

    try {

      files = fs.readdirSync(basepath);
      
    } catch(err) {
      logger.error(`import error! version '${version}' directory not found: '${basepath}'`)
      return;
    }

    let csvFilePath
      , csvFile;

    for (let i in files) {
      if (path.extname(files[i]) === ".csv") {
        if (!_.isEmpty(config.import.csvFile) && files[i]===config.import.csvFile) {
          csvFile = files[i];
          break;
        }
        else {
          csvFile = files[i];  //if csvFile not specified use the first .csv file
          break;
        }
      }
    }

    csvFilePath = basepath + csvFile;

    if (!fs.existsSync(csvFilePath)) {
      
      logger.error(`file CSV not found ${csvFilePath}`)
      
      process.exit(1);

      return;
    }
    else {
      logger.info(`PARSING CSV: ${csvFilePath}`)
    }

    csvtojson({
      noheader: false,
      checkType: true,
      delimiter: ',',
      headers: config.import.headers
    })
    .fromFile(csvFilePath)
    .then(objs => {

      MongoClient.connect(config.db.uri, {
        useNewUrlParser: true,
        useUnifiedTopology: true
      }, (err, client) => {

        const db = client.db(config.db.name)
            , col = db.collection(config.db.collection)
            , indexOpts = {};
        indexOpts[config.import.headerIndex]= 1;

        col.createIndex(indexOpts, {
          unique: true,
          sparse: true,
        });
        col.createIndex({'location': '2dsphere'});

        const objsIns = objs.map(obj => {
        
          const lon = Number(obj[config.import.columnLongitude])
              , lat = Number(obj[config.import.columnLatitude]);

          obj['location'] = {
            'type': 'Point',
            'coordinates': [lon, lat]
          };

          return obj
        });

        col.insertMany(objsIns, (insertErr, res) => {
          if(insertErr) logger.warn(insertErr.message);
          client.close();
        });
        
      });

    });
};

const importCsvUrl = (csvUrl) => {

    logger.info(`import csv url: ${csvUrl}`);

    csvtojson({
      noheader: false,
      checkType: true,
      delimiter: ',',
      headers: config.import.headers
    })
    .fromStream(request.get(csvUrl))
    .then(objs => {

      MongoClient.connect(config.db.uri, {
        useNewUrlParser: true,
        useUnifiedTopology: true
      }, (err, client) => {

        const db = client.db(config.db.name)
            , col = db.collection(config.db.collection)
            , indexOpts = {};
        indexOpts[config.import.headerIndex]= 1;

        col.createIndex(indexOpts, {
          unique: true,
          sparse: true,
        });
        col.createIndex({'location': '2dsphere'});

        const objsIns = objs.map(obj => {

          const lon = Number(obj[config.import.columnLongitude])
              , lat = Number(obj[config.import.columnLatitude]);

          obj['location'] = {
            'type': 'Point',
            'coordinates': [lon, lat]
          };

          return obj
        });

        col.insertMany(objsIns, (insertErr, res) => {
          if(insertErr) logger.warn(insertErr.message);
          client.close();
        });

      });

    });
};

if (require.main === module) {

  if (process.env['CSV_URL']) {
    importCsvUrl(process.env['CSV_URL']);
  }
  else {
    importCsvFile(process.env['CSV_VERSION']);
  }

}
else {
  module.exports = {
    importCsvFile,
    importCsvUrl
  };
}