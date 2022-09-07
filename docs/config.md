
## CONFIGURATION

each module of project contains a single **config.yml** file
it define service configurations(example PORT).

*dev* and *prod* implement two different environments, development and production,
prod also refers to *docker-compose.yml* in the project root.

Outside of *dev* and *prod* are common configurations to the two environments.

Below of common structure of a config.yml file:
```yaml
environments:
  default: prod
dev:
  server:
    port: 8083
  db:
    uri: mongodb://${MONGO_HOST}:${MONGO_PORT}/
    name: ojp
    collection: exchange_points
prod:
  server:
    port: 9093
  db:
    uri: mongodb://db/
    name: ojp
    collection: ${dev.db.collection}

import:
  version: 0.16
  csvFile: 5T.csv
...

```
these config files may contain environment variables that are valued at runtime.
In this example ```MONGO_HOST```, ```MONGO_PORT```

the same values defined within the yml file can be used to make substitutions at runtime
In this example ```${dev.db.collection}```

defaults project ports configurations listed here: [services.md#ports](services.md#ports)
