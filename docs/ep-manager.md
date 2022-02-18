
# exchangepoint manager

mongodb models to store ojp exchangepoints

TODO download.sh script to download remote exchangepoint

TODO maybe include NETEXT IFOPT
https://github.com/NeTEx-CEN/NeTEx/blob/master/xsd/ifopt.xsd


## import exchange points CSV data manually


```bash
CSV_VERSION=10 node import.js
```

### environment

```CSV_VERSION``` is directory inside csvs default is version param inside config.yml


```CSV_AUTOIMPORT``` is True enable auto import of exchange points csv data into database at startup


## usage in docker

```
docker-compose up ep-manager
```

browse: http://localhost:8083/

browse: http://localhost:8083/geojson

## development mode

```bash
docker-compose up db
npm run dev
```