/*
 * Copyright (C) 2020 Adam van der Kruk aka TacB0sS
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 */
import {TS_Route} from '@nu-art/thunder-routing';
import {Page_Landing} from './Page_Landing.js';

export const Route_Page_Landing: TS_Route = {
	path: '',
	key: 'landing-page',
	Component: Page_Landing,
	index: true,
};
