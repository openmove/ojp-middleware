const xmlbuilder = require('xmlbuilder');
const qstr = require('querystring');

const {queryNode, queryNodes, queryText, queryTags} = require('../lib/query');
const {doRequest} = require('../lib/request');
const {parseParamsRestrictions} = require('../lib/restrictions');

//TODO

module.exports = {
	'multipointTripExecution' : async (doc, startTime, config) => {
	
	    const {logger} = config;

	    const { limit, skip, ptModes } = parseParamsRestrictions(doc, serviceTag, config);

	    //TODO
	    
	}
}