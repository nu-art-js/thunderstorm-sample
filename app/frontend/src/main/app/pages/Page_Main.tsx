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
import {AppPage, DispatcherType_AppConfig, TS_AppTools, TS_Loader, TS_Route} from '@nu-art/thunderstorm/frontend';
import {LoggedStatus, ModuleFE_Account, OnLoginStatusUpdated} from '@nu-art/user-account/frontend';
import {BadImplementationException} from '@nu-art/ts-common';
import {Page_Login} from '@page/Page_Login';
import {Outlet} from 'react-router-dom';
import {Page_Workspace} from '@page/Page_Workspace';
import {Page_Dev} from '../../playground/Page_Dev';
import {PlaygroundScreens} from '../../playground/examples';
import {DispatcherInterface} from '@nu-art/thunderstorm/frontend/core/db-api-gen/types';


type Props = {}
type State = {}

export class Page_Main
	extends AppPage<Props, State>
	implements OnLoginStatusUpdated, DispatcherInterface<DispatcherType_AppConfig> {

	static Route: TS_Route = {
		path: '', key: 'root', Component: Page_Main, fallback: true,
		children: [
			{...Page_Workspace.Route_Sales, index: true},
			Page_Workspace.Route_Store,
			Page_Dev.Route,
			TS_AppTools.createRoute(PlaygroundScreens)
		]
	};

	constructor(props: any) {
		super(props);
	}

	__onAppConfigsUpdated() {
		this.forceUpdate();
	}

	__onLoginStatusUpdated(): void {
		this.forceUpdate();
	}

	protected deriveStateFromProps(nextProps: Props) {
		return {};
	}

	render() {
		const status = ModuleFE_Account.getLoggedStatus();
		switch (status) {
			case LoggedStatus.LOGGED_IN:
				return <Outlet/>;

			case LoggedStatus.SESSION_TIMEOUT:
			case LoggedStatus.LOGGED_OUT:
				return <Page_Login/>;

			case LoggedStatus.VALIDATING:
				return <TS_Loader/>;

			default:
				throw new BadImplementationException(`logged status can only be one of 'LOGGED_IN', 'LOGGED_OUT' or 'VALIDATING'`);
		}
	}
}
