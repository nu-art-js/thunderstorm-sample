/*
 * Copyright (C) 2020 Adam van der Kruk aka TacB0sS
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 */
import {TS_AppTools} from '@nu-art/thunder-ui-modules';
import {TS_Route} from '@nu-art/thunder-routing';
import {Page_Dev_Screens} from './screens.js';

const devPageKey = 'dev-page';
export const Route_DevPage: TS_Route = TS_AppTools.createRoute(
	Page_Dev_Screens,
	devPageKey,
);
