

base structure of any Docker service:

- a file *config.yml* contains common service configurations(example PORT) or specific setting for service
- a .env contains specific environment variables, this file is based on env.example for debugging mode of single service 


### Ports

default ports by services

  - api-ojp 8081
  - api-otp 8082
  - ep-manager 8083
  - db 8085
  - tests 8086 