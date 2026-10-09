#!/usr/bin/env node
/**
 * Check this repo's __package.json unitConfig values against the installed
 * @nu-art/build-and-install package (the one `build-and-install.sh` pins).
 *
 * The _thunderstorm submodule is not the validator. Published 0.500.6 rejects
 * keys and {{PARAM}} placeholders that the submodule still accepts.
 *
 * Skips itself when BAI is not installed yet (fresh clone, before the first init).
 * build-and-install.sh runs this before later BAI commands.
 */

import {existsSync, readdirSync, readFileSync, statSync} from 'node:fs';
import {join, dirname} from 'node:path';
import {pathToFileURL, fileURLToPath} from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const baiPkgPath = join(root, 'node_modules/@nu-art/build-and-install/package.json');

if (!existsSync(baiPkgPath)) {
	console.log('preflight: @nu-art/build-and-install is not installed yet; skipping');
	process.exit(0);
}

const baiVersion = JSON.parse(readFileSync(baiPkgPath, 'utf8')).version;
if (!/^0\.500\./.test(baiVersion)) {
	console.error(`preflight: expected @nu-art/build-and-install 0.500.x, found ${baiVersion}`);
	process.exit(1);
}

const {tsValidateResult} = await import('@nu-art/ts-common');
const resolvers = join(root, 'node_modules/@nu-art/build-and-install/units/discovery/resolvers');

async function validator(file, exportName, staticName) {
	const mod = await import(pathToFileURL(join(resolvers, file)).href);
	return mod[exportName].constructor[staticName];
}

const validators = {
	'firebase-function': await validator('UnitMapper_FirebaseFunction.js', 'UnitMapper_FirebaseFunction', 'tsValidator_FirebaseFunction'),
	'firebase-hosting': await validator('UnitMapper_FirebaseHosting.js', 'UnitMapper_FirebaseHosting', 'tsValidator_FirebaseHosting'),
	'vite-hosting': await validator('UnitMapper_ViteHosting.js', 'UnitMapper_ViteHosting', 'tsValidator_ViteHosting'),
	'typescript-lib': await validator('UnitMapper_NodeLib.js', 'UnitMapper_NodeLib', 'tsValidator_NodeProject'),
	'node-project': await validator('UnitMapper_NodeProject.js', 'UnitMapper_NodeProject', 'tsValidator_NodeProject'),
};

const failures = [];

function fail(message) {
	failures.push(message);
}

function walkPackages(dir, out = []) {
	for (const name of readdirSync(dir)) {
		if (name === 'node_modules' || name === '_thunderstorm' || name === 'dist' || name === '.git' || name === '.trash')
			continue;
		const path = join(dir, name);
		if (statSync(path).isDirectory())
			walkPackages(path, out);
		else if (name === '__package.json')
			out.push(path);
	}
	return out;
}

const placeholder = /\{\{(?!APP_VERSION\})[^}]+\}\}/g;

for (const file of walkPackages(root)) {
	const text = readFileSync(file, 'utf8');
	const relative = file.slice(root.length + 1);
	for (const match of text.matchAll(placeholder))
		fail(`${relative}: unsupported placeholder ${match[0]} (only {{APP_VERSION}} is substituted)`);

	const pkg = JSON.parse(text);
	const unitConfig = pkg.unitConfig;
	if (!unitConfig) {
		fail(`${relative}: missing unitConfig`);
		continue;
	}
	const validatorForType = validators[unitConfig.type];
	if (!validatorForType) {
		fail(`${relative}: no published validator for unitConfig.type "${unitConfig.type}"`);
		continue;
	}
	const result = tsValidateResult(unitConfig, validatorForType, undefined, false);
	if (result)
		fail(`${relative}: ${JSON.stringify(result)}`);
}

const baiConfig = JSON.parse(readFileSync(join(root, 'bai-config.json'), 'utf8'));
const params = baiConfig.templateParams?.params ?? {};
const N = params.PORT_BACKEND_DEBUG;
const expected = {
	PORT_BACKEND_DEBUG: N,
	PORT_FRONTEND: N + 1,
	PORT_BACKEND_APEX: N + 2,
	PORT_CONFIG: N + 4,
	PORT_MONGO: 20000 + N,
};

for (const [key, value] of Object.entries(expected)) {
	if (params[key] !== value)
		fail(`bai-config.json templateParams.params.${key} is ${params[key]}, formula requires ${value}`);
}

function readPkg(relativePath) {
	const path = join(root, relativePath);
	if (!existsSync(path))
		return undefined;
	return JSON.parse(readFileSync(path, 'utf8'));
}

const gcpRegion = /^[a-z]+-[a-z]+[0-9]+$/;

const backend = readPkg('app/backend/__package.json');
if (backend) {
	const unit = backend.unitConfig;
	if (unit.debugPort !== params.PORT_BACKEND_DEBUG)
		fail(`app/backend debugPort ${unit.debugPort} != PORT_BACKEND_DEBUG ${params.PORT_BACKEND_DEBUG}`);
	if (unit.basePort !== params.PORT_BACKEND_APEX)
		fail(`app/backend basePort ${unit.basePort} != PORT_BACKEND_APEX ${params.PORT_BACKEND_APEX}`);
	const mongoKeys = Object.keys(unit.mongo ?? {});
	for (const key of mongoKeys) {
		if (key !== 'port' && key !== 'dbName')
			fail(`app/backend mongo.${key} is not accepted by published BAI (only port and dbName)`);
	}
	if (unit.mongo?.port !== params.PORT_MONGO)
		fail(`app/backend mongo.port ${unit.mongo?.port} != PORT_MONGO ${params.PORT_MONGO}`);
	if (unit.envs?.local?.projectId !== params.FIREBASE_PROJECT_LOCAL)
		fail(`app/backend local projectId != FIREBASE_PROJECT_LOCAL`);
	const registry = unit.containerDeployment?.artifactRegistry;
	if (registry?.projectId !== params.ARTIFACT_PROJECT_ID)
		fail(`app/backend artifact projectId != ARTIFACT_PROJECT_ID`);
	if (registry?.region !== params.ARTIFACT_REGION)
		fail(`app/backend image region (containerDeployment.artifactRegistry.region) ${registry?.region} != ARTIFACT_REGION ${params.ARTIFACT_REGION}`);
	// Cloud Run region is separate from the image region; BAI falls back to the image region when runRegion is unset
	const runRegion = unit.containerDeployment?.runRegion ?? registry?.region;
	if (!params.RUN_REGION)
		fail(`bai-config.json templateParams.params.RUN_REGION is missing`);
	else if (!gcpRegion.test(params.RUN_REGION))
		fail(`bai-config.json RUN_REGION ${params.RUN_REGION} is not a GCP region (e.g. europe-west1)`);
	if (runRegion !== params.RUN_REGION)
		fail(`app/backend Cloud Run region (containerDeployment.runRegion) ${runRegion} != RUN_REGION ${params.RUN_REGION}`);
}

const frontend = readPkg('app/frontend-vite/__package.json');
if (frontend) {
	const unit = frontend.unitConfig;
	if (unit.servingPort !== params.PORT_FRONTEND)
		fail(`app/frontend-vite servingPort ${unit.servingPort} != PORT_FRONTEND ${params.PORT_FRONTEND}`);
	if (unit.envs?.local?.projectId !== params.FIREBASE_PROJECT_LOCAL)
		fail(`app/frontend-vite local projectId != FIREBASE_PROJECT_LOCAL`);
	const configUrl = unit.envs?.local?.config?.configUrl ?? '';
	if (!configUrl.includes(`127.0.0.1:${params.PORT_CONFIG}/`))
		fail(`app/frontend-vite local configUrl does not use PORT_CONFIG ${params.PORT_CONFIG}`);
	if (!configUrl.includes(`ns=${params.FIREBASE_PROJECT_LOCAL}-default-rtdb`))
		fail(`app/frontend-vite local configUrl does not use FIREBASE_PROJECT_LOCAL`);
	const registry = unit.hostingDeployment?.artifactRegistry;
	if (registry?.projectId !== params.ARTIFACT_PROJECT_ID)
		fail(`app/frontend-vite artifact projectId != ARTIFACT_PROJECT_ID`);
	if (registry?.region !== params.ARTIFACT_REGION)
		fail(`app/frontend-vite artifact region != ARTIFACT_REGION`);
}

const indexPath = join(root, 'app/backend/src/main/index.ts');
if (existsSync(indexPath)) {
	const index = readFileSync(indexPath, 'utf8');
	const fallback = index.match(/BACKEND_PORT\)\s*\|\|\s*(\d+)/);
	const port = fallback ? Number(fallback[1]) : undefined;
	if (port !== params.PORT_BACKEND_APEX)
		fail(`app/backend/src/main/index.ts listen fallback ${port} != PORT_BACKEND_APEX ${params.PORT_BACKEND_APEX}`);
}

const e2eDir = join(root, 'app/e2e/src/test');
if (existsSync(e2eDir)) {
	const constantsFile = readdirSync(e2eDir).find(name => name.endsWith('e2e-harness-constants.ts'));
	if (!constantsFile) {
		fail('app/e2e/src/test is missing *e2e-harness-constants.ts');
	} else {
		const constants = readFileSync(join(e2eDir, constantsFile), 'utf8');
		const backendPort = constants.match(/E2E_BACKEND_PORT = Number\(process\.env\.BACKEND_PORT \|\| (\d+)\)/)
			?? constants.match(/E2E_BACKEND_PORT = (\d+)/);
		const mongoPort = constants.match(/E2E_MONGO_PORT = (\d+)/);
		const projectId = constants.match(/E2E_PROJECT_ID = '([^']+)'/);
		const e2eBackend = backendPort ? Number(backendPort[1]) : undefined;
		const e2eMongo = mongoPort ? Number(mongoPort[1]) : undefined;
		if (e2eBackend !== N + 102)
			fail(`${constantsFile} backend port ${e2eBackend} != N+102 (${N + 102})`);
		if (e2eMongo !== 20000 + N + 21)
			fail(`${constantsFile} mongo port ${e2eMongo} != 20000+N+21 (${20000 + N + 21})`);
		if (projectId && projectId[1] !== params.FIREBASE_PROJECT_LOCAL)
			fail(`${constantsFile} project id ${projectId[1]} != FIREBASE_PROJECT_LOCAL`);
	}
}

if (failures.length) {
	console.error(`preflight: ${failures.length} problem(s) against @nu-art/build-and-install@${baiVersion}`);
	for (const message of failures)
		console.error(`  - ${message}`);
	process.exit(1);
}

console.log(`preflight ok (@nu-art/build-and-install@${baiVersion})`);
