import {ApiDef_PasswordAuth} from '@nu-art/password-auth-shared';
import {ApiDef_AuthPolicy} from '@nu-art/user-account-shared';
import type {ApiDef} from '@nu-art/api-types';

/**
 * Routes that must not require a session.
 * Register/login/policy/assertion-config run before the user has a JWT.
 */
export const OpenApis: ApiDef<any>[] = [
	ApiDef_PasswordAuth.registerAccount,
	ApiDef_PasswordAuth.login,
	ApiDef_PasswordAuth.getPasswordAssertionConfig,
	ApiDef_AuthPolicy.getPolicy,
];
