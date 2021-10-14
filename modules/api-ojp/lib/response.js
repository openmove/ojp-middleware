
const xmlbuilder = require('xmlbuilder');
const _ = require('lodash');

//TODO load config.errors

module.exports = {
  'createResponse': (stops, startTime, ptModes) => {
      //TODO
  },
  'createErrorResponse': (serviceName, errorCode = 'GenericError', startTime) => {
    const responseTimestamp = new Date().toISOString();
    const calcTime = (new Date().getTime()) - startTime
    const tag = xmlbuilder.create(`ojp:${serviceName}Delivery`);
    tag.ele('siri:ResponseTimestamp', responseTimestamp);
    tag.ele('siri:Status', false);
    tag.ele('ojp:CalcTime', calcTime);

    const err = tag.ele('siri:ErrorCondition');
    err.ele('siri:OtherError')
    err.ele('siri:Description', errorCode);

    return tag;
  }
}