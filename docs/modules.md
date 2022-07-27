
## Modules

- api-ojp
- api-otp
- ep-manager
- ojp-loader
- tests
- utils

### [api-ojp](api-ojp.md)

OJP entrypoint, implements OJP requests


### [api-otp](api-otp.md)

maintain connection to OTP instance


### [ep-manager](ep-manager.md)

OJP exchangepoint mananger
exchange point collect stops


### ojp-loader

auto download official OJP xsd files and sync

- download OJP xsd defitions covert in json
- import in shared Mongodb database OR node cache
- notify other microservices to updated versions of ojp xsd and reload its

### tests

simple web front-end to test OJP requests

### utils

modules nodejs shared with other modules:
- utils methods
- shared convertion funcions
- db connections
- validators OJP request/response 
