
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
  'ptModesResponse': (mod, parent) => {

    if(!mod) {
      return 'unknown';
    }

    const m = mod.toLowerCase();

    let mode = m.replace(/~/g,'');
      //'~bus~': 'BUS',
      //'~train~': 'RAIL',
      //exchangepoints db values

    //OTP
    //return this == TRAM || this == SUBWAY || this == RAIL || this == BUS || this == FERRY
    //        || this == CABLECAR || this == GONDOLA || this == FUNICULAR || this == TRANSIT
    //        || this == AIRPLANE;
    //SIRI MODES https://github.com/VDVde/OJP/blob/master/siri_model/siri_modes-v1.1.xsd
    //
    //MIP
/*  <transitModes>
      TRAM
      SUBWAY
      RAIL
      FERRY
      BUS
      FUNICULAR
    </transitModes>
*/

    const modes = {
      ' ': 'unknown',
      'airplane': 'airService',
      'train': 'rail',
      'gondola': 'telecabin',
      'ferry': 'ferryService',
      'subway': 'underground',
      'funicular': 'funicularService',
     // 'tram': 'tramService'
    };

    mode =  modes[mode] || mode;

    return mode;
  }
}
