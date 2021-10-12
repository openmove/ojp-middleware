
const _ = require('lodash');

const {queryNode, queryNodes, queryText, queryTags} = require('./query');

module.exports = {

	'parseGeoRestrictions': (doc, serviceTag) => {
		//TODO
	},

	'parseParamsRestrictions': (doc, serviceTag) => {

		const ptModesRestrictions = queryTags(doc, [
			serviceTag,
			'ojp:Restrictions',
			'ojp:IncludePtModes'
		]);

		const ptModesParams = queryTags(doc, [
			serviceTag,
			'ojp:Params',
			'ojp:IncludePtModes'
		]);

		const limitRestrictions = queryTags(doc, [
			serviceTag,
			'ojp:Restrictions',
			'ojp:NumberOfResults'
		]);

		const limitParams = queryTags(doc, [
			serviceTag,
			'ojp:Params',
			'ojp:NumberOfResults'
		]);

		const skipRestrictions = queryTags(doc, [
			serviceTag,
			'ojp:Restrictions',
			'ojp:ContinueAt'
		]);

		const skipParams = queryTags(doc, [
			serviceTag,
			'ojp:Params',
			'ojp:ContinueAt'
		]);

		const limit = Number(limitRestrictions || limitParams) || 0
		  	, skip = Number(skipRestrictions || skipParams) || 0
		  	, ptModes = ptModesRestrictions === 'true' || ptModesParams === 'true' || false;

		return {
			limit,
			skip,
			ptModes,
			limitRestrictions,
			limitParams,
			skipRestrictions,
			skipParams
		};
	}

}