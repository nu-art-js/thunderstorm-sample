export type WebPackEnvs = 'local' | 'dev' | 'staging' | 'production';

export type HTMLMinificationOptions = {
	removeComments: boolean;
	collapseWhitespace: boolean;
	removeRedundantAttributes: boolean;
	useShortDoctype: boolean;
	removeEmptyAttributes: boolean;
	removeStyleLinkTypeAttributes: boolean;
	keepClosingSlash: boolean;
	minifyJS: boolean;
	minifyCSS: boolean;
	minifyURLs: boolean;
}

export type ServerSSL = {
	key: string;
	cert: string;
}

export type WebPackEnvConfig = {
	//General Props
	jsxMinify: boolean;
	cssMinify: boolean;
	outputFolder: string;
	gtmScript: string;

	//Conditional Props
	htmlMinificationOptions?: HTMLMinificationOptions;
	serverPort?: number;
	devServerSSL?: ServerSSL;
	hostingPort?: number;
	fcmScript?: string;
	prettifierPlugin?: any;
	resolve?: {
		symlinks?: boolean;
		modules?: string[];
	}
}