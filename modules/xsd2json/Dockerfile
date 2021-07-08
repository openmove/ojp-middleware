FROM node:14.16.0-alpine3.11

WORKDIR /home

COPY ./ ./

RUN npm install

EXPOSE 8080
CMD ["node", "index.js"]
