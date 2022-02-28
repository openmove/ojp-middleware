#FROM node:14.16.0-alpine3.11
FROM node:16.14.0-alpine3.14

WORKDIR /home

COPY ./ ./

RUN npm install

CMD ["node", "index.js"]
