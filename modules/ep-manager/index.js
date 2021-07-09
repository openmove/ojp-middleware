'use strict';

const express = require('express');
const app = express();

//const config = require('config-yml');
const config = require('./config');

const mongoClient = require("mongodb").MongoClient;

const port =  config.server.port || 8083;

app.use(express.json());


//TODO app.get('/point/:id?', async (req, getres) => {  
//search a points by netextid
//if id is undefined return all points
//const filter = {
//  'limit': req.query.limit || 10
//};
//});

app.get('/', async (req, getres) => {
  
  console.log('request GET /', new Date().toISOString());

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
      
      getres.json(queryres);

      client.close();
    });
  });
});

app.get('/searchByName/', async (req, getres) => {
  getres.json([]);
});

app.get('/searchByName/:name', async (req, getres) => {
  
  console.log('request GET', req.url, new Date().toISOString());

  mongoClient.connect(config.db.uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  }, (err, client) => {
    if (err) throw err;

    client
    .db('ojp')
    .collection(config.db.collection)
    .find({
      'Name': new RegExp(req.params.name, "i")
    })
    .limit( Number(req.query.limit) )
    .toArray(function(err, queryres) {
      if (err) {
        getres.send(err);
        throw err;
      } 
      
      getres.json(queryres);

      client.close();
    });
  });
});

app.get('/searchByNetexId/', async (req, getres) => {
  getres.json([]);
});

app.get('/searchByNetexId/:id', async (req, getres) => {
  
  console.log('request GET /searchById', new Date().toISOString());

  mongoClient.connect(config.db.uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  }, (err, client) => {
    if (err) throw err;

    client
    .db('ojp')
    .collection(config.db.collection)
    .find({
      "NeTEx Id": req.params.id
    }).toArray(function(err, queryres) {
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
  
  console.log('request GET /geojson', new Date().toISOString());

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
    app.listen(port, () => {
      console.log(`ExchangePointsManager listening at http://localhost:${port}`)
    });
  }
  else {
    console.error(`MongoDb error ${err.message}`);
  }
});