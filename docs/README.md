
# OJP Middleware Documentation


## Modules

all modules are single npm packages some are dependent on each other

- api-ojp
- api-otp
- ep-manager
- ojp-loader
- utils
- xsd2json

[learn more](modules.md)

## Services

some of modules implement a Docker service running in individual container 
and associated with a specific port to an Api REST interface.

*docker-compose.yml* this sets up the infrastructure to make these services interact

- api-ojp
- api-otp
- ep-manager
- ojp-loader
- xsd2json

[learn more](services.md)

## References

OJP general api docs:
https://github.com/VDVde/OJP/tree/markdowns


api requests/response docs:

https://vdvde.github.io/OJP/generated/OJP.html
