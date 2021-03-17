const express = require('express');
const https = require('https');
const _ = require('lodash');
const csv2json = require('csvtojson');
const config = require('./config');

const app = express();

console.log("Start API_OJP...")

console.log("Config:\n", config);
