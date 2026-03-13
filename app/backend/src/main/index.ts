import {HttpServer, ModuleBE_BackupScheduler, RouteResolver_ModulePath, Storm} from '@nu-art/thunderstorm-backend';
import {Environment} from './config.js';
import {Module} from '@nu-art/ts-common';
import {ModuleBE_PermissionsAssert, ModulePackBE_Permissions} from '@nu-art/permissions-backend';
import {FileWrapper} from '@nu-art/firebase-backend';
import {Firebase_ExpressFunction} from '@nu-art/firebase-backend/v1';
import {ModuleBE_Auth} from '@nu-art/google-services-backend';
import {ApiDef_UserAccount, ApiDef_SAML} from '@nu-art/user-account-shared';
import {ModuleBE_AccountDB, ModuleBE_SAML, ModuleBE_SessionDB, ModulePackBE_Accounts} from '@nu-art/user-account-backend';
import {ModuleBE_AppModule} from './modules/ModuleBE_AppModule.js';
import {ModulePackBE_Thunderstorm} from '@nu-art/thunderstorm-backend/core/storm-modulepack';
import {firebaseStorageEmulatorProxy} from '@nu-art/firebase-backend/storage/emulator';
import {ModuleBE_Slack, Slack_ServerApiError} from '@nu-art/slack-backend';
import {ModulePackBE_FocusedObject} from '@nu-art/ts-focused-object-backend';

const modules: Module[] = [
	ModuleBE_Auth,
	ModuleBE_Slack,
	ModuleBE_SAML,
	Slack_ServerApiError,
	ModuleBE_AppModule,
];

ModuleBE_BackupScheduler.setSchedule('every 24 hours');
ModuleBE_BackupScheduler.setDefaultConfig({memory: '1GB'});

Firebase_ExpressFunction.config.memory = '1GiB';
Firebase_ExpressFunction.config.timeoutSeconds = 540;
Firebase_ExpressFunction.config.maxInstances = 10;
Firebase_ExpressFunction.config.concurrency = 100;

if (Environment.envKey === 'prod')
	Firebase_ExpressFunction.config.minInstances = 1;

const openApis = [
	ApiDef_SAML.assertSAML,
	ApiDef_SAML.loginSaml,
	ApiDef_UserAccount.registerAccount,
	ApiDef_UserAccount.login,
	ApiDef_UserAccount.getPasswordAssertionConfig,
];

const routeResolver = new RouteResolver_ModulePath(HttpServer.getExpress(), 'api');
routeResolver.addMiddleware((apiDef) => {
	return ![...openApis].includes(apiDef);
}, ModuleBE_SessionDB.Middleware, ModuleBE_AccountDB.Middleware, ModuleBE_PermissionsAssert.LoadPermissionsMiddleware, ModuleBE_PermissionsAssert.Middleware());


let _exposedFunctions = new Storm(Environment)
	.addModulePack(ModulePackBE_Thunderstorm)
	.addModulePack(ModulePackBE_Accounts)
	.addModulePack(ModulePackBE_FocusedObject)
	.addModulePack(ModulePackBE_Permissions)
	.addModulePack(modules)
	.setInitialRouteResolver(routeResolver)
	.build();

if (process.env.FIREBASE_STORAGE_EMULATOR_HOST || process.env.FUNCTIONS_EMULATOR) {
	FileWrapper.emulatorStorageProxy = 'https://localhost:8008';
	_exposedFunctions = {..._exposedFunctions, ...firebaseStorageEmulatorProxy};
}

export const api = _exposedFunctions['api'];
