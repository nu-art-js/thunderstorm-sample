/*
 * A typescript & react boilerplate with api call example
 *
 * Copyright (C) 2020 Adam van der Kruk aka TacB0sS
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import {ModulePackFE_Thunderstorm, Thunder} from '@nu-art/thunderstorm/frontend/index';
import {ThunderstormDefaultApp} from '@nu-art/thunderstorm/frontend/core/ThunderstormDefaultApp';
import {Route_Page_Main} from './ui/pages/Page_Main/route.js';
import {ModuleFE_App} from './modules/ModuleFE_App.js';
import './App.scss';

// ModuleFE_LocalStorage.setPersistentDebugState();
const modules = [
	ModuleFE_App,
];

// eslint-disable-next-line @typescript-eslint/no-require-imports
const config = require('./config.js').config;
new Thunder(config)
	.addModulePack(ModulePackFE_Thunderstorm)
	.addModulePack(modules)
	.setMainApp(ThunderstormDefaultApp, {rootRoute: Route_Page_Main})
	.build();

