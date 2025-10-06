import type * as webpack from 'webpack';
import pkg from 'webpack';
import * as path from 'node:path';
import {dirname} from 'node:path';
import {createRequire} from 'node:module';

import 'webpack-dev-server';
import {CleanWebpackPlugin} from 'clean-webpack-plugin';
import HtmlWebPackPlugin from 'html-webpack-plugin';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import {WebpackManifestPlugin} from 'webpack-manifest-plugin';

import {WebPackEnvConfig, WebPackEnvs} from './_webpack/types.ts';
import {fileURLToPath} from 'node:url';

const {DefinePlugin} = pkg;

// ESM-safe replacements for __filename/__dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);


// ────────────────────────────────────────────────────────────────────────────────
// ESM-safe access to package.json
// (works even with "type":"module" in your repo)
const require = createRequire(import.meta.url);
const packageJson = require('./package.json');

// ────────────────────────────────────────────────────────────────────────────────
// Paths
const outputFolder = path.resolve(__dirname, 'dist');
const sourcePath = path.join(__dirname, './src');
const mainFolder = path.join(__dirname, './src/main/');
const mainConfig = path.join(__dirname, './src/main/tsconfig.json');

// ────────────────────────────────────────────────────────────────────────────────
type ConfigParams = { app: { env: WebPackEnvs } };

const webPackConfig = async (params: ConfigParams): Promise<webpack.Configuration> => {
	const env = params.app.env;
	const {default: config} = await import(`./_webpack/webpack-config-${env}.ts`) as { default: WebPackEnvConfig };

	const devServer: NonNullable<webpack.Configuration['devServer']> = {
		historyApiFallback: true,
		compress: true,
		static: outputFolder,
		server: {type: 'https', options: config.devServerSSL},
		port: config.hostingPort,
		hot: true,
	};

	const wpConfig: webpack.Configuration = {
		context: sourcePath,
		target: ['web'],
		entry: {
			main: './main/index.tsx',
			// sw: './sw/index.ts',
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
						chunks() {
							// return chunk.name !== 'sw';
							return true;
						},
						// FIX: proper node_modules regex
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
			...config.resolve,

			// CRUCIAL for “.js in TS imports” to resolve your .ts/.tsx sources
			extensionAlias: {
				'.js': ['.ts', '.tsx', '.js'],
				'.mjs': ['.mts', '.mjs'],
				'.cjs': ['.cts', '.cjs'],
			},

			// Optional: relax ESM “fully specified” requirement for bare imports
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

				// Use Webpack 5 asset modules instead of url-loader/file-loader for fonts & images
				{
					test: /\.[ot]tf$/i,
					type: 'asset/resource',
					generator: {filename: 'fonts/[name][ext]'},
				},
				{
					test: /\.(jpe?g|png|gif|ico)$/i,
					type: 'asset/resource',
				},

				// SVG as React component when imported from TS/TSX
				{
					test: /\.svg$/i,
					// ensure .svg from your lib’s dist are transformed too
					issuer: /\.[jt]sx?$/,
					use: [
						{
							loader: '@svgr/webpack',
							options: {
								typescript: true,
								exportType: 'named',
								namedExport: 'ReactComponent',
								icon: true, // optional, removes width/height for easier styling
							},
						},
					],
				},

				// SCSS / CSS
				{
					test: /\.s?[ac]ss$/,
					use: [
						// In dev you might prefer 'style-loader'; MiniCssExtract is fine universally
						MiniCssExtractPlugin.loader,
						'css-loader',
						'sass-loader',
					],
				},
			],
		},

		plugins: [
			new DefinePlugin({
				// keep original env shape for existing code
				'process.env': {
					appEnv: `"${env}"`,
					appVersion: `"${packageJson.version}"`,
				},
				// also expose standard key for libraries
				'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
				'process.browser': JSON.stringify(true),
			}),
			// output.clean already cleans; keeping CleanWebpackPlugin is harmless but redundant
			new CleanWebpackPlugin({cleanStaleWebpackAssets: false}),
			new MiniCssExtractPlugin({
				filename: 'main/res/styles.[name].css',
			}),
			new HtmlWebPackPlugin({
				inject: true,
				favicon: './main/favicon.ico',
				template: './main/index.ejs',
				filename: './index.html',
				minify: config.htmlMinificationOptions,
				// excludeChunks: ['sw']
			}),
			new WebpackManifestPlugin({}),
		].filter(Boolean),
	};

	// @ts-ignore
	wpConfig.devServer = devServer;

	return wpConfig;
};

export default webPackConfig;
