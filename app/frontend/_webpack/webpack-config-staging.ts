import {resolveGTMScript} from './utils.ts';
import {WebPackEnvConfig} from './types.ts';


const config: WebPackEnvConfig = {
	jsxMinify: false,
	cssMinify: false,
	outputFolder: 'stg',
	gtmScript: resolveGTMScript('GTM-STG'),
};

export default config;
