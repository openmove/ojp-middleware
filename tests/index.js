
const express = require('express');
const fs = require('fs');
const app = express();

const dotenv = require('dotenv').config()
    , config = require('@stefcud/configyml');

console.log(config);

app.use('/', express.static('static', {
  etag: false,
  maxAge: '1000'
}));
app.use('/xmls', express.static('xmls'));

app.use(express.json());

app.get('/getconfig', async (req, res) => {
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
