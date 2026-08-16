/*
 * @app/e2e - programmatic sample stack bootstrap
 * Copyright (C) 2026 Adam van der Kruk aka TacB0sS
 * Licensed under the Apache License, Version 2.0
 */

import {execSync, spawn, type ChildProcess} from 'child_process';
import {mkdirSync, readFileSync, rmSync, unlinkSync, writeFileSync} from 'fs';
import {dirname, resolve} from 'path';
import {fileURLToPath} from 'url';
import type {E2EHarnessOwnedResources} from '@nu-art/e2e-harness';
import {
	SAMPLE_E2E_BACKEND_PORT,
	SAMPLE_E2E_MONGO_PORT,
	SAMPLE_E2E_PROJECT_ID,
} from './sample-e2e-harness-constants.js';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const backendRoot = resolve(repoRoot, 'app/backend');
const firebaseBin = resolve(repoRoot, 'node_modules/.bin/firebase');
const backendEntry = resolve(backendRoot, 'dist/index.js');
const FIREBASE_CONFIG_DIR = resolve(repoRoot, '.config/.firebase-config');

const HARNESS_FIREBASE_DIR = resolve(backendRoot, '.trash/e2e-harness-firebase');
const HARNESS_FIREBASE_JSON = resolve(HARNESS_FIREBASE_DIR, 'firebase.json');
const HARNESS_FIREBASERC = resolve(HARNESS_FIREBASE_DIR, '.firebaserc');
const MONGO_DATA = resolve(backendRoot, '.trash/mongo-data-e2e-harness');
const HARNESS_LOCK_PATH = resolve(backendRoot, '.trash/e2e-harness.lock');
const MONGO_CONTAINER = 'mongo-emu-sample-e2e-harness';

export const DOCKER_INFRA_ERROR =
	'Docker is not running — mongo/firebase emulators require Docker. Start Docker and retry; do not treat as harness bug until Docker is confirmed up.';

export function assertDockerRunning(): void {
	try {
		execSync('docker info', {stdio: 'ignore'});
	} catch {
		throw new Error(DOCKER_INFRA_ERROR);
	}
}

type StackProcesses = {
	mongoContainer?: string;
	firebase?: ChildProcess;
	backend?: ChildProcess;
};

let stackProcesses: StackProcesses | undefined;
let harnessLockHeld = false;

export async function startSampleE2EStack(): Promise<E2EHarnessOwnedResources> {
	assertDockerRunning();
	acquireHarnessLock();
	try {
		const mongoContainer = await ensureMongoEmulator();
		stackProcesses = {mongoContainer};
		const firebase = await startFirebaseEmulators();
		stackProcesses = {mongoContainer, firebase};
		await waitForPortFree(SAMPLE_E2E_BACKEND_PORT);
		assertMongoHarnessHealthy();
		const backend = await startBackendNode();
		stackProcesses = {mongoContainer, firebase, backend};
		return {teardown: stopOwnedSampleStack};
	} catch (error) {
		await stopOwnedSampleStack();
		throw error;
	}
}

export async function stopOwnedSampleStack(): Promise<void> {
	const processes = stackProcesses;
	stackProcesses = undefined;
	try {
		if (!processes)
			return;

		if (processes.backend)
			killProcess(processes.backend, 'SIGTERM');
		if (processes.firebase)
			killProcess(processes.firebase, 'SIGTERM');
		if (processes.mongoContainer)
			await stopMongoEmulator(processes.mongoContainer);
	} finally {
		releaseHarnessLock();
	}
}

function acquireHarnessLock(): void {
	mkdirSync(dirname(HARNESS_LOCK_PATH), {recursive: true});
	for (let attempt = 0; attempt < 2; attempt++) {
		try {
			writeFileSync(HARNESS_LOCK_PATH, `${process.pid}\n${new Date().toISOString()}\n`, {flag: 'wx'});
			harnessLockHeld = true;
			return;
		} catch {
			let existing = '';
			try {
				existing = readFileSync(HARNESS_LOCK_PATH, 'utf8').trim();
			} catch {
				existing = '(unreadable)';
			}
			const holderPid = Number.parseInt(existing.split('\n')[0] ?? '', 10);
			if (Number.isFinite(holderPid) && !processExists(holderPid)) {
				try {
					unlinkSync(HARNESS_LOCK_PATH);
				} catch { /* ignore */ }
				continue;
			}
			throw new Error(
				`Another sample e2e harness is already running (lock ${HARNESS_LOCK_PATH}):\n${existing}\n` +
				`Stop that suite before starting another.`,
			);
		}
	}
	throw new Error(`Failed to acquire e2e harness lock at ${HARNESS_LOCK_PATH}`);
}

