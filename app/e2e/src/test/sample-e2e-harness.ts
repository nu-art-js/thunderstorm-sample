/*
 * @app/e2e - Sample E2E harness config
 * Copyright (C) 2026 Adam van der Kruk aka TacB0sS
 * Licensed under the Apache License, Version 2.0
 */

import {E2EHarness, type E2EHarnessConfig} from '@nu-art/e2e-harness';
import {SAMPLE_E2E_BACKEND_PORT, SAMPLE_E2E_MONGO_PORT, sampleE2EBackendOrigin} from './sample-e2e-harness-constants.js';
import {assertDockerRunning, startSampleE2EStack} from './sample-e2e-stack.js';

export {SAMPLE_E2E_BACKEND_PORT, sampleE2EBackendOrigin};

const sampleE2EConfig: E2EHarnessConfig = {
	backendPackage: '@app/backend',
	healthUrl: `${sampleE2EBackendOrigin}/`,
	reuseExistingStack: false,
	startup: {
		applyEnv: () => {
			process.env.NODE_TLS_REJECT_UNAUTHORIZED ??= '0';
			process.env.BACKEND_PORT ??= String(SAMPLE_E2E_BACKEND_PORT);
			process.env.MONGODB_EMULATOR_HOST ??= `localhost:${SAMPLE_E2E_MONGO_PORT}`;
		},
		startStack: startSampleE2EStack,
	},
};

let activeHarness: Awaited<ReturnType<typeof E2EHarness.ensure>> | undefined;

export async function ensureSampleE2EStack(): Promise<void> {
	assertDockerRunning();
	activeHarness = await E2EHarness.ensure(sampleE2EConfig);
}

export async function teardownSampleE2EStack(): Promise<void> {
	await activeHarness?.teardown();
	activeHarness = undefined;
}
