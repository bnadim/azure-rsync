var azure = require('azure-storage');
var _ = require('lodash');
var fs = require('fs');
var glob = require('glob');
var crypto = require('crypto');
var async = require('async');
var path = require('path');

exports.listRemoteFiles = function (blobStorage, container, cb) {
    var filesInfos = {};
    blobStorage.listBlobsSegmented(container, null, function(err, result, response){
        if(err){
            return cb(err);
        }

        _.forEach(result.entries, function (file) {
            filesInfos[file.name] = file.properties['content-md5'];
        });
        cb(null, filesInfos);
    });
};

exports.computeMD5 = function (filepath, cb) {
    fs.createReadStream(filepath).pipe(crypto.createHash('md5').setEncoding('base64')).on('finish', function() {
        cb(null, this.read());
    })
};

exports.listLocalFiles = function (folderPath, cb) {
    var filesInfos = {};
    glob(folderPath + '/**/*', {realpath: true, nodir: true}, function (err, filespath) {
        async.map(filespath, function (filepath, callback) {
            var relativePath = path.relative(folderPath, filepath);
            exports.computeMD5(filepath, function(err, fileMD5) {
                filesInfos[relativePath] = fileMD5;
                callback(err);
            })
        }, function (err) {
            cb(err, filesInfos);
        });
    });
};

exports.compareFilesList = function (localFiles, remoteFiles) {
    var filesToDelete = [];
    var filesToUpload = [];
    _.forOwn(remoteFiles, function (remoteMD5, remoteFile) {
        if (!localFiles[remoteFile]) {
            filesToDelete.push(remoteFile);
        }
    });

    _.forOwn(localFiles, function (localeMD5, localFile) {
        if (remoteFiles[localFile] !== localeMD5) {
            filesToUpload.push(localFile);
        }
    });

    return {upload: filesToUpload, delete: filesToDelete};
};

exports.uploadFile = function (blobStorage, container, dirpath, filename, cb) {
    blobStorage.createBlockBlobFromLocalFile(container, filename, path.resolve(dirpath, filename), function (error, result, response) {
        if(error){
            console.log('Error uploading ' + filename, err);
            cb();
        }
        console.log('uploaded ', filename);
        cb();
    });
};

exports.deleteFile = function (blobStorage, container, filename, cb) {
    blobStorage.deleteBlob(container, filename, function (error, result, response) {
        if(error){
            console.log('Error deleting ' + filename, err);
            cb();
        }
        console.log('deleted ', filename);
        cb();
    });
};

exports.uploadFiles = function (blobStorage, container, dirpath, filenames, cb) {
    async.map(filenames, function (filename, callback) {
        exports.uploadFile(blobStorage, container, dirpath, filename, callback);
    }, function (err) {
        cb(err);
    });
};

exports.deleteFiles = function (blobStorage, container, filenames, cb) {
    async.map(filenames, function (filename, callback) {
        exports.deleteFile(blobStorage, container, filename, callback);
    }, function (err) {
        cb(err);
    });
};

exports.rsync = function (storageAccountOrConnectionString, storageAccessKey, container, dirpath) {
    var blobStorage = azure.createBlobService(storageAccountOrConnectionString, storageAccessKey);

    console.log('Listing remote files');
    exports.listRemoteFiles(blobStorage, container, function (err, remoteFiles) {
        if (err) {
            console.log('Error listing files ', err);
            return;
        }

        exports.listLocalFiles(dirpath, function (err, localFiles) {
            if (err) {
                console.log('Error listing local files');
                return;
            }

            var filesDiff = exports.compareFilesList(localFiles, remoteFiles);

            async.parallel([
                    function (callback) {
                        exports.uploadFiles(blobStorage, container, dirpath, filesDiff.upload, callback);
                    }, function (callback) {
                        exports.deleteFiles(blobStorage, container, filesDiff.delete, callback);
                    }],
                function (err) {
                    console.log('done');
                });
        });
    });
};
