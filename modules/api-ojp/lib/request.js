
const http = require('http');

const doRequest = (options, data) => {

    //console.log('doRequest', options, data);

    return new Promise((resolve, reject) => {
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

    return new Promise.all(requests.map(req => {
      return doRequest(req.options, req.data);
    })).then( results => {
      return results
    });
  }
}
