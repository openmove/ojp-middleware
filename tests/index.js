
const express = require('express');
const fs = require('fs');

const app = express();
const port = 5000

app.use('/', express.static('static'));
app.use('/xmls', express.static('xmls'));

app.use(express.json())

app.get('/list.json', async (req, res) => {
  const dirPath = '/xmls/'
  let list = [];
  fs.readdir(__dirname + dirPath, (err, files) => {
    res.json(files.map(file => {
      return dirPath + file
    }));
  });
});


app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`)
})
