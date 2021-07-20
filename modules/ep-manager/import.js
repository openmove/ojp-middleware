'use strict';

const fs = require("fs");
const path = require('path');
//const fastcsv = require("fast-csv");
const _ = require('lodash');
const csvtojson = require('csvtojson');
const {MongoClient} = require("mongodb");

const dotenv = require('dotenv').config()
    , config = require('@stefcud/configyml');

const lastVersion = config.import.version

const importCsv = (ver, basedir) => {  

    const version = ver || lastVersion;
    const basepath = basedir || __dirname+'/csvs/'+version+'/';

    console.log('import csv...', version, basepath)
    
    let files = [];

    try {

      files = fs.readdirSync(basepath);
      
    } catch(err) {
      console.warn(`version ${version} not found ${basepath}`)
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
      
      console.error(`file CSV not found ${csvFilePath}`)
      
      process.exit(1);

      return;
    }
    else {
      console.log('PARSING CSV', csvFilePath)
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
          if(insertErr) console.warn(insertErr.message);
          client.close();
        });
        
      });

    });
};

if (require.main === module) {

  importCsv(process.env['CSV_VERSION']);

}
else {
  module.exports = {
    importCsv
  };
}