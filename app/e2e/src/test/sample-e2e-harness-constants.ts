/*
 * @app/e2e - Sample E2E harness constants
 * Copyright (C) 2026 Adam van der Kruk aka TacB0sS
 * Licensed under the Apache License, Version 2.0
 */

/** Dedicated E2E zone — do not collide with human `bai -l` on 8002. */
export const SAMPLE_E2E_BACKEND_PORT = Number(process.env.BACKEND_PORT || 8102);
export const sampleE2EBackendOrigin = `https://localhost:${SAMPLE_E2E_BACKEND_PORT}`;
export const SAMPLE_E2E_PROJECT_ID = 'demo-project';
export const SAMPLE_E2E_MONGO_PORT = 27039;
