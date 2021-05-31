FROM timbru31/java-node:8-jdk-14

WORKDIR /home

COPY ./ ./

RUN npm install

EXPOSE 8080
CMD ["node", "index.js"]
