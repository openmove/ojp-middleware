
# API OJP

OJP entrypoint

implements this OJP entrypoints:

- OJPLocationInformation
- OJPTrip
- OJPStopEvent
- OJPTripInfo
- OJPExchangePoints
- OJPMultiPointTrip

## default restrictions by config.yml

- transfer_limit (default: 2, ojp:TransferLimit)
- include_accessibility (default: false, ojp:IncludeAccessibility)
- include_intermediate_stops (default: false, ojp:IncludeIntermediateStops)
- limit: 10000
- skip: 0