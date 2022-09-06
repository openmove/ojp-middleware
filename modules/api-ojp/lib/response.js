
const xmlbuilder = require('xmlbuilder');
const _ = require('lodash');

//TODO load config.errors

module.exports = {
  'createResponse': (stops, startTime, ptModes) => {
      //TODO
  },
  'createErrorResponse': (serviceName, errorDesc = 'GENERIC_ERROR', startTime, errObj, continueAt = null ) => {

    const now = new Date()
        , tag = xmlbuilder.create(`ojp:${serviceName}Delivery`);
    tag.ele('siri:ResponseTimestamp', now.toISOString());
    tag.ele('siri:Status', false);

    tag.ele('ojp:CalcTime', now.getTime() - startTime);

    if ( continueAt !== null ) {
      tag.ele('ojp:ContinueAt', continueAt);
    }

    const err = tag.ele('siri:ErrorCondition');

    err.ele('siri:Description', `${serviceName}_${errorDesc}`);

    if (errObj && errObj.code) {
      const oErr = err.ele('siri:OtherError');
      oErr.ele('siri:ErrorText', errObj.code);
    }

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
    return _.capitalize([_.trim(route.shortName), _.trim(route.longName)/*, route.gtfsId*/].join(' '));
  },

  stopText: stop => {
    const sep = ' ';
    let desc = _.trim(stop.desc);
    desc = desc ? `- ${desc}` : '';
    return _.capitalize([stop.code, _.trim(stop.name), _.trim(desc)].join(sep)).trim();
  }
}
