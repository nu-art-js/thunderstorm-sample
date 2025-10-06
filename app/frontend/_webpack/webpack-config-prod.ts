import {fullHTMLMinification, resolveGTMScript} from './utils.ts';
import {WebPackEnvConfig} from './types.ts';


const config: WebPackEnvConfig = {
	jsxMinify: false,
	cssMinify: false,
	outputFolder: 'prod',
	gtmScript: resolveGTMScript('GTM-PROD'),
	htmlMinificationOptions: fullHTMLMinification,
};

export default config