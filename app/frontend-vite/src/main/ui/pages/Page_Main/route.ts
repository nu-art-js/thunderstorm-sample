/*
 * Copyright (C) 2020 Adam van der Kruk aka TacB0sS
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 */
import {TS_Route} from '@nu-art/thunderstorm-frontend';
import {Route_Page_Landing} from '../Page_Landing/route.js';
import {Route_DevPage} from '../Page_Dev/route.js';
import {Page_Main} from './Page_Main.js';

export const Route_Page_Main: TS_Route = {
	path: '',
	key: 'root',
	Component: Page_Main,
	fallback: true,
	children: [
		Route_Page_Landing,
		Route_DevPage,
	]
};
