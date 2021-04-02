# OJP middleware

Open API for distributed Journey Planning to OpentripPlanner Middleware as a Passive System


## Structure

[Monorepo](https://codefresh.io/howtos/lerna-monorepo/) that contains NPM modules and Docker microservices

```
.
├── docs
│   ├── modules.md
│   ├── README.md
│   └── services.md
├── modules
│   ├── api-ojp
│   │   ├── config.yml
│   │   ├── Dockerfile
│   │   ├── env.example
│   │   ├── index.js
│   │   ├── package.json
│   │   └── services
│   ├── api-otp
│   │   ├── config.yml
│   │   ├── Dockerfile
│   │   ├── env.example
│   │   ├── node_modules
│   │   └── package.json
│   ├── ep-manager
│   │   ├── config.yml
│   │   ├── Dockerfile
│   │   ├── download/
│   │   ├── env.example
│   │   ├── import/
│   │   ├── package.json
│   │   └── README
│   ├── ojp-loader
│   │   ├── config.yml
│   │   ├── download/
│   │   ├── env.example
│   │   ├── import/
│   │   ├── index.js
│   │   ├── package.json
│   │   └── xsd-schemas/
│   ├── utils
│   │   ├── config.js
│   │   ├── index.js
│   │   └── package.json
│   └── xsd2json
│       ├── config.yml
│       ├── Dockerfile
│       ├── env.example
│       ├── index.js
│       ├── package.json
│       └── README
├── tests/
├── lerna.json
├── docker-compose.yml
├── package.json
└── README.md
```

## Documentation

[README](docs/README.md)

## References

OJP standard:

[CEN/TS 17118:2017](https://standards.cen.eu/dyn/www/f?p=204:110:0::::FSP_LANG_ID,FSP_PROJECT:25,62236&cs=1B542F8CC8406A0BD65B6937689DD7740)

API XSD schemas:

https://github.com/VDVde/OJP


## Setup

```bash
npm install
lerna bootstrap
```
