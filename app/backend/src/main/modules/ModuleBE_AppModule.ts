import {Module} from '@nu-art/ts-common';
import {HttpServer, HttpServerConfig} from '@nu-art/http-server';

type Config = {
	httpServer: HttpServerConfig
}

export class ModuleBE_AppModule_Class
	extends Module<Config> {

	constructor() {
		super();
		this.setDefaultConfig({httpServer: {}});
	}

	protected init() {
		super.init();
		HttpServer.getDefault().mergeRuntimeConfig(this.config.httpServer).init();
	}
}

export const ModuleBE_AppModule = new ModuleBE_AppModule_Class();
