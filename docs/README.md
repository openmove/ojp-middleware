
# OJP Middleware Documentation

## Modules

all modules are single npm packages some are dependent on each other

- api-ojp
- api-otp
- ep-manager
- tests

[learn more](modules.md)

## Services

some of modules implement a Docker service running in individual container 
and associated with a specific port to an Api REST interface.

*docker-compose.yml* this sets up the infrastructure to make these services interact

- api-ojp
- api-otp
- ep-manager

[learn more](services.md)

## Config

each module of project contains a single *config.yml* file it define contains service configurations

[learn more](config.md)


## Structure

Common structure for modules and services is:
- config.yml
- index.js
- package.json

and for services is:
- Dockerfile
- env.example(renamed to .env in dev environment)

The basic structure of code:
```
.
├── modules
│        ├── api-ojp
│        │        ├── services/
│        │        ├── Dockerfile
│        │        ├── index.js
│        │        ├── config.yml
│        │        └── package.json
│        ├── api-otp
│        │        ├── config.yml
│        │        ├── Dockerfile
│        │        └── package.json
│        ├── ep-manager
│        │        ├── download/
│        │        ├── csvs/
│        │        ├── config.yml
│        │        ├── Dockerfile
│        │        ├── import.js
│        │        └── package.json
│        ├── tests
│        │        ├── xmls/
│        │        ├── config.yml
│        │        ├── index.js
│        │        └── package.json
│        └── db
│                 ├── dumps/
│                 ├── data/
│                 └── export.sh
│
├── docker-compose.yml
└── package.json
```

## References

OJP general api docs:
https://github.com/VDVde/OJP/tree/markdowns


api requests/response docs:

https://vdvde.github.io/OJP/generated/OJP.html
