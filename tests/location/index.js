var http = require('https');
var parseString = require('xml2js').parseString;
const express = require('express');
var builder = require('xmlbuilder');
const app = express()
const port = 3000

var xmlparser = require('express-xml-bodyparser');
app.use(xmlparser());

const { request, GraphQLClient, gql } = require('graphql-request');

var options = {
  host: 'otp.openmove.com',
  path: '/otp/routers/trento/index/stops/',
  port: 443
};

var optionsGeocode = {
  host: 'otp.openmove.com',
  path: '/otp/routers/trento/geocode',
  port: 443
};

var endpoint = 'https://otp.openmove.com/otp/routers/trento/index/graphql'
const clientQL = new GraphQLClient(endpoint, { headers: {} })

var currenttime = new Date().getTime();
var res = null;

var noResult = {
    "siri:Status": {"#text": false},
    "siri:ErrorCondition": {
        "siri:OtherError": {},
        "siri:Description": {"#text": "LOCATION_NORESULTS"}
    }
}

printLocations = function(mStops, endDate, xmlOptions) {


var elaboration = endDate.getTime() - currenttime;

var result = {};

if(!mStops || mStops.length == 0){
return noResult;
}

var locations = [];
for(var stop of mStops){

if(!stop){
    break;
}

var location = {
	"ojp:Location": {
		"ojp:StopPlace": {
			"ojp:StopPlaceRef": {"#text": stop.gtfsId},
			"ojp:StopPlaceName": {
			"ojp:Text": {"#text": stop.name},
			},
			"ojp:TopographicPlaceRef": {"#text": stop.code}
		},
		"ojp:LocationName": {
			"ojp:Text": {"@xml:lang": "it", "#text": stop.name}
		},
		"ojp:GeoPosition": {
			"siri:Longitude": {"#text": stop.lon},
			"siri:Latitude": {"#text": stop.lat},
		}
	},
	"ojp:Complete": {"#text": true},
    "ojp:Probability": {"#text": NaN}
	}

    if(xmlOptions.mode === "true"){
        var modesTransport = [];
        for(var {mode} of stop.routes){
            var modeTransport = {
                "ojp:PtMode" : {"#text": mode.toLowerCase()},
            }

            if(mode.toLowerCase() === "bus"){
                modeTransport["siri:BusSubmode"] = {"#text": "unknown"}
            }

            if(mode.toLowerCase() === "rail"){
                modeTransport["siri:RailSubmode"] = {"#text": "unknown"}
            }

            modesTransport.push(modeTransport);
        }

        const unique = [];
        modesTransport.map(x =>
            unique.filter(a => a["ojp:PtMode"]["#text"] === x["ojp:PtMode"]["#text"]).length > 0 ? null : unique.push(x));

        location["ojp:Mode"] = unique;

    }


locations.push(location);

  }

result = {"siri:ResponseTimestamp": {
		 "#text" : endDate.toISOString()
		},
		"ojp:CalcTime": {"#text": elaboration / 1000}}
result["siri:Status"] = {"#text": true};
result["ojp:Location"] = locations;
return result;
}

callback = function(response) {
  var str = '';

  //another chunk of data has been received, so append it to `str`
  response.on('data', function (chunk) {
    str += chunk;
  });

  //the whole response has been received, so we just print it out here
  response.on('end', function () {

  });
}

var returnStopLocation = function(res, {stops}, xmlOptions){
    var endDate = new Date();
    res.set('Content-Type', 'text/xml');


var obj = {
  "siri:OJP": {
    '@xmlns:siri': "http://www.siri.org.uk/siri",
    '@xmlns:ojp' : "http://www.vdv.de/ojp",
    '@version' : "1.0",

    "siri:OJPResponse": {
      "siri:ServiceDelivery": {
	"siri:ResponseTimestamp" : {
	 "#text" : endDate.toISOString()
	},
        "siri:ProducerRef" : {"#text": "OPENMOVE"},
        "siri:Status": {"#text": true},
        "ojp:OJPLocationInformationDelivery": printLocations(stops, endDate, xmlOptions)
      }
    }
  }
};

var xml = builder.create(obj).end({ pretty: false});

res.send(xml);
}

