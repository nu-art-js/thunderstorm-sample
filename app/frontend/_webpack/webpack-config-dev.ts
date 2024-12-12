import * as fs from 'fs';
import {resolveGTMScript} from './utils';
import {WebPackEnvConfig} from './types';


const webPackConfig_Dev: WebPackEnvConfig = {
	jsxMinify: false,
	cssMinify: false,
	outputFolder: 'dev',
	gtmScript: resolveGTMScript('GTM-DEV'),
};

module.exports = {...webPackConfig_Dev};