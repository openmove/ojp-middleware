
# API OJP

OJP entrypoint

implements this OJP entrypoints:

- OJPLocationInformation
- OJPTrip
- OJPStopEvent
- OJPTripInfo
- OJPExchangePoints
- OJPMultiPointTrip

## default environments variables

`OTP_MAX_PARALLEL_REQUESTS` maximum number of parallel request to OpenTripPlanner

## default restrictions by config.yml

- _include_intermediate_stops:_ value of `ojp:IncludeIntermediateStops` (default: false)
- _include_accessibility:_ 		value of `ojp:IncludeAccessibility` (default: false)
- _ojptag_in_response:_ 	include namespace ':ojp' in all tags in results (default: true)
- _include_precision:_ 		include `ojp:Precision` tag in reponses (default: false)
- _location_digits:_ 		precision for all coordinates in reponses (default:5)
- _transfer_limit:_ 	value of `ojp:TransferLimit` in reponses (default: 2)
- _limit:_ 				limits of results (default: 10000)
- _skip:_ 				results starting from (default: 0)