
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

	'parseTripRestrictions': (doc, serviceTag, config) => {

		let transferLimit = queryTags(doc, [serviceTag, 'ojp:Params','ojp:TransferLimit']);

		let accessibility = queryTags(doc, [serviceTag, 'ojp:Params','ojp:IncludeAccessibility']);

        let intermediateStops = queryTags(doc, [serviceTag, 'ojp:Params', 'ojp:IncludeIntermediateStops']);

        const dateStart = queryTags(doc, [serviceTag, 'ojp:Origin','ojp:DepArrTime']);
        const dateEnd = queryTags(doc, [serviceTag, 'ojp:Destination','ojp:DepArrTime']);

        transferLimit = Number(transferLimit) || config.default_restrictions.transfer_limit;

        if (accessibility === 'true') {
        	accessibility = true;
        }
        else if(accessibility === 'false') {
        	accessibility = false
        }
        else {
	    	accessibility = config.default_restrictions.include_accessibility;
	    }

        if (intermediateStops === 'true') {
        	intermediateStops = true;
        }
        else if(intermediateStops === 'false') {
        	intermediateStops = false
        }
        else {
	    	intermediateStops = config.default_restrictions.include_intermediate_stops;
	    }

		return {
			transferLimit,
			accessibility,
			intermediateStops,
			dateStart,
			dateEnd
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

		const ptModeFilterExclude = queryTags(doc, [
			serviceTag,
			'ojp:Params',
			'PtModeFilter',
			'Exclude'
		]);

		const ptModeFilterNodes = queryNodes(doc, [
			serviceTag,
			'ojp:Params',
			'PtModeFilter',
			'PtMode'
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

		const typeRestrictions = queryTags(doc, [
			serviceTag,
			'ojp:Restrictions',
			'ojp:Type'
		]);

		let ptModes = ''
			, limit = Number( Number(limitRestrictions) || Number(limitParams) || undefined )
		  	, skip = Number( Number(skipRestrictions) || Number(skipParams) || undefined )
			, type = 'stop'
			, ptModeExclude = false
			, ptModeFilter = []

		if (_.isNaN(limit)) {
			limit = Number(config.default_restrictions.limit);
		}

		if (_.isNaN(skip)) {
			skip = Number(config.default_restrictions.skip);
		}

		if (_.isString(typeRestrictions)) {
			type = typeRestrictions;
		}

		if (_.isString(ptModesRestrictions)) {
			ptModes = ptModesRestrictions;
		}
		else if (_.isString(ptModesParams)) {
			ptModes = ptModesParams;
		}

        if (ptModes === 'true') {
        	ptModes = true;
        }
        else if(ptModes === 'false') {
        	ptModes = false;
        }
        else {
	    	ptModes = config.default_restrictions.include_include_pt_modes;
	    }

	    if (ptModeFilterExclude === 'true') {
        	ptModeExclude = true;
        }
        else if(ptModeFilterExclude === 'false') {
        	ptModeExclude = false;
        }

	    if (ptModeExclude === false && ptModeFilterNodes) {

	    	for(const ptMode of ptModeFilterNodes) {
	    		ptModeFilter.push(ptMode.childNodes[0].textContent)
	    	}
	    	//ptModeFilter = ptModeFilterNodes
	    }

console.log("ptModeFilterParams---------------\n", ptModeExclude, "--------\n", ptModeFilter)

		return {
			limit,
			skip,
			ptModes,
			ptModeFilter,
			//additional
			limitRestrictions,
			limitParams,
			skipRestrictions,
			skipParams,
			type
		};
	}

}