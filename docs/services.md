
## Services

base structure of any Docker service:

- a file [config.yml](config.md) contains common service configurations(example PORT) or specific setting for service
- a .env contains specific environment variables, this file is based on env.example for debugging mode of single service 


### Ports

default ports in production environment by services

  - api-ojp 9091
  - api-otp 9092
  - ep-manager 9093
  - db 9095
  - tests 9096 