app.post('/ojp/', (req, result) => {
    var res = result;
    console.log(JSON.stringify(req.body));
    var xml = req.body;

    if(xml && xml.ojp 
	&& xml.ojp.ojprequest 
	&& xml.ojp.ojprequest[0] 
	){
	console.log(xml.ojp.ojprequest[0]);
	if(xml.ojp.ojprequest[0]["servicerequest"][0]["ojp:ojplocationinformationrequest"]){
		console.log("2");
		for(const elem of xml.ojp.ojprequest[0]["servicerequest"][0]["ojp:ojplocationinformationrequest"]){
		  if(elem["ojp:placeref"]){
			var stopId = elem["ojp:placeref"][0]["ojp:stopplaceref"][0];
			var resNr = 10;
			 var type = elem["ojp:restrictions"][0]["ojp:type"][0];
        		resNr = elem["ojp:restrictions"][0]["ojp:numberofresults"][0];
        		var incModes = elem["ojp:restrictions"][0]["ojp:includeptmodes"][0];
				const query = gql`
              {
              stop (id : "${stopId}") {
                id
                gtfsId
                name
                code
                desc
                lat
                lon
                wheelchairBoarding
                routes {
                  mode
                }
              }
            }`

            const xmlOptions = {
                type,
                resNr,
                mode: incModes
            };

            clientQL.request(query, {})
                .catch((err) => returnStopLocation(res, {stops: []}, {}))
                .then((data) => returnStopLocation(res, {stops : [data.stop]}, xmlOptions));
			}
		}
	}
    }

/*
    try{
    parseString(xml, function (err, result) {
        var stopId = "";
        let searchById = true;
        if(result.OJP.OJPRequest[0].ServiceRequest[0]["ojp:OJPLocationInformationRequest"][0]["ojp:PlaceRef"]){
            stopId = result.OJP.OJPRequest[0].ServiceRequest[0]["ojp:OJPLocationInformationRequest"][0]["ojp:PlaceRef"][0]["ojp:StopPlaceRef"][0];

        }

        if(searchById && result.OJP.OJPRequest[0].ServiceRequest[0]["ojp:OJPLocationInformationRequest"][0]["ojp:InitialInput"]){
            searchById = false;
            stopId = result.OJP.OJPRequest[0].ServiceRequest[0]["ojp:OJPLocationInformationRequest"][0]["ojp:InitialInput"][0]["ojp:LocationName"][0];
        }

        var resNr = 10;

        var type = result.OJP.OJPRequest[0].ServiceRequest[0]["ojp:OJPLocationInformationRequest"][0]["ojp:Restrictions"][0]["ojp:Type"][0];
        resNr = result.OJP.OJPRequest[0].ServiceRequest[0]["ojp:OJPLocationInformationRequest"][0]["ojp:Restrictions"][0]["ojp:NumberOfResults"][0];
        var incModes = result.OJP.OJPRequest[0].ServiceRequest[0]["ojp:OJPLocationInformationRequest"][0]["ojp:Restrictions"][0]["ojp:IncludePtModes"][0];

        //options.path += stopId;

        if(searchById){
            const query = gql`
              {
              stop (id : "${stopId}") {
                id
                gtfsId
                name
                code
                desc
                lat
                lon
                wheelchairBoarding
                routes {
                  mode
                }
              }
            }`

            const xmlOptions = {
                type,
                resNr,
                mode: incModes
            };

            clientQL.request(query, {})
                .catch((err) => returnStopLocation(res, {stops: []}, {}))
                .then((data) => returnStopLocation(res, {stops : [data.stop]}, xmlOptions));
        }else{
            optionsGeocode.path += `?query="${stopId}"&corners=false`;
            optionsGeocode.path = encodeURI(optionsGeocode.path);
            http.get(optionsGeocode, function(mres){
                var body = '';

                mres.on('data', function(chunk){
                    body += chunk;
                });

                mres.on('end', function(){
                    var otpResponse = JSON.parse(body);
                    var ids = [];
                    for(var i = 0; i < resNr && i < otpResponse.length; i++ ){
                        ids.push(otpResponse[i].id.replace("_", ":"))
                    }

                    const query = gql`
                      {
                      stops (ids : ${JSON.stringify(ids)}) {
                        id
                        gtfsId
                        name
                        code
                        desc
                        lat
                        lon
                        wheelchairBoarding
                        routes {
                          mode
                        }
                      }
                    }`

                    const xmlOptions = {
                        type,
                        resNr,
                        mode: incModes
                    };

                    clientQL.request(query, {}).then((data) => returnStopLocation(res, data, xmlOptions));

                });
            }).on('error', function(e){
                  console.log("Got an error: ", e);
            });
        }

    })
}catch(error){
returnStopLocation(res, [], {});

}
*/
});

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`)
})
