
//TODO require from utils/ dbconnection
//
////TODO read config

const fs = require("fs");
const mongodb = require("mongodb").MongoClient;
const fastcsv = require("fast-csv");

const lastVersion = '0.16',
	, lastFile = __dirname+`../csvs/${lastVersion}/exchange_points.csv`;

//TODO 
const fields = config.import.fields

// let url = "mongodb://username:password@db:8085/";
let url = "mongodb://db:8085/";
let stream = fs.createReadStream(lastFile);
let csvData = [];
let csvStream = fastcsv
  .parse()
  .on("data", function(data) {
    csvData.push({
      id: data[0],
      name: data[1],
      description: data[2],
      createdAt: data[3]
    });
  })
  .on("end", function() {
    // remove the first line: header
    csvData.shift();

    console.log(csvData);

    mongodb.connect(
      url,
      { useNewUrlParser: true, useUnifiedTopology: true },
      (err, client) => {
        if (err) throw err;

        client
          .db("ojp")
          .collection("exchange_points")
          .insertMany(csvData, (err, res) => {
            if (err) throw err;

            console.log(`Inserted: ${res.insertedCount} rows`);
            client.close();
          });
      }
    );
  });

stream.pipe(csvStream);