
const fs = require("fs");
const path = require('path');
//const fastcsv = require("fast-csv");
const csvtojson = require('csvtojson');
const mongoClient = require("mongodb").MongoClient;

const config = require('config-yml');

// let mongoUrl = "mongodb://username:password@db:8085/";
let mongoUrl = "mongodb://db:8085/";


const lastVersion = config.import.version

const basepath = __dirname+'/csvs/'+lastVersion+'/';

const files = fs.readdirSync(basepath);

let csvFilePath = basepath;

for(let i in files) {
   if(path.extname(files[i]) === ".csv") {
      csvFilePath += files[i];
      break;
   }
}

if (!fs.existsSync(csvFilePath)) {
  
  console.error(`file CSV not found ${csvFilePath}`)
  
  process.exit(1);

  return;
}

//TODO 
const fields = config.import.fields


csvtojson({
  noheader: false
})
.fromFile(csvFilePath)
/*.on('data',(data)=>{
  //data is a buffer object
  const jsonStr= data.toString('utf8')
})*/
.preRawData( raw => {
  console.log('RAWWWWWWW',raw)
  return raw.toString('utf8');
})
.then( jsonObj => {

  //console.log(jsonObj);

  /*mongoClient.connect(url, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  }, (err, client) => {
    if (err) throw err;

    client.db(config.db.name).collection(config.db.collection)
      .insertMany(jsonObj, (err, res) => {
        if (err) throw err;

        console.log(`Inserted: ${res.insertedCount} rows`);
        client.close();
      });
  });*/

});