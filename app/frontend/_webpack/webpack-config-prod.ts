import {fullHTMLMinification, resolveGTMScript} from './utils';
import {WebPackEnvConfig} from './types';


const webPackConfig_Prod: WebPackEnvConfig = {
	jsxMinify: false,
	cssMinify: false,
	outputFolder: 'prod',
	gtmScript: resolveGTMScript('GTM-PROD'),
	htmlMinificationOptions: fullHTMLMinification,
};

module.exports = {...webPackConfig_Prod};