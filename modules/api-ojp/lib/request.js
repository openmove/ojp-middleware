
const http = require('http');

module.exports = {
  'doRequest': (options, data) => {
    return new Promise((resolve, reject) => {
      const req = http.request(options, (res) => {
        res.setEncoding('utf8');
        let responseBody = '';

        res.on('data', (chunk) => {
          responseBody += chunk;
        });

        res.on('end', () => {
          console.log(responseBody)
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
