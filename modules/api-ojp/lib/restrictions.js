
const _ = require('lodash');

const {queryNode, queryNodes, queryText, queryTags} = require('./query');

module.exports = {

/*	'parseGeoPosition': (doc, serviceTag, config) => {
//TODO maybe
	},*/

	'parseGeoRestriction': (doc, serviceTag, config) => {

        const rect = queryNode(doc, [serviceTag,'InitialInput','GeoRestriction','Rectangle']);

        const circle = queryNode(doc, [serviceTag,'InitialInput','GeoRestriction','Circle']);

		const upperLat = queryTags(doc, [serviceTag,'InitialInput','GeoRestriction','Rectangle','UpperLeft','Latitude']);
		const upperLon = queryTags(doc, [serviceTag,'InitialInput','GeoRestriction','Rectangle','UpperLeft','Longitude']);
		const lowerLat = queryTags(doc, [serviceTag,'InitialInput','GeoRestriction','Rectangle','LowerRight','Latitude']);
		const lowerLon = queryTags(doc, [serviceTag,'InitialInput','GeoRestriction','Rectangle','LowerRight','Longitude']);
		const centerLat = queryTags(doc, [serviceTag,'InitialInput','GeoRestriction','Circle','Center','Latitude']);
		const centerLon = queryTags(doc, [serviceTag,'InitialInput','GeoRestriction','Circle','Center','Longitude']);
		const radius = queryTags(doc, [serviceTag,'InitialInput','GeoRestriction','Circle','Radius']);

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

		let transferLimit = queryTags(doc, [serviceTag, 'Params','TransferLimit']);

		let accessibility = queryTags(doc, [serviceTag, 'Params','IncludeAccessibility']);

        let intermediateStops = queryTags(doc, [serviceTag, 'Params', 'IncludeIntermediateStops']);

		let trackSections = queryTags(doc, [serviceTag, 'Params','IncludeTrackSections']);

		let legProjection = queryTags(doc, [serviceTag, 'Params','IncludeLegProjection']);

        const dateStart = queryTags(doc, [serviceTag, 'Origin','DepArrTime']);
        const dateEnd = queryTags(doc, [serviceTag, 'Destination','DepArrTime']);

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

        if (trackSections === 'true') {
        	trackSections = true;
        }
        else if(trackSections === 'false') {
        	trackSections = false
        }

        if (legProjection === 'true') {
        	legProjection = true;
        }
        else if(legProjection === 'false') {
        	legProjection = false
        }

	    //TODO add condition by params <IncludeTrackSections>true</IncludeTrackSections>

		return {
			transferLimit,
			accessibility,
			intermediateStops,
			trackSections,
			legProjection,
			dateStart,
			dateEnd
		}
	},

	'parseParamsRestrictions': (doc, serviceTag, config) => {

		const ptModesRestrictions = queryTags(doc, [
			serviceTag,
			'Restrictions',
			'IncludePtModes'
		]);

		const ptModesParams = queryTags(doc, [
			serviceTag,
			'Params',
			'IncludePtModes'
		]);

		const ptModeFilterExclude = queryTags(doc, [
			serviceTag,
			'Params',
			'PtModeFilter',
			'Exclude'
		]);

		const ptModeFilterNodes = queryNodes(doc, [
			serviceTag,
			'Params',
			'PtModeFilter',
			'PtMode'
		]);

		const limitRestrictions = queryTags(doc, [
			serviceTag,
			'Restrictions',
			'NumberOfResults'
		]);

		const limitParams = queryTags(doc, [
			serviceTag,
			'Params',
			'NumberOfResults'
		]);

		const skipRestrictions = queryTags(doc, [
			serviceTag,
			'Restrictions',
			'ContinueAt'
		]);

		const skipParams = queryTags(doc, [
			serviceTag,
			'Params',
			'ContinueAt'
		]);

		const typeRestrictions = queryTags(doc, [
			serviceTag,
			'Restrictions',
			'Type'
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

	    if (ptModeFilterNodes.length > 0) {

	    	for(const ptMode of ptModeFilterNodes) {
	    		ptModeFilter.push(ptMode.childNodes[0].textContent)
	    	}
	    }

		return {
			limit,
			skip,
			ptModes,
			ptModeExclude,
			ptModeFilter,
			limitRestrictions,
			limitParams,
			skipRestrictions,
			skipParams,
			type
		};
	}

}