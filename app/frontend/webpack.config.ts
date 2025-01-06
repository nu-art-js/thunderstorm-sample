/* eslint-disable @typescript-eslint/no-var-requires */
import * as path from 'path';
import * as webpack from 'webpack';
import {CleanWebpackPlugin} from 'clean-webpack-plugin';
import 'webpack-dev-server';
import {WebPackEnvConfig, WebPackEnvs} from './_webpack/types';

//Plugins
const HtmlWebPackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const {WebpackManifestPlugin} = require('webpack-manifest-plugin');

//Consts
const packageJson = require('./package.json');
// const swChunkName = 'pubsub-sw';
const outputFolder = path.resolve(__dirname, `dist`);
const sourcePath = path.join(__dirname, './src');
// const swFolder = path.join(__dirname, './src/sw/');
const mainFolder = path.join(__dirname, './src/main/');
const mainConfig = path.join(__dirname, './src/main/tsconfig.json');

type ConfigParams = {
	app: {
		env: WebPackEnvs
	}
}

const webPackConfig = (params: ConfigParams): webpack.Configuration => {
	const env = params.app.env;
	const config = require(`./_webpack/webpack-config-${env}`) as WebPackEnvConfig;

	const devServer = {
		historyApiFallback: true,
		compress: true,
		static: outputFolder,
		server: {type: 'https', options: config.devServerSSL},
		port: config.hostingPort,
		hot: true
	};

	const wpConfig: webpack.Configuration = {
		context: sourcePath,
		target: ['web'],
		entry: {
			main: './main/index.tsx',
			// [swChunkName]: './sw/index.ts',
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
						chunks(chunk) {
							// return chunk.name !== swChunkName;
							return true;
						},
						test: /.\/node_modules[\\/]/,
						name: 'vendors',
					}
				}
			},
		},

		devtool: 'source-map',

		resolve: {
			...config.resolve,
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
				vm: require.resolve('vm-browserify')
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
			extensions: ['.js', '.jsx', '.json', '.ts', '.tsx', '.scss']
		},

		module: {
			rules: [
				{
					test: /main\/.+\.tsx?$/,
					include: [mainFolder],
					use: {
						loader: 'ts-loader',
						options: {
							configFile: mainConfig
						}
					}
				},
				// {
				// 	test: /sw\/index.ts$/,
				// 	include: [swFolder],
				// 	loader: 'ts-loader',
				// },
				{
					loader: 'source-map-loader',
					enforce: 'pre',
					test: /\.js$/,
					exclude: [/node_modules/, /dist/, /build/, /__test__/]
				},
				{
					test: /\.[ot]tf$/,
					use: [
						{
							loader: 'url-loader',
							options: {
								limit: 10000,
								mimetype: 'application/octet-stream',
								name: 'fonts/[name].[ext]',
							}
						}
					]
				},
				{
					test: /\.json$/,
					exclude: /node_modules/,
				},
				{
					test: /\.[ot]tf$/,
					type: 'asset/resource',
				},
				{
					test: /\.(jpe?g|png|gif|ico)$/i,
					type: 'asset/resource'
				},
				{
					test: /\.svg$/,
					issuer: /\.[jt]sx?$/,
					use: [{
						loader: '@svgr/webpack',
						options: {
							typescript: true,
						}
					}, 'url-loader']
				},
				{
					test: /\.s?[c|a]ss$/,
					use: [
						'style-loader',
						MiniCssExtractPlugin.loader,
						// Translates CSS into CommonJS
						'css-loader',
						// Compiles Sass to CSS
						'sass-loader',
					]
				},
			]
		},

		plugins: [
			new webpack.DefinePlugin({
				'process.env': {
					'appEnv': `"${env}"`,
					'appVersion': `"${packageJson.version}"`
				},
				'process.browser': JSON.stringify(true)
			}),
			new CleanWebpackPlugin({cleanStaleWebpackAssets: false}),
			new MiniCssExtractPlugin({
				// filename: 'main/res/styles.[contenthash].css',
				filename: 'main/res/styles.[name].css',
			}),
			new HtmlWebPackPlugin({
				inject: true,
				favicon: './main/favicon.ico',
				template: './main/index.ejs',
				filename: './index.html',
				minify: config.htmlMinificationOptions,
				// excludeChunks: [swChunkName]
			}),
			new WebpackManifestPlugin()
		].filter(plugin => plugin),
	};

	//@ts-ignore
	wpConfig.devServer = devServer;

	return wpConfig;
};

export default webPackConfig;