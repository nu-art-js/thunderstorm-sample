import {HttpServer, RouteResolver_ModulePath, Storm} from '@nu-art/thunderstorm/backend/index';
import {Environment} from './config.js';
import {Module} from '@nu-art/ts-common';
import {ModuleBE_PermissionsAssert, ModulePackBE_Permissions} from '@nu-art/permissions/backend/index';
import {FileWrapper} from '@nu-art/firebase/backend/index';
import {Firebase_ExpressFunction} from '@nu-art/firebase/backend-functions';
import {ModuleBE_Auth} from '@nu-art/google-services/backend/index';
import {ApiDef_Account, ApiDef_SAML, ModuleBE_AccountDB, ModuleBE_SAML, ModuleBE_SessionDB, ModulePackBE_Accounts} from '@nu-art/user-account/backend/index';
import {ModuleBE_AppModule} from './modules/ModuleBE_AppModule.js';
import {ModulePackBE_Thunderstorm} from '@nu-art/thunderstorm/backend/core/storm-modulepack';
import {ModuleBE_BackupScheduler} from '@nu-art/thunderstorm/_entity/backup-doc/backend/ModuleBE_BackupScheduler';
import {firebaseStorageEmulatorProxy} from '@nu-art/firebase/backend/storage/emulator';
import {ModuleBE_Slack, Slack_ServerApiError} from '@nu-art/slack/backend/index';
import {ModulePackBE_FocusedObject} from '@nu-art/ts-focused-object/backend/index';

// // eslint-disable-next-line @typescript-eslint/no-var-requires
// const packageJson = require('./package.json');
// console.log(`Starting server v${packageJson.version} with env: ${Environment.name}`);

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
	ApiDef_SAML._v1.assertSAML,
	ApiDef_SAML._v1.loginSaml,
	ApiDef_Account._v1.registerAccount,
	ApiDef_Account._v1.login,
	ApiDef_Account._v1.getPasswordAssertionConfig,
];

const routeResolver = new RouteResolver_ModulePath(HttpServer.express, 'api');
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

