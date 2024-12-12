import {HTMLMinificationOptions} from './types';

export const resolveGTMScript = (gtmId: string) => {
	return '';
	// return `\n${fs.readFileSync('./src/main/scripts/gtm.js', 'utf8')}\ngtm(window, document, 'script', 'dataLayer', "${gtmId}");`;
};

export const resolveFCMScript = () => {
	return '';
	// return `\n${fs.readFileSync('./src/main/scripts/fcm.js', 'utf8')};`;
};

export const fullHTMLMinification: HTMLMinificationOptions = {
	removeComments: true,
	collapseWhitespace: true,
	removeRedundantAttributes: true,
	useShortDoctype: true,
	removeEmptyAttributes: true,
	removeStyleLinkTypeAttributes: true,
	keepClosingSlash: true,
	minifyJS: true,
	minifyCSS: true,
	minifyURLs: true
};
