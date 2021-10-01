
const express = require('express');
const fs = require('fs');
const app = express();
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

logger.info(_.omit(config,['dev','prod','test','environments']));

app.use('/', express.static('static', {
  etag: false,
  maxAge: '1000',
  setHeaders: function(res, path) {
    res.set('cache-control', 'no-cache')
  }
}));
app.use('/xmls', express.static('xmls', {
  etag: false,
  maxAge: '1000',
  setHeaders: function(res, path) {
    res.set('cache-control', 'no-cache')
  }
}));

app.use(express.json());

app.get('/getconfig', async (req, res) => {
  res.set('cache-control', 'no-cache')
  res.set('content-type', 'application/javascript');
  const conftext = JSON.stringify(config,null,4);
  res.send(`window.config = ${conftext};`);
});

app.get('/list.json', async (req, res) => {
  const dirPath = '/xmls/'
  let list = [];
  fs.readdir(__dirname + dirPath, (err, files) => {
    res.json(files.map(file => {
      return dirPath + file
    }));
  });
});

app.listen(Number(config.server.port), () => {
  console.log(`listening at http://localhost:${config.server.port}`)
})
