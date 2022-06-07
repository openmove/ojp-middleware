
const http = require('http')
    , _ = require('lodash');

const doRequest = (options, json) => {

  const st = new Date().getTime();

  console.log('doRequest:', options.path);

  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {

      let responseBody = '';

      res.setEncoding('utf8');

      res.on('data', (chunk) => {
        responseBody += chunk;
      });

      res.on('end', () => {
        console.log("doRequest, response time:",  (new Date().getTime()) - st, 'ms', 'length:', responseBody.length);
        resolve(JSON.parse(responseBody));
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.write(json || '')
    req.end();
  });
}

module.exports = {
  doRequest,

  'doMultiRequests': (requests) => {
    const st = new Date().getTime();

    //console.log('doRequest', options, data);
    //
    const promises = requests.map(req => {
      return doRequest(req.options, req.json);
    });

    return Promise.all(promises).then(results => {
      //console.log('PROMISE.ALL', results);
      console.log('doMultiRequests response time:', (new Date().getTime()) - st, 'ms')
      return results
    });
  },

  'ptModesRequest': mods => {    //siri to otp modes

    if(!mods || mods.length === 0) {
      return false;
    }
    //OTP
    //return this == TRAM || this == SUBWAY || this == RAIL || this == BUS || this == FERRY
    //        || this == CABLECAR || this == GONDOLA || this == FUNICULAR || this == TRANSIT
    //        || this == AIRPLANE;
    //SIRI MODES https://github.com/VDVde/OJP/blob/master/siri_model/siri_modes-v1.1.xsd
    //
    //MIP
    const modesOtp = ['walk'];

    const modesMap = {
      ' ': 'unknown',
      'airService': 'airplane',
      'rail': 'train',
      'telecabin': 'gondola',
      'ferryService': 'ferry',
      'underground': 'subway',
      'funicularService': 'funicular',
      'tramService': 'tram',
      'bus': 'bus',
      'walk': 'walk',
      //TODO cable car
      //TODO manage 'all' may be -> transit
    };
    //TODO use csv file or reg expressions

    for(const mod of mods) {

      let mode = modesMap[mod];//TODO default value

      if(mode) {
        modesOtp.push(mode);
      }
    }

    return _.uniq(modesOtp).map(m => {
      return m.toUpperCase();
    });
  }
}


/*const doRequestFake = (options, data) => {
  return new Promise((resolve, reject) => {
    const delay = _.random(500, 4000);
    console.log('doRequestFAKE:', options.path, delay);

    setTimeout(() => {
      console.log('doRequestFAKE resolve, delay:', delay)
      resolve({
        response: {
          plan: {
            itineraries: [
            {
              startTime: 1637940943,
              endTime: 1637941943,
              legs: [
                {
                  mode: 'FIRST',
                  startTime: 1637940943,
                  endTime: 1637941943
                },
                {
                  mode: 'SECOND',
                  startTime: 1637940943,
                  endTime: 1637941943
                }
              ]
            }
            ]
          }
        }
      })
    }, delay);
  });
}*/
