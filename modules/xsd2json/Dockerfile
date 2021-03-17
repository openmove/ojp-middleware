FROM node:12.21.0-alpine3.11

WORKDIR /home

COPY ./ ./

RUN npm install

EXPOSE 8080
CMD ["node", "index.js"]
