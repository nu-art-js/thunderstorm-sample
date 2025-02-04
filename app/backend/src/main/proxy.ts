import express from 'express';
import request from 'request';
import * as fs from 'fs';


const _express: express.Express = express();
let _counter = 0;
_express.all('*', (req, res) => {
	const counter = ++_counter;
	const qMark = req.originalUrl.indexOf('?');
	const query = qMark > 1 ? req.originalUrl.substring(qMark) : '';
	const path = req.path;
	let url = `http://127.0.0.1:8123/shopify-manager-tool-dev/us-central1/api${path}${query}`;
	if (path.startsWith('/emulatorDownload') || path.startsWith('/emulatorUpload'))
		url = `http://127.0.0.1:8123/shopify-manager-tool-dev/us-central1${path}${query}`;

	console.log(`PROXY ${counter} - [${req.method}] ${url}`);

	const handleError = (error: any) => {
	    if(!error)
	        return;
		console.log(`ERROR calling: ${url}`, error);
	};

	try {
		let reqContent;
		if (req.method === 'POST') {
			reqContent = request.post({uri: url, body: req.body}, handleError);
		} else if (req.method === 'PUT') {
			reqContent = request.put({uri: url, body: req.body}, handleError);
		} else if (req.method === 'GET') {
			reqContent = request.get(url, handleError);
		} else if (req.method === 'DELETE') {
			reqContent = request.delete(url, handleError);
		} else if (req.method === 'HEAD') {
			reqContent = request.head(url, handleError);
		} else {
			reqContent = request(url, handleError);
		}

		req.pipe(reqContent).pipe(res, {end: true});
		console.log(`PROXY ${counter} - END`);
	} catch (e) {
		console.log(`ERROR calling: ${url}`, e);
		res.end(500);
	}
});

const ssl = {
	key: '/Users/tacb0ss/dev/nu-art/shopify-web-tool/.config/.ssl/server-key.pem',
	cert: '/Users/tacb0ss/dev/nu-art/shopify-web-tool/.config/.ssl/server-cert.pem'
};

let key = ssl.key;
if (!ssl.key.startsWith('-----BEGIN'))
	key = fs.readFileSync(ssl.key, 'utf8');

let cert = ssl.cert;
if (!ssl.cert.startsWith('-----BEGIN'))
	cert = fs.readFileSync(ssl.cert, 'utf8');

const options = {
	key: key,
	cert: cert,
	rejectUnauthorized: false,
	requestCert: false,
};

require('https').createServer(options, _express).listen(8122);
console.log('SSL proxy started!!!');