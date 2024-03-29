
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
        try {
          const jsonResp = JSON.parse(responseBody);
          resolve(jsonResp);
        }
        catch(err) {
          err.code = 'EJSONPARSE';
          reject(err)
        }

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

  'ptModesRequest': (mods, excludeMode = false) => {    //siri to otp modes

    if(!mods || mods.length === 0) {
      return undefined;
    }
    //OTP MODES:
    //  TRAM, SUBWAY, RAIL, BUS, FERRY, CABLECAR, GONDOLA, FUNICULAR, TRANSIT, AIRPLANE;
    //
    //SIRI MODES
    //  ./lib/siri_modes.txt
    //
    const allOTPModes = [
      'WALK','TRAM','SUBWAY','RAIL','BUS','FERRY',
      //'CABLE_CAR','GONDOLA',
      'FUNICULAR','AIRPLANE'
    ];
    const optModes = [];

    const modesMap = {
      'all':   'transit',
      'bus':   'bus',
      'air':   'airplane',
      'tram':  'tram',
      'rail':  'rail',
      'train': 'rail',
      'ferry': 'ferry',
      'cableCar':     'cable_car',
      'telecabin':    'gondola',
      'funicular':    'funicular',
      'funicular':    'funicular',
      'underground':  'subway',
    };
    //TODO use csv file or reg expressions

    mods.forEach( (m, key) => {
      mods[key] = m.replace('Services','').replace('Service','');
    });

    for(const mod of mods) {

      let mode = modesMap[mod];//TODO default value

      if(mode) {
        optModes.push(mode);
      }
    }

    let returnModes = optModes.map(m => {
      return m.toUpperCase();
    });

    if (excludeMode===true) {

      returnModes = allOTPModes.filter(m => {
        return !returnModes.includes(m);
      });
    }

    returnModes.push('WALK');

    return _.compact(_.uniq(returnModes));
  }
}