function releaseHarnessLock(): void {
	if (!harnessLockHeld)
		return;
	harnessLockHeld = false;
	try {
		unlinkSync(HARNESS_LOCK_PATH);
	} catch { /* ignore */ }
}

function processExists(pid: number): boolean {
	try {
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
}

function assertMongoHarnessHealthy(): void {
	assertDockerRunning();
	const running = execSync(
		`docker inspect -f '{{.State.Running}}' ${MONGO_CONTAINER} 2>/dev/null || echo false`,
		{encoding: 'utf8'},
	).trim();
	if (running !== 'true')
		throw new Error(`Sample E2E harness: mongo container ${MONGO_CONTAINER} is not running`);

	if (!portHasListener(SAMPLE_E2E_MONGO_PORT))
		throw new Error(`Sample E2E harness: mongo port ${SAMPLE_E2E_MONGO_PORT} has no host listener`);
}

/** Assert no LISTEN on port — never kill by port; print lsof and fail if busy. */
async function waitForPortFree(port: number, timeoutMs = 15_000): Promise<void> {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		if (!portHasListener(port))
			return;
		await sleep(200);
	}
	let listeners = '';
	try {
		listeners = execSync(`lsof -nP -iTCP:${port} -sTCP:LISTEN`, {encoding: 'utf8'}).trim();
	} catch {
		listeners = '(lsof produced no output)';
	}
	throw new Error(
		`Sample E2E harness: port ${port} still in use after ${timeoutMs}ms — refusing to kill by port:\n${listeners}`,
	);
}

function portHasListener(port: number): boolean {
	try {
		execSync(`lsof -nP -iTCP:${port} -sTCP:LISTEN`, {stdio: 'ignore'});
		return true;
	} catch {
		return false;
	}
}

function sleep(ms: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms));
}

function killProcess(child: ChildProcess, signal: NodeJS.Signals): void {
	if (child.exitCode !== null || child.killed)
		return;
	child.kill(signal);
}

function withoutMochaLoader(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
	const next = {...env};
	// BAI ts-mocha registers ts-node/esm via NODE_OPTIONS; child node processes must not inherit it.
	delete next.NODE_OPTIONS;
	return next;
}

function firebaseCliEnv(): NodeJS.ProcessEnv {
	const env = withoutMochaLoader(process.env);
	delete env.FIREBASE_CONFIG;
	delete env.FUNCTIONS_EMULATOR;
	return env;
}

function resolveSecretProjectId(): string {
	const fromEnv = process.env.GCP_PROJECT_ID?.trim();
	if (fromEnv)
		return fromEnv;
	try {
		const fromGcloud = execSync('gcloud config get-value project', {encoding: 'utf8'}).trim();
		if (fromGcloud && fromGcloud !== '(unset)')
			return fromGcloud;
	} catch { /* fall through */ }
	throw new Error(
		'Sample E2E harness: session JWT uses Secret Manager (jwt-signer--account-session). ' +
		'Set GCP_PROJECT_ID to a real GCP project with Secret Manager, or run `gcloud config set project <id>`. ' +
		`Do not use the emulator project id ${SAMPLE_E2E_PROJECT_ID}.`,
	);
}

