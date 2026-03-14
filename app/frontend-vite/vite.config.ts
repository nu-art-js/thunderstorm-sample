import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import svgr from 'vite-plugin-svgr';
import {nodePolyfills} from 'vite-plugin-node-polyfills';
import {resolve} from 'path';
import {readFileSync} from 'fs';

const sslDir = resolve(__dirname, '../../.config/.ssl');
const getSSL = () => {
	try {
		return {
			key: readFileSync(resolve(sslDir, 'localhost.key')),
			cert: readFileSync(resolve(sslDir, 'localhost.crt')),
		};
	} catch {
		return null;
	}
};

export default defineConfig({
	plugins: [
		react(),
		svgr({
			include: '**/*.svg',
			svgrOptions: {
				exportType: 'named',
				namedExport: 'ReactComponent',
				icon: true,
			},
		}),
		nodePolyfills(),
	],
	root: __dirname,
	publicDir: 'public',
	build: {
		outDir: 'dist',
		emptyOutDir: true,
	},
	server: {
		port: Number(process.env.PORT) || 8010,
		https: getSSL() ?? false,
	},
	resolve: {
		alias: {
			'@': resolve(__dirname, 'src/main'),
			'fs': resolve(__dirname, 'src/main/fs-mock.ts'),
			'vite-plugin-node-polyfills/shims/buffer': resolve(__dirname, 'node_modules/vite-plugin-node-polyfills/shims/buffer'),
			'vite-plugin-node-polyfills/shims/process': resolve(__dirname, 'node_modules/vite-plugin-node-polyfills/shims/process'),
			'vite-plugin-node-polyfills/shims/global': resolve(__dirname, 'node_modules/vite-plugin-node-polyfills/shims/global'),
		},
	},
});
