"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var express = require("express");
var request = require("request");
var fs = require("fs");
var _express = express();
var _counter = 0;
_express.all('*', function (req, res) {
    var counter = ++_counter;
    var qMark = req.originalUrl.indexOf('?');
    var query = qMark > 1 ? req.originalUrl.substring(qMark) : '';
    var path = req.path;
    var url = "http://127.0.0.1:8001/shopify-manager-tool-dev/us-central1/api".concat(path).concat(query);
    if (path.startsWith('/emulatorDownload') || path.startsWith('/emulatorUpload'))
        url = "http://127.0.0.1:8001/shopify-manager-tool-dev/us-central1".concat(path).concat(query);
    console.log("PROXY ".concat(counter, " - [").concat(req.method, "] ").concat(url));
    try {
        var reqContent = void 0;
        if (req.method === 'POST') {
            reqContent = request.post({ uri: url, body: req.body });
        }
        else if (req.method === 'PUT') {
            reqContent = request.put({ uri: url, body: req.body });
        }
        else if (req.method === 'GET') {
            reqContent = request.get(url);
        }
        else if (req.method === 'DELETE') {
            reqContent = request.delete(url);
        }
        else if (req.method === 'HEAD') {
            reqContent = request.head(url);
        }
        else {
            reqContent = request(url);
        }
        req.pipe(reqContent).pipe(res, { end: true });
        console.log("PROXY ".concat(counter, " - END"));
    }
    catch (e) {
        console.log("ERROR calling: ".concat(url), e);
        res.end(500);
    }
});
var ssl = {
    key: '.config/ssl/server-key.pem',
    cert: '.config/ssl/server-cert.pem'
};
var key = ssl.key;
if (!ssl.key.startsWith('-----BEGIN'))
    key = fs.readFileSync(ssl.key, 'utf8');
var cert = ssl.cert;
if (!ssl.cert.startsWith('-----BEGIN'))
    cert = fs.readFileSync(ssl.cert, 'utf8');
var options = {
    key: key,
    cert: cert,
    rejectUnauthorized: false,
    requestCert: false,
};
require('https').createServer(options, _express).listen(8008);
console.log('SSL proxy started!!!');
