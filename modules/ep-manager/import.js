'use strict';

const fs = require("fs");
const path = require('path');
//const fastcsv = require("fast-csv");
const _ = require('lodash');
const csvtojson = require('csvtojson');
const mongoClient = require("mongodb").MongoClient;

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

    //TODO 
    const fields = config.import.fields

    csvtojson({
      noheader: false,
      checkType: true,
      delimiter: ',',
      headers: config.import.headers
    })
    .fromFile(csvFilePath)
    /*.on('data',(data)=>{
      //data is a buffer object
      const jsonStr= data.toString('utf8')
    })*/
    .preRawData( raw => {
      //console.log('RAWWWWWWW',raw)
      return raw.toString('utf8');
    })
    .then( arrayResult => {

      mongoClient.connect(config.db.uri, {
        useNewUrlParser: true,
        useUnifiedTopology: true
      }, (err, client) => {
        if (err) throw err;

        client.db(config.db.name).collection(config.db.collection)
          .insertMany(arrayResult, (err, res) => {
            if (err) throw err;

            console.log(`Inserted: ${res.insertedCount} rows`);
            client.close();
          });
      });

    });
};

if (require.main === module) {
  //importCsv(process.env['CSV_VERSION']);
  //TODO read from config
console.log(config)
  mongoClient.connect(config.db.uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  }, (err, client) => {
    if (err) throw err;

console.log(client.db.getCollection(config.db.collection))

    if (!client.db.getCollection(config.db.collection)) {
      console.log('collection not exists');
      client.db.createCollection(config.db.collection)
    }
    /*const opts = {};
    opts[config.import.headerIndex] = 1;

    client.db(config.db.name).collection(config.db.collection).createIndex(opts, {
        unique: true,
        sparse: true,
      });*/
  });
}
else {
  module.exports = {
    importCsv
  };
}