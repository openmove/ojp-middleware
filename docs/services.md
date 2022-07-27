
## Services

base structure of any Docker service:

- a file [config.yml](config.md) contains common service configurations(example PORT) or specific setting for service
- a .env contains specific environment variables, this file is based on env.example for debugging mode of single service 


### Ports

default ports in production environment by services

|  service  | production | development |
|-----------|------------|-----------|
| api-ojp | 9091 |  8081  |
| api-otp | 9092  | 8082  |
| ep-manager  | 9093  | 8083  |
| db  | 27017/9095  | - |
| tests | 9096  | 8086 |
