
const {queryNode, queryNodes, queryText, queryTags} = require('./query');

module.exports = {

	'parseParamsRestrictions': (doc, serviceTag) => {

		const ptModes = queryTags(doc, [
			serviceTag,
			'ojp:Restrictions',
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
		  	, skip = Number(skipRestrictions || skipParams) || 0;

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