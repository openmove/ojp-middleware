'use strict';

const express = require('express');
const app = express();
const mongoClient = require("mongodb").MongoClient;
const pino = require('pino');
const _ = require('lodash');

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

logger.info(_.omit(config,['dev','prod','environments']));

config.logger = logger;

const {importCsv} = require('./import');

if (process.env['IMPORT']==='true') {
  importCsv(process.env['CSV_VERSION']);
  //TODO sleep https://stackoverflow.com/questions/14249506/how-can-i-wait-in-node-js-javascript-l-need-to-pause-for-a-period-of-time
}


app.use(express.json());

//TODO app.get('/point/:id?', async (req, getres) => {  
//search a points by netextid
//if id is undefined return all points
//const filter = {
//  'limit': req.query.limit || 10
//};
//});
//

const getAll = async (req, getres) => {

  logger.info(`request GET / ${new Date().toISOString()}`);

  mongoClient.connect(config.db.uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  }, (err, client) => {
    if (err) throw err;

    client
    .db('ojp')
    .collection(config.db.collection)
    .find({})
    .skip( Number(req.query.skip) || 0 )
    .limit( Number(req.query.limit) || 0 )
    .toArray(function(err, queryres) {
      if (err) {
        getres.send(err);
        throw err;
      }

      getres.json(queryres);

      client.close();
    });
  });
}

const getByName = async (req, getres) => {

  logger.info(`request GET ${req.url} ${new Date().toISOString()}`);

  mongoClient.connect(config.db.uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  }, (err, client) => {
    if (err) throw err;

    const where = {};

    if(_.isString(req.params.name)) {
      where['Name']=  new RegExp(req.params.name, "i")
    }

    if(req.query.restrictionType && req.query.restrictionType==='circle') {

      const [ lon, lat, radius ] = req.query.restrictionValue.split(',').map(Number);

      where['location']= {
        '$geoWithin': {
          '$centerSphere': [ [ lon, lat ], radius/6378100 ]
        }
      }
      logger.debug('Restriction Circle:'+JSON.stringify(where))
    }
    else if(req.query.restrictionType && req.query.restrictionType==='bbox') {

      const [upperLon, upperLat,lowerLon, lowerLat] = req.query.restrictionValue.split(',').map(Number);

      where['location']= {
        '$geoWithin': {
          '$box': [
            [ lowerLon, lowerLat ],
            [ upperLon, upperLat ]
          ]
        }
      }
      logger.debug('Restriction Rectangle:'+JSON.stringify(where))
    }

    client
    .db('ojp')
    .collection(config.db.collection)
    .find(where)
    .skip( Number(req.query.skip) || 0 )
    .limit( Number(req.query.limit) || 0 )
    .toArray(function(err, queryres) {
      if (err) {
        getres.send(err);
        throw err;
      }
      getres.json(queryres);

      client.close();
    });
  });
}

app.get('/', getAll);

app.get('/searchByName/', getByName);
app.get('/searchByName/:name', getByName);

app.get('/searchByNetexId/', async (req, getres) => {
  getres.json([]);
});

app.get('/searchByNetexId/:id', async (req, getres) => {
  
  logger.info(`request GET /searchById ${new Date().toISOString()}`);

  mongoClient.connect(config.db.uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  }, (err, client) => {
    if (err) throw err;

    const findCond = {};
    findCond[config.import.headerIndex]= req.params.id

    client
    .db('ojp')
    .collection(config.db.collection)
    .find(findCond).toArray(function(err, queryres) {
      if (err) {
        getres.send(err);
        throw err;
      } 
      
      getres.json(queryres);

      client.close();
    });
  });
});

app.get('/geojson', async (req, getres) => {
  
  logger.info(`request GET /geojson ${new Date().toISOString()}`);

  mongoClient.connect(config.db.uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  }, (err, client) => {
    if (err) throw err;

    client
    .db('ojp')
    .collection(config.db.collection)
    .find({}).toArray(function(err, queryres) {
      if (err) {
        getres.send(err);
        throw err;
      }

      const geo = {
        "type": "featureCollection",
        "features": queryres.map(e => {
          return {
            "type": "Feature",
            "properties": e,
            "geometry": {
              "type": "Point",
              "coordinates": [ Number(e.long), Number(e.lat) ]
            }
          }
        })
      };
      
      getres.json(geo);

      client.close();
    });
  });
});

mongoClient.connect(config.db.uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 100 //mseconds
}, err => {
  if (!err) {
    logger.info(`MongoDb connected ${config.db.uri}`);
    app.listen(Number(config.server.port), () => {
      logger.info(`listening at http://localhost:${config.server.port}`)
    });
  }
  else {
    logger.error(`MongoDb error ${config.db.uri} ${err.message}`);
  }
});
