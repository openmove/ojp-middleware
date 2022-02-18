'use strict';

const express = require('express');
const app = express();
const mongoClient = require("mongodb").MongoClient;
const pino = require('pino');
const _ = require('lodash');

const {importCsv} = require('./import');

const {version,'name':serviceName} = require('./package.json');

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

logger.debug(_.omit(config,['dev','prod','environments']));

config.logger = logger;

const CSV_AUTOIMPORT = _.toLower(process.env['CSV_AUTOIMPORT']);

if (CSV_AUTOIMPORT==='true') {
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

  logger.info(`request getAll ${req.url} ${new Date().toISOString()}`);

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

  logger.info(`request getByName ${req.url} ${new Date().toISOString()}`);

  mongoClient.connect(config.db.uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  }, (err, client) => {
    if (err) throw err;

    const where = {};

    if (_.isString(req.params.name)) {
      where['Name']=  new RegExp(req.params.name, "i")
    }

    if(req.query.restrictionType === 'bbox') {

      const [upperLon, upperLat,lowerLon, lowerLat] = req.query.restrictionValue.split(',').map(Number);

      where['location']= {
        '$geoWithin': {
          '$box': [
            [ lowerLon, lowerLat ],
            [ upperLon, upperLat ]
          ]
        }
      }
    }
    else if (req.query.restrictionType === 'circle') {

      const [ lon, lat, radius ] = req.query.restrictionValue.split(',').map(Number);

      where['location']= {
        '$geoWithin': {
          '$centerSphere': [ [ lon, lat ], radius/6378100 ]
        }
      }
    }

    if (req.query.position) {

      const [ lon, lat ] = req.query.position.split(',').map(Number);

      where['location']= {
        '$geoWithin': {
          '$centerSphere': [ [ lon, lat ], config.geoPositionSearchRadius/6378100 ]
        }
      }
    }

    logger.debug('search query: '+JSON.stringify(where))

    client
    .db('ojp')
    .collection(config.db.collection)
    .find(where)
    .skip( Number(req.query.skip) || 0 )
    .limit( Number(req.query.limit) || 0 )
    .toArray(function(err, queryres) {
      console.log(queryres)
      if (err) {
        getres.send(err);
        throw err;
      }
      getres.json(queryres);

      client.close();
    });
  });
}

app.get('/all', getAll);

app.get('/searchByName/', getByName);
app.get('/searchByName/:name', getByName);

app.get('/searchByNetexId/', async (req, getres) => {
  getres.json([]);
});

app.get('/searchByNetexId/:id', async (req, getres) => {
  
  logger.info(`request GET /searchById ${req.url} ${new Date().toISOString()}`);

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
  
  logger.info(`request GET /geojson ${req.url} ${new Date().toISOString()}`);

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

let status = 'CONNECTING';

app.get(['/','/ep-manager'], async (req, res) => {
  if(status!=='OK') {
    res.statusCode = 503;
  }
  res.send({
    status,
    version
  });
});

app.listen(Number(config.server.port), () => {
  logger.info( app._router.stack.filter(r => r.route).map(r => `${Object.keys(r.route.methods)[0]} ${r.route.path}`) );
  logger.info(`service ${serviceName} listening at http://localhost:${config.server.port}`)
});

mongoClient.connect(config.db.uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
//TODO
/*  reconnectTries: 10, // Never stop trying to reconnect
  reconnectInterval: 500,
*/
  serverSelectionTimeoutMS: 100 //mseconds
}, err => {
  if (!err) {
    logger.info(`MongoDb connected ${config.db.uri}`);

    status = 'OK';

    //TODO move outside connection and return status != 'OK'
    //https://github.com/openmove/ojp-middleware/issues/17
    //
    /*app.listen(Number(config.server.port), () => {
      logger.info( app._router.stack.filter(r => r.route).map(r => `${Object.keys(r.route.methods)[0]} ${r.route.path}`) );
      logger.info(`listening at http://localhost:${config.server.port}`)
    });*/
  }
  else {
    logger.error(`MongoDb error ${config.db.uri} ${err.message}`);

    status = 'DB_ERROR';

    //process.exit(1)
  }
});
