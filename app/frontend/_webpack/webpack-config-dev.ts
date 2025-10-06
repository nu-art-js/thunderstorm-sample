import {resolveGTMScript} from './utils.ts';
import {WebPackEnvConfig} from './types.ts';


const config: WebPackEnvConfig = {
	jsxMinify: false,
	cssMinify: false,
	outputFolder: 'dev',
	gtmScript: resolveGTMScript('GTM-DEV'),
};

export default config;
