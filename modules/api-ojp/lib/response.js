
const xmlbuilder = require('xmlbuilder');
const _ = require('lodash');

//TODO load config.errors

module.exports = {
  'createResponse': (stops, startTime, ptModes) => {
      //TODO
  },
  'createErrorResponse': (serviceName, errorDesc = 'GENERIC_ERROR', startTime, continueAt = null ) => {

    const now = new Date()
        , tag = xmlbuilder.create(`ojp:${serviceName}Delivery`);
    tag.ele('siri:ResponseTimestamp', now.toISOString());
    tag.ele('siri:Status', false);

    tag.ele('ojp:CalcTime', now.getTime() - startTime);

    if ( continueAt !== null ) {
      tag.ele('ojp:ContinueAt', continueAt);
    }

    const err = tag.ele('siri:ErrorCondition');
    err.ele('siri:OtherError')
    err.ele('siri:Description', `${serviceName}_${errorDesc}`);
    //TODO siri:ErrorText
    return tag;
  },
  'ptModesResponse': (mode, parent) => {

    const m = mode.toLowerCase();

    const modes = {
      '~bus~': 'BUS',
      '~train~': 'RAIL',
      //exchangepoints db values
      //
      'bus': 'BUS',
      'train': 'RAIL',
      'rail': 'RAIL',
      //
      'ferry': 'ferryService',
      'subway': 'underground',
      //funicolar,tram,...
    };

    return m ? (modes[m] || m.toUpperCase()) : 'unknown';
  }
}
