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

import * as React from 'react';
import {AppPage} from '@nu-art/thunderstorm/frontend';
import {Outlet} from 'react-router-dom';

export class Page_Main
	extends AppPage {

	constructor(props: any) {
		super(props);
	}

	// Enable: if using AppConfig logic
	// __onAppConfigsUpdated() {
	// 	this.forceUpdate();
	// }

	// Enable: if using account logic
	// __onLoginStatusUpdated(): void {
	// 	this.forceUpdate();
	// }

	render() {
		//Logic can be added here to return different page based on the login status
		//through ModuleFE_Account.getLoggedStatus();
		return <Outlet/>;
	}
}
