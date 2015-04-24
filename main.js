#!/usr/bin/env node

var azure = require('azure-storage');
var _ = require('lodash');
var fs = require('fs');
var glob = require('glob');
var crypto = require('crypto');
var async = require('async');
var path = require('path');
var program = require('commander');
var rsync = require('./lib/rsync');

program
    .version('0.0.1')
    .usage('[options] <container> <dirpath>')
    .option('--storageAccount <s>', 'Storage account. Either storageAccount or connectionString')
    .option('--storageAccessKey <s>', 'Storage Access Key. Only with --storage account.')
    .option('--connectionString <s>', 'Connection StringEither storageAccount or connectionString')
    .parse(process.argv);

var storageAccountOrConnectionString = process.env['AZURE_STORAGE_CONNECTION_STRING'] || process.env['AZURE_STORAGE_ACCOUNT'];
var storageAccessKey = process.env['AZURE_STORAGE_ACCESS_KEY'];

storageAccountOrConnectionString = program.storageAccount || storageAccountOrConnectionString;
storageAccountOrConnectionString = program.connectionString || storageAccountOrConnectionString;
storageAccessKey = program.storageAccessKey || storageAccessKey;

var container = program.args[0];
var folder = program.args[1];

rsync.rsync(storageAccountOrConnectionString, storageAccessKey, container, folder);
