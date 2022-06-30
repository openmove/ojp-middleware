
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

  'ptModesResponse': mod => {   //otp to siri modes

    if(!mod) {
      return 'unknown';
    }

    const m = mod.toLowerCase();

    let mode = m.replace(/~/g,'');
      //'~bus~': 'BUS',
      //'~train~': 'RAIL',
      //exchangepoints db values

    //OTP MODES:
    //  TRAM, SUBWAY, RAIL, BUS, FERRY, CABLECAR, GONDOLA, FUNICULAR, TRANSIT, AIRPLANE;
    //
    //SIRI MODES
    //  lib/siri_modes.txt
    //
    //MIP

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
  },

  precisionMeters: config => {
    const preMap = {
      '1': 11100, //0.1
      '2': 1110,  //0.01
      '3': 111,   //0.001
      '4': 11,    //0.0001
      '5': 1,     //0.00001
    }

    return preMap[ config.location_digits.toString(10) ] || 1 ;
  },

  lineText: route => {
    return _.capitalize([route.shortName, route.longName/*, route.gtfsId*/].join(' '));
  },

  stopText: stop => {
    return _.capitalize([stop.name, stop.code, stop.desc].join(' '));
  }
}
