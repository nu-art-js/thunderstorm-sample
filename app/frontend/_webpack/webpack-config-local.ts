import * as fs from 'fs';
import {resolveGTMScript} from './utils';
import {WebPackEnvConfig} from './types';


const webPackConfig_Local: WebPackEnvConfig = {
	jsxMinify: false,
	cssMinify: false,
	outputFolder: 'local',
	gtmScript: resolveGTMScript('GTM-LOCAL'),
	hostingPort: 8000,
	devServerSSL: {
		key: String(fs.readFileSync('../../.config/.ssl/server-key.pem')),
		cert: String(fs.readFileSync('../../.config/.ssl/server-cert.pem')),
	},
};

module.exports = {...webPackConfig_Local};