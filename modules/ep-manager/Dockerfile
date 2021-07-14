FROM node:14.16.0-alpine3.11

WORKDIR /home

COPY ./ ./

RUN npm install

RUN ls -la

EXPOSE 8083
CMD ["node", "index.js"]
