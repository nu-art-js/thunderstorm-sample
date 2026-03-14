/*
 * Copyright (C) 2020 Adam van der Kruk aka TacB0sS
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 */
import {ModulePackFE_Thunderstorm, Thunder} from '@nu-art/thunderstorm-frontend';
import {ThunderstormDefaultApp} from '@nu-art/thunderstorm-frontend/core/ThunderstormDefaultApp';
import {config} from './config.js';
import {Route_Page_Main} from './ui/pages/Page_Main/route.js';
import {ModuleFE_App} from './modules/ModuleFE_App.js';
import './App.scss';

const modules = [
	ModuleFE_App,
];

new Thunder(config)
	.addModulePack(ModulePackFE_Thunderstorm)
	.addModulePack(modules)
	.setMainApp(ThunderstormDefaultApp, {rootRoute: Route_Page_Main})
	.build();
