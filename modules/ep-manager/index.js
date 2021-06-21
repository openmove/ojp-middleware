'use strict';

const express = require('express');
const app = express();

const config = require('config-yml');
console.log(config)
return
const mongoClient = require("mongodb").MongoClient;

const port =  config.server.port || 5000;

app.use(express.json());


//TODO app.get('/point/:id?', async (req, getres) => {  
//search a points by netextid
//if id is undefined return all points
//const filter = {
//  'limit': req.query.limit || 10
//};
//});

app.get('/imported', async (req, getres) => {

  mongoClient.connect(config.db.uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  }, (err, client) => {
    if (err) throw err;

    client
    .db(config.db.name)
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

app.listen(port, () => {
  console.log(`EP MANAGER service running on port ${port}`)
})