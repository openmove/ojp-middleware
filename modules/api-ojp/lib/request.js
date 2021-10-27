
const http = require('http');

module.exports = {
  'doRequest': (options, data) => {
    
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
}