function buildStackEnv(): NodeJS.ProcessEnv {
	const rtdbPort = SAMPLE_E2E_BACKEND_PORT + 2;
	const firebaseConfig = JSON.stringify({
		projectId: SAMPLE_E2E_PROJECT_ID,
		databaseURL: `http://127.0.0.1:${rtdbPort}?ns=${SAMPLE_E2E_PROJECT_ID}`,
		storageBucket: `${SAMPLE_E2E_PROJECT_ID}.appspot.com`,
	});
	return {
		...withoutMochaLoader(process.env),
		NODE_TLS_REJECT_UNAUTHORIZED: '0',
		BACKEND_PORT: String(SAMPLE_E2E_BACKEND_PORT),
		PORT: '',
		MONGODB_EMULATOR_HOST: `localhost:${SAMPLE_E2E_MONGO_PORT}`,
		// SecretKey reads GCP_PROJECT_ID first — keep it on a real project. GCLOUD_PROJECT is the emulator id.
		GCP_PROJECT_ID: resolveSecretProjectId(),
		GCLOUD_PROJECT: SAMPLE_E2E_PROJECT_ID,
		GOOGLE_CLOUD_PROJECT: SAMPLE_E2E_PROJECT_ID,
		FUNCTIONS_EMULATOR: 'true',
		FIREBASE_DATABASE_EMULATOR_HOST: `127.0.0.1:${rtdbPort}`,
		FIREBASE_AUTH_EMULATOR_HOST: `127.0.0.1:${SAMPLE_E2E_BACKEND_PORT + 7}`,
		FIRESTORE_EMULATOR_HOST: `127.0.0.1:${SAMPLE_E2E_BACKEND_PORT + 3}`,
		FIREBASE_STORAGE_EMULATOR_HOST: `127.0.0.1:${SAMPLE_E2E_BACKEND_PORT + 6}`,
		PUBSUB_EMULATOR_HOST: `127.0.0.1:${SAMPLE_E2E_BACKEND_PORT + 5}`,
		FIREBASE_CONFIG: firebaseConfig,
	};
}

async function ensureMongoEmulator(): Promise<string> {
	execSync(`docker rm -f ${MONGO_CONTAINER} 2>/dev/null || true`, {stdio: 'ignore'});
	await sleep(2_000);
	await waitForPortFree(SAMPLE_E2E_MONGO_PORT);
	rmSync(MONGO_DATA, {recursive: true, force: true});
	mkdirSync(MONGO_DATA, {recursive: true});
	execSync(
		`docker run -d --name ${MONGO_CONTAINER} -p ${SAMPLE_E2E_MONGO_PORT}:${SAMPLE_E2E_MONGO_PORT} -v ${MONGO_DATA}:/data/db mongo:7 --replSet rs0 --port ${SAMPLE_E2E_MONGO_PORT}`,
		{stdio: 'inherit'},
	);
	execSync(
		`sleep 3 && docker exec ${MONGO_CONTAINER} mongosh --port ${SAMPLE_E2E_MONGO_PORT} --quiet --eval "try{rs.status()}catch(e){rs.initiate({_id:'rs0',members:[{_id:0,host:'localhost:${SAMPLE_E2E_MONGO_PORT}'}]})} while(!rs.status().members.some(m=>m.stateStr==='PRIMARY')){sleep(200)} print('PRIMARY ready')"`,
		{stdio: 'inherit'},
	);
	assertMongoHarnessHealthy();
	return MONGO_CONTAINER;
}

async function stopMongoEmulator(containerName: string): Promise<void> {
	try {
		execSync(`docker rm -f ${containerName}`, {stdio: 'ignore'});
	} catch { /* best-effort */ }
}

