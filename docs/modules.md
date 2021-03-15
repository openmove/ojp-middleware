
## Modules

- api-ojp
- api-otp
- ep-manager
- ojp-loader
- utils
- xsd2json

### api-ojp

OJP entrypoint

implements this OJP entrypoints:

- OJPLocationInformation
- OJPTrip
- OJPStopEvent
- OJPTripInfo
- OJPExchangePoints
- OJPMultiPointTrip

### api-otp

maintain connection to OTP instance


### ep-manager

OJP exchangepoint mananger
exchange point collect stops


### ojp-loader

auto download official OJP xsd files and sync

this module depends from module xsd2json

- download OJP xsd defitions covert in json
- import in shared Mongodb database OR node cache
- notify other microservices to updated versions of ojp xsd and reload its

#### npm scripts

```npm run download``` download last OJP xsd defintions
```npm run import``` download last OJP xsd defintions


### xsd2json

traductor of XSD schema definitions into JSONschema or JSON for nodejs


### utils

modules nodejs shared with other modules:
- utils methods
- shared convertion funcions
- db connections
- validators OJP request/response 

