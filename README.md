# OJP middleware

Open API for distributed Journey Planning to OpentripPlanner Middleware as a Passive System.

The project is structured as a [Monorepo](https://codefresh.io/howtos/lerna-monorepo/) that contains NPM modules and Docker microservices

## Documentation

[Main Docs](docs/README.md)
- [Structure](docs/README.md#structure)
- [Modules](docs/modules.md)
- [Services](docs/services.md)

## References

OJP standard:

[CEN/TS 17118:2017](https://standards.cen.eu/dyn/www/f?p=204:110:0::::FSP_LANG_ID,FSP_PROJECT:25,62236&cs=1B542F8CC8406A0BD65B6937689DD7740)

API XSD schemas:

https://github.com/VDVde/OJP


## Setup

### quick start

download remote dependecies
```bash
npm install
```

resolve and link internal dependecies
```bash
lerna bootstrap
```

### update commands

...work in progress...

