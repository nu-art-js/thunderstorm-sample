/*
 * @app/e2e - password-auth host journey
 * Copyright (C) 2026 Adam van der Kruk aka TacB0sS
 * Licensed under the Apache License, Version 2.0
 */

import {expect} from 'chai';
import {HeaderKey_Authorization, ResponseHeaderKey_JWTToken} from '@nu-art/api-types';
import {HttpClient, HttpException} from '@nu-art/http-client';
import {ApiDef_PasswordAuth} from '@nu-art/password-auth-shared';
import {generateHex} from '@nu-art/ts-common';
import {ApiDef_UserAccount, HeaderKey_DeviceId} from '@nu-art/user-account-shared';
import {ensureSampleE2EStack, sampleE2EBackendOrigin, teardownSampleE2EStack} from './sample-e2e-harness.js';

function createClient(): HttpClient {
	return new HttpClient({
		origin: sampleE2EBackendOrigin,
		timeout: 30_000,
		compress: false,
	});
}

function headerAsString(value: string | string[] | undefined): string | undefined {
	if (!value)
		return undefined;
	return typeof value === 'string' ? value : value[0];
}

async function registerAccount(client: HttpClient, email: string, password: string, deviceId: string) {
	const request = client.createRequest(ApiDef_PasswordAuth.registerAccount)
		.setBodyAsJson({email, password, passwordCheck: password, deviceId});
	try {
		const account = await request.execute();
		const jwt = headerAsString(request.getResponseHeader(ResponseHeaderKey_JWTToken));
		expect(jwt, `register ${email} must return ${ResponseHeaderKey_JWTToken}`).to.be.a('string').and.not.empty;
		expect(account.email).to.equal(email);
		expect(account._id).to.be.a('string').and.not.empty;
		return {account, jwt: jwt!};
	} catch (error) {
		if (error instanceof HttpException)
			throw new Error(`register ${email} failed: ${error.responseCode} ${JSON.stringify(error.errorResponse)}`);
		throw error;
	}
}

describe('Sample password-auth E2E', function () {
	this.timeout(180_000);

	before(async function () {
		this.timeout(180_000);
		await ensureSampleE2EStack();
	});

	after(async function () {
		this.timeout(60_000);
		await teardownSampleE2EStack();
	});

	it('registers two accounts, logs the second in, and logs it out', async () => {
		const stamp = Date.now();
		const password = 'TestPass1';
		const first = {
			email: `e2e-${stamp}-a@sample.test`,
			deviceId: generateHex(32),
		};
		const second = {
			email: `e2e-${stamp}-b@sample.test`,
			deviceId: generateHex(32),
		};

		const client = createClient();
		const firstSession = await registerAccount(client, first.email, password, first.deviceId);
		const secondSession = await registerAccount(client, second.email, password, second.deviceId);
		expect(firstSession.account._id).to.not.equal(secondSession.account._id);

		const loginRequest = client.createRequest(ApiDef_PasswordAuth.login)
			.setBodyAsJson({email: second.email, password, deviceId: second.deviceId});
		const loggedIn = await loginRequest.execute();
		const loginJwt = headerAsString(loginRequest.getResponseHeader(ResponseHeaderKey_JWTToken));
		expect(loggedIn._id).to.equal(secondSession.account._id);
		expect(loginJwt, `login must return ${ResponseHeaderKey_JWTToken}`).to.be.a('string').and.not.empty;

		const sessionClient = createClient();
		sessionClient.addDefaultHeader(HeaderKey_Authorization, `Bearer ${loginJwt}`);
		sessionClient.addDefaultHeader(HeaderKey_DeviceId, second.deviceId);
		await sessionClient.createRequest(ApiDef_UserAccount.logout).execute();
	});
});
