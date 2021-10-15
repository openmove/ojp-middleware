
const xmlbuilder = require('xmlbuilder');
const _ = require('lodash');

//TODO load config.errors

module.exports = {
  'createResponse': (stops, startTime, ptModes) => {
      //TODO
  },
  'createErrorResponse': (serviceName, errorDesc = 'GenericError', startTime) => {

    const date = new Date()
        , tag = xmlbuilder.create(`ojp:${serviceName}Delivery`);

    tag.ele('siri:ResponseTimestamp', date.toISOString());
    tag.ele('siri:Status', false);
    tag.ele('ojp:CalcTime', date.getTime() - startTime);

    const err = tag.ele('siri:ErrorCondition');
    err.ele('siri:OtherError')
    err.ele('siri:Description', errorDesc);

    return tag;
  }
}