
## Modules

- api-ojp
- api-otp
- ep-manager
- ojp-loader
- utils
- xsd2json

## containers

defined in *docker-compose.yml*




### api-ojp

OJP entrypoint


### api-otp

maintain connection to OTP instance


### ep-manager

OJP exchangepoint mananger
exchange point collect stops


### ojp-loader

auto download official OJP xsd files and sync


### utils

modules nodejs shared with other modules:
- utils methods
- shared convertion funcions
- db connections
- validators OJP request/response 

### xsd2json

traductor of XSD schema definitions into JSONschema or JSON for nodejs

