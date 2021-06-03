
const fs = require('fs')
const express = require('express');
const app = express();
const bodyParser = require("body-parser");

//const xmlparser = require('express-xml-bodyparser');
const validator = require('xsd-schema-validator');

const port = 5000;

//app.use(bodyParser.urlencoded({ extended: false }))

//app.use(bodyParser.raw({ type: 'application/xml' }))
app.use(bodyParser.text({ type: 'application/xml' }))
//  http://expressjs.com/en/resources/middleware/body-parser.html#bodyparserrawoptions

app.post('/', (req, res) => {
  
  console.log('REQUEST',req.body)

  validator.validateXML(req.body, 'resources/foo.xsd', function(err, result) {
    if (err) {
      throw err;
    }

    result.valid; // true

    res.send(req.body)
  });

  

});

app.listen(port, () => {
  console.log(`API OTP service running on port ${port}`)
})