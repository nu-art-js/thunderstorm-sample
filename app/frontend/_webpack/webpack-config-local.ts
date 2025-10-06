import * as fs from 'fs';
import {WebPackEnvConfig} from './types.ts';
import {resolveGTMScript} from './utils.js';


const config: WebPackEnvConfig = {
	jsxMinify: false,
	cssMinify: false,
	outputFolder: 'local',
	gtmScript: resolveGTMScript('GTM-LOCAL'),
	hostingPort: 8000,
	devServerSSL: {
		key: String(fs.readFileSync('.ssl/server-key.pem')),
		cert: String(fs.readFileSync('.ssl/server-cert.pem')),
	},
};

export default config;
