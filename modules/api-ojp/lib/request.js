
const http = require('http')
    , _ = require('lodash');

const doRequest = (options, data) => {

  console.log('doRequest:', options.path);

  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {

      let responseBody = '';

      res.setEncoding('utf8');

      res.on('data', (chunk) => {
        responseBody += chunk;
      });

      res.on('end', () => {
        console.log('doRequest, response:', responseBody);
        resolve(JSON.parse(responseBody));
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.write(data || '')
    req.end();
  });
}

const doRequestFake = (options, data) => {

  console.log('doRequestFAKE:', options.path);

  return new Promise((resolve, reject) => {

    setTimeout(() => {
      resolve({
        response: {
          plan: {
            itineraries: [
            {

            }
            ]
          }
        }
      })
    }, _.random(500, 3000));

    const req = http.request(options, (res) => {

      let responseBody = '';

      res.setEncoding('utf8');

      res.on('data', (chunk) => {
        responseBody += chunk;
      });

      res.on('end', () => {
        resolve(JSON.parse(responseBody));
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.write(data || '')
    req.end();
  });
}

module.exports = {
  doRequest,

  'doMultiRequests': (requests) => {

    //console.log('doRequest', options, data);
    //
    const promises = requests.map(req => {
      return doRequestFake(req.options, req.data);
    })

    return new Promise.all(promises).then(results => {
      console.log('PROMISE.ALL', results)
      return results
    });
  }
}
