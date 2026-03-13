import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {resolve} from 'path';
import {readFileSync} from 'fs';

const sslDir = resolve(__dirname, '.ssl');
const getSSL = () => {
	try {
		return {
			key: readFileSync(resolve(sslDir, 'server-key.pem')),
			cert: readFileSync(resolve(sslDir, 'server-cert.pem')),
		};
	} catch {
		return null;
	}
};

export default defineConfig({
	plugins: [react()],
	root: __dirname,
	publicDir: 'public',
	build: {
		outDir: 'dist',
		emptyOutDir: true,
	},
	server: {
		port: Number(process.env.PORT) || 3000,
		https: getSSL() ?? false,
	},
	resolve: {
		alias: {
			'@': resolve(__dirname, 'src/main'),
		},
	},
});
