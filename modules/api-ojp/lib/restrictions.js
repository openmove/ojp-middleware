
const _ = require('lodash');

const {queryNode, queryNodes, queryText, queryTags} = require('./query');

module.exports = {

	'parseGeoRestrictions': (doc, serviceTag, config) => {
		//TODO
	},

	'parseParamsRestrictions': (doc, serviceTag, config) => {

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

		let limit = Number( Number(limitRestrictions) || Number(limitParams) || undefined )
		  	, skip = Number( Number(skipRestrictions) || Number(skipParams) || undefined )
		  	, ptModes = ptModesRestrictions === 'true' || ptModesParams === 'true';

		if (_.isNaN(limit)) {
			limit = Number(config.default_restrictions.limit);
		}

		if (_.isNaN(skip)) {
			skip = Number(config.default_restrictions.skip);
		}

		return {
			limit,
			skip,
			ptModes,
			//additional
			limitRestrictions,
			limitParams,
			skipRestrictions,
			skipParams
		};
	}

}