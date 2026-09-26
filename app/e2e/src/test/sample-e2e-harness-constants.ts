/*
 * @app/e2e - Sample E2E harness constants
 * Copyright (C) 2026 Adam van der Kruk aka TacB0sS
 * Licensed under the Apache License, Version 2.0
 */

/**
 * Dedicated E2E zone. Human `bai -l` uses basePort 8002 in app/backend/__package.json.
 * Backend is N+102. Mongo is 20000+N+21. Do not retarget the human ports here.
 */
export const SAMPLE_E2E_BACKEND_PORT = Number(process.env.BACKEND_PORT || 8102);
export const sampleE2EBackendOrigin = `https://localhost:${SAMPLE_E2E_BACKEND_PORT}`;
export const SAMPLE_E2E_PROJECT_ID = 'demo-project';
export const SAMPLE_E2E_MONGO_PORT = 28021;
