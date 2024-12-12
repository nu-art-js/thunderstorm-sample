import {resolveGTMScript} from './utils';
import {WebPackEnvConfig} from './types';


const webPackConfig_Stg: WebPackEnvConfig = {
	jsxMinify: false,
	cssMinify: false,
	outputFolder: 'stg',
	gtmScript: resolveGTMScript('GTM-STG'),
};

module.exports = {...webPackConfig_Stg};