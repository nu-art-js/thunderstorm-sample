import type * as webpack from 'webpack';
import pkg from 'webpack';
import * as path from 'node:path';
import * as fs from 'node:fs';
import {dirname} from 'node:path';
import {createRequire} from 'node:module';

import 'webpack-dev-server';
import {CleanWebpackPlugin} from 'clean-webpack-plugin';
import HtmlWebPackPlugin from 'html-webpack-plugin';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import {WebpackManifestPlugin} from 'webpack-manifest-plugin';
import {fileURLToPath} from 'node:url';

import {webpackEnvConfig} from './webpack-env.generated.ts';

const {DefinePlugin} = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const require = createRequire(import.meta.url);
const packageJson = require('./package.json');

const outputFolder = path.resolve(__dirname, 'dist');
const sourcePath = path.join(__dirname, './src');
const mainFolder = path.join(__dirname, './src/main/');
const mainConfig = path.join(__dirname, './src/main/tsconfig.json');

const fullHTMLMinification = {
	removeComments: true,
	collapseWhitespace: true,
	removeRedundantAttributes: true,
	useShortDoctype: true,
	removeEmptyAttributes: true,
	removeStyleLinkTypeAttributes: true,
	keepClosingSlash: true,
	minifyJS: true,
	minifyCSS: true,
	minifyURLs: true,
};

function getDevServerOptions(): NonNullable<webpack.Configuration['devServer']> {
	const port = webpackEnvConfig.devServerPort ?? 8000;
	const base: NonNullable<webpack.Configuration['devServer']> = {
		historyApiFallback: true,
		compress: true,
		static: outputFolder,
		port,
		hot: true,
	};
	if (webpackEnvConfig.devServerSSL) {
		if (!webpackEnvConfig.sslKey || !webpackEnvConfig.sslCert)
			throw new Error('devServerSSL is enabled but sslKey/sslCert paths are missing in webpackEnvConfig');

		base.server = {
			type: 'https',
			options: {
				key: fs.readFileSync(path.resolve(__dirname, webpackEnvConfig.sslKey), 'utf8'),
				cert: fs.readFileSync(path.resolve(__dirname, webpackEnvConfig.sslCert), 'utf8'),
			},
		};
	}
	return base;
}

const wpConfig: webpack.Configuration = {
	context: sourcePath,
	target: ['web'],
	entry: {
		main: './main/index.tsx',
	},

	output: {
		path: outputFolder,
		filename: '[name].js',
		publicPath: '/',
		clean: true,
	},

	optimization: {
		moduleIds: 'deterministic',
		splitChunks: {
			cacheGroups: {
				defaultVendors: {
					chunks: () => true,
					test: /[\\/]node_modules[\\/]/,
					name: 'vendors',
				},
			},
		},
	},

	devtool: 'source-map',

	cache: {type: 'filesystem'},
	infrastructureLogging: {level: 'warn'},
	stats: 'errors-warnings',

	resolve: {
		extensionAlias: {
			'.js': ['.ts', '.tsx', '.js'],
			'.mjs': ['.mts', '.mjs'],
			'.cjs': ['.cts', '.cjs'],
		},
		fullySpecified: false,
		fallback: {
			fs: false,
			tls: false,
			net: false,
			path: false,
			buffer: require.resolve('buffer/'),
			zlib: require.resolve('browserify-zlib'),
			util: require.resolve('util/'),
			http: false,
			https: false,
			stream: require.resolve('stream-browserify'),
			crypto: require.resolve('crypto-browserify'),
			vm: require.resolve('vm-browserify'),
		},
		alias: {
			'@modules': path.resolve(__dirname, 'src/main/modules'),
			'@styles': path.resolve(__dirname, 'src/main/res/styles'),
			'@res': path.resolve(__dirname, 'src/main/res'),
			'@consts': path.resolve(__dirname, 'src/main/app/consts'),
			'@pah': path.resolve(__dirname, 'src/main/app/pah'),
			'@form': path.resolve(__dirname, 'src/main/app/form'),
			'@page': path.resolve(__dirname, 'src/main/app/pages'),
			'@component': path.resolve(__dirname, 'src/main/app/components'),
			'@dialog': path.resolve(__dirname, 'src/main/app/dialogs'),
			'@renderer': path.resolve(__dirname, 'src/main/app/renderers'),
		},
		extensions: ['.js', '.jsx', '.json', '.ts', '.tsx', '.scss'],
	},

	module: {
		rules: [
			{
				test: /main\/.+\.tsx?$/,
				include: [mainFolder],
				use: {
					loader: 'ts-loader',
					options: {
						configFile: mainConfig,
					},
				},
			},
			{
				loader: 'source-map-loader',
				enforce: 'pre',
				test: /\.js$/,
				exclude: [/node_modules/, /dist/, /build/, /__test__/],
			},
			{
				test: /\.[ot]tf$/i,
				type: 'asset/resource',
				generator: {filename: 'fonts/[name][ext]'},
			},
			{
				test: /\.(jpe?g|png|gif|ico)$/i,
				type: 'asset/resource',
			},
			{
				test: /\.svg$/i,
				issuer: /\.[jt]sx?$/,
				use: [
					{
						loader: '@svgr/webpack',
						options: {
							typescript: true,
							exportType: 'named',
							namedExport: 'ReactComponent',
							icon: true,
						},
					},
				],
			},
			{
				test: /\.s?[ac]ss$/,
				use: [
					MiniCssExtractPlugin.loader,
					'css-loader',
					'sass-loader',
				],
			},
		],
	},

	plugins: [
		new DefinePlugin({
			'process.env': {
				appEnv: `"${webpackEnvConfig.envName}"`,
				appVersion: `"${packageJson.version}"`,
			},
			'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
			'process.browser': JSON.stringify(true),
		}),
		new CleanWebpackPlugin({cleanStaleWebpackAssets: false}),
		new MiniCssExtractPlugin({
			filename: 'main/res/styles.[name].css',
		}),
		new HtmlWebPackPlugin({
			inject: true,
			favicon: './main/favicon.ico',
			template: './main/index.ejs',
			filename: './index.html',
			minify: webpackEnvConfig.minifyHtml ? fullHTMLMinification : false,
		}),
		new WebpackManifestPlugin({}),
	],
};

wpConfig.devServer = getDevServerOptions();

export default wpConfig;
