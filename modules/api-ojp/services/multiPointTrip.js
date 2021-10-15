const xmlbuilder = require('xmlbuilder');
const qstr = require('querystring');

const {queryNode, queryNodes, queryText, queryTags} = require('../lib/query');
const {doRequest} = require('../lib/request');
const {parseParamsRestrictions} = require('../lib/restrictions');
const {createErrorResponse} = require('../lib/response');

const serviceName = 'OJPMultiPointTrip';

const createResponse = (trips, date, startTime) => {

	const now = new Date()
		, tag = xmlbuilder.create(`ojp:${serviceName}Delivery`);
	tag.ele('siri:ResponseTimestamp', now.toISOString());
	tag.ele('ojp:CalcTime', now.getTime() - startTime);

  	tag.ele('siri:Status', trips.length === 0 ? false : true);

	return tag;
};

module.exports = {
	'multipointTripExecution' : async (doc, startTime, config) => {
	
		const serviceTag = `ojp:${serviceName}Request`;

	    const {logger} = config;

	    const { limit, skip, ptModes } = parseParamsRestrictions(doc, serviceTag, config);

	    try {
			if(true
	        //TODO queryNodes
	        ){

				//TODO loop for each point/trip
				//
				//const trips = [];

				/*const options = {
					host: config['api-otp'].host,
					port: config['api-otp'].port,
					path: `/trip/${tripId}/${moment(date, 'YYYY-MM-DD').format('YYYYMMDD')}`,
					json: true,
					method: 'GET'
				}
				const response = await doRequest(options)
				logger.info(response)

				createResponse(trips, date, startTime);

				*/
			}
			else{
				return createErrorResponse(serviceName, config.errors.notagcondition, startTime);
			}
		} catch (err) {
			logger.error(err);
			return createErrorResponse(serviceName, config.errors.noparsing, startTime);
		}
	    
	}
}