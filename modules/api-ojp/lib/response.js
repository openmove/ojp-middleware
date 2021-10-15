
const xmlbuilder = require('xmlbuilder');
const _ = require('lodash');

//TODO load config.errors

module.exports = {
  'createResponse': (stops, startTime, ptModes) => {
      //TODO
  },
  'createErrorResponse': (serviceName, errorDesc = 'GENERIC_ERROR', startTime) => {

    const now = new Date()
        , tag = xmlbuilder.create(`ojp:${serviceName}Delivery`);
    tag.ele('siri:ResponseTimestamp', now.toISOString());
    tag.ele('siri:Status', false);
    tag.ele('ojp:CalcTime', now.getTime() - startTime);

    const err = tag.ele('siri:ErrorCondition');
    err.ele('siri:OtherError')
    err.ele('siri:Description', `${serviceName}_${errorDesc}`);

    return tag;
  }
}