function writeHarnessFirebaseConfig(): string {
	mkdirSync(HARNESS_FIREBASE_DIR, {recursive: true});
	const config = {
		database: [
			{
				target: SAMPLE_E2E_PROJECT_ID,
				rules: resolve(FIREBASE_CONFIG_DIR, 'database.rules.json'),
			},
		],
		firestore: {
			rules: resolve(FIREBASE_CONFIG_DIR, 'firestore.rules'),
			indexes: resolve(FIREBASE_CONFIG_DIR, 'firestore.indexes.json'),
		},
		storage: {
			rules: resolve(FIREBASE_CONFIG_DIR, 'storage.rules'),
		},
		emulators: {
			singleProjectMode: true,
			database: {port: SAMPLE_E2E_BACKEND_PORT + 2},
			firestore: {port: SAMPLE_E2E_BACKEND_PORT + 3, websocketPort: SAMPLE_E2E_BACKEND_PORT + 4},
			pubsub: {port: SAMPLE_E2E_BACKEND_PORT + 5},
			storage: {port: SAMPLE_E2E_BACKEND_PORT + 6},
			auth: {port: SAMPLE_E2E_BACKEND_PORT + 7},
			ui: {port: SAMPLE_E2E_BACKEND_PORT + 8, enabled: false},
			hub: {port: SAMPLE_E2E_BACKEND_PORT + 9},
			logging: {port: SAMPLE_E2E_BACKEND_PORT + 10},
		},
	};
	const firebaserc = {
		projects: {default: SAMPLE_E2E_PROJECT_ID},
		targets: {
			[SAMPLE_E2E_PROJECT_ID]: {
				database: {
					[SAMPLE_E2E_PROJECT_ID]: [SAMPLE_E2E_PROJECT_ID],
				},
			},
		},
	};
	writeFileSync(HARNESS_FIREBASE_JSON, `${JSON.stringify(config, null, '\t')}\n`);
	writeFileSync(HARNESS_FIREBASERC, `${JSON.stringify(firebaserc, null, '\t')}\n`);
	return HARNESS_FIREBASE_JSON;
}

async function startFirebaseEmulators(): Promise<ChildProcess> {
	const firebaseJsonPath = writeHarnessFirebaseConfig();
	const firebase = spawn(
		firebaseBin,
		[
			'--config', firebaseJsonPath,
			'emulators:start',
			'--only', 'database,auth,storage,firestore,pubsub',
			'--project', SAMPLE_E2E_PROJECT_ID,
		],
		{
			cwd: HARNESS_FIREBASE_DIR,
			env: firebaseCliEnv(),
			stdio: ['ignore', 'pipe', 'pipe'],
		},
	);
	await waitForProcessLog(firebase, /All emulators ready/, 'Firebase emulators');
	return firebase;
}

const writeChildLog = (stream: NodeJS.WriteStream, prefix: string, chunk: Buffer): void => {
	try {
		stream.write(`${prefix}${chunk}`);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== 'EPIPE')
			throw error;
	}
};

async function startBackendNode(): Promise<ChildProcess> {
	const backend = spawn('node', [backendEntry], {
		cwd: backendRoot,
		env: buildStackEnv(),
		stdio: ['ignore', 'pipe', 'pipe'],
	});
	backend.stdout?.on('data', chunk => writeChildLog(process.stdout, '[sample-e2e-backend] ', chunk));
	backend.stderr?.on('data', chunk => writeChildLog(process.stderr, '[sample-e2e-backend] ', chunk));
	return backend;
}

async function waitForProcessLog(child: ChildProcess, pattern: RegExp, label: string): Promise<void> {
	const deadline = Date.now() + 120_000;
	let buffer = '';

	await new Promise<void>((resolvePromise, reject) => {
		const tryResolve = () => {
			if (pattern.test(buffer)) {
				cleanup();
				resolvePromise();
			} else if (Date.now() > deadline) {
				cleanup();
				reject(new Error(`${label} did not become ready within 120s`));
			}
		};

		const onData = (chunk: Buffer) => {
			buffer += chunk.toString();
			writeChildLog(process.stdout, '', chunk);
			tryResolve();
		};

		const onErr = (chunk: Buffer) => {
			buffer += chunk.toString();
			writeChildLog(process.stderr, '', chunk);
			tryResolve();
		};

		const onExit = (code: number | null) => {
			if (pattern.test(buffer))
				return;
			cleanup();
			const tail = buffer.trim().slice(-4000);
			reject(new Error(
				`${label} exited before ready (code ${code ?? 'unknown'})`
				+ (tail ? `\n--- last output ---\n${tail}` : '\n(no process output captured)'),
			));
		};

		const timer = setInterval(tryResolve, 250);

		const cleanup = () => {
			clearInterval(timer);
			child.stdout?.off('data', onData);
			child.stderr?.off('data', onErr);
			child.off('exit', onExit);
		};

		child.stdout?.on('data', onData);
		child.stderr?.on('data', onErr);
		child.on('exit', onExit);
	});
}
