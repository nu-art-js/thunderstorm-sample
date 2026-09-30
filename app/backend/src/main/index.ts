import {HttpServer} from '@nu-art/http-server';
import {ModuleBE_BackupScheduler} from '@nu-art/backup-backend';
import {Storm} from '@nu-art/storm-core';
import {Environment} from './config.js';
import {Module} from '@nu-art/ts-common';
import {ModuleBE_PermissionsAssert, ModulePackBE_Permissions} from '@nu-art/permissions-backend';
import {ModuleBE_Auth} from '@nu-art/google-services-backend/index';
import {ModuleBE_AccountDB, ModuleBE_AuthGate, ModuleBE_SessionDB, ModulePackBE_Accounts} from '@nu-art/user-account-backend';
import {ModuleBE_PasswordAuth, ModulePackBE_PasswordAuth} from '@nu-art/password-auth-backend';
import {ModuleBE_AppModule} from './modules/ModuleBE_AppModule.js';
import {Slack_ServerApiError} from '@nu-art/slack-backend/index';
import {ModulePackBE_FocusedObject} from '@nu-art/ts-focused-object-backend/index';
import {ModuleBE_BaseDB} from '@nu-art/db-api-backend';
import type {ApiDef} from '@nu-art/api-types';
import {OpenApis} from './auth-open-apis.js';

// node mode: the process is a long-running HTTP server. Locally it serves HTTPS on
// basePort; in a container PORT is provided and TLS is terminated upstream, so SSL is left off.

HttpServer.getDefault().mergeRuntimeConfig({
	// PORT = container/upstream-TLS mode (no local SSL). BACKEND_PORT = local HTTPS listen.
	port: Number(process.env.PORT || process.env.BACKEND_PORT) || 8002,
	bodyParserLimit: '32mb',
	ssl: process.env.PORT ? undefined : {
		key: '../../.config/.ssl/localhost.key',
		cert: '../../.config/.ssl/localhost.crt',
	},
});

const modules: Module[] = [
	ModuleBE_Auth,
	Slack_ServerApiError,
	ModuleBE_AppModule,
];

ModuleBE_BaseDB.setDefaultBackend('mongo');
ModuleBE_BackupScheduler.setDefaultConfig({memory: '1GB'});
ModuleBE_AuthGate.setDefaultConfig({canRegister: true});
ModuleBE_PasswordAuth.setDefaultConfig({
	enabled: true,
	canRegister: true,
	passwordAssertion: {'min-length': 8},
});

HttpServer.getDefault().addApiMiddleware(
	(apiDef: ApiDef<any>) => !OpenApis.includes(apiDef),
	ModuleBE_SessionDB.Middleware,
	ModuleBE_AccountDB.Middleware,
	ModuleBE_PermissionsAssert.LoadPermissionsMiddleware,
);

const stormConfig = {
	envKey: Environment.envKey,
	pathToDefaultConfig: '/_config/default',
	// Live planes share /_config/app; the Firebase project is the isolation.
	pathToEnvOverrideConfig: Environment.envKey === 'local' ? Environment.pathToEnvOverrideConfig : '/_config/app',
};

new Storm(stormConfig)
	.addModulePack(ModulePackBE_Accounts)
	.addModulePack(ModulePackBE_PasswordAuth)
	.addModulePack(ModulePackBE_FocusedObject)
	.addModulePack(ModulePackBE_Permissions)
	.addModulePack(modules)
	.build();
