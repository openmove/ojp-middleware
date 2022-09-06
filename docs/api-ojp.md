
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

- transfer_limit (default: 2, ojp:TransferLimit)
- include_accessibility (default: false, ojp:IncludeAccessibility)
- include_intermediate_stops (default: false, ojp:IncludeIntermediateStops)
- include_precision (default: false)
- location_digits (default:5)
- ojptag_in_response: include namespace ':ojp' in all tags in results (default: true)
- limit limits of results (default: 10000)
- skip results starting from (default: 0)