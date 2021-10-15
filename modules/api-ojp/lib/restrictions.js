
const _ = require('lodash');

const {queryNode, queryNodes, queryText, queryTags} = require('./query');

module.exports = {

/*	'parseGeoPosition': (doc, serviceTag, config) => {
//TODO maybe
	},*/

	'parseGeoRestriction': (doc, serviceTag, config) => {

        const rect = queryNode(doc, [serviceTag,'ojp:InitialInput','ojp:GeoRestriction','ojp:Rectangle']);

        const circle = queryNode(doc, [serviceTag,'ojp:InitialInput','ojp:GeoRestriction','ojp:Circle']);

		const upperLat = queryTags(doc, [serviceTag,'ojp:InitialInput','ojp:GeoRestriction','ojp:Rectangle','ojp:UpperLeft','Latitude']);
		const upperLon = queryTags(doc, [serviceTag,'ojp:InitialInput','ojp:GeoRestriction','ojp:Rectangle','ojp:UpperLeft','Longitude']);
		const lowerLat = queryTags(doc, [serviceTag,'ojp:InitialInput','ojp:GeoRestriction','ojp:Rectangle','ojp:LowerRight','Latitude']);
		const lowerLon = queryTags(doc, [serviceTag,'ojp:InitialInput','ojp:GeoRestriction','ojp:Rectangle','ojp:LowerRight','Longitude']);
		const centerLat = queryTags(doc, [serviceTag,'ojp:InitialInput','ojp:GeoRestriction','ojp:Circle','ojp:Center','Latitude']);
		const centerLon = queryTags(doc, [serviceTag,'ojp:InitialInput','ojp:GeoRestriction','ojp:Circle','ojp:Center','Longitude']);
		const radius = queryTags(doc, [serviceTag,'ojp:InitialInput','ojp:GeoRestriction','ojp:Circle','ojp:Radius']);

		return {
			rect,
			upperLat,
			upperLon,
			lowerLat,
			lowerLon,
			//
			circle,
			centerLat,
			centerLon,
			radius
		}
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