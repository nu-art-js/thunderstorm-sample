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
import {AppPage, LL_H_C, LL_V_C, LL_V_L, TS_ComponentTransition} from '@nu-art/thunderstorm/frontend';
import {Component_GoogleSAMLLogin, Component_Login, Component_Register} from '@nu-art/user-account/frontend';
import './Page_Login.scss';


type Props = {}
type State = { register: boolean }

export class Page_Login
	extends AppPage<Props, State> {

	constructor(props: any) {
		super(props);
		this.state = {register: false};
	}

	private renderLoginCard = () => {
		return <TS_ComponentTransition
			trigger={!this.state.register}
			transitionTimeout={100}
			mountTimeout={100}
		>
			<LL_V_L className={'form-card'}>
				<Component_Login/>
				{this.renderSAMLButtons()}
				{this.renderSwitchButton()}
			</LL_V_L>
		</TS_ComponentTransition>;
	};

	private renderRegisterCard = () => {
		return <TS_ComponentTransition
			trigger={this.state.register}
			transitionTimeout={100}
			mountTimeout={100}
		>
			<LL_V_L className={'form-card'}>
				<Component_Register/>
				{this.renderSAMLButtons()}
				{this.renderSwitchButton()}
			</LL_V_L>
		</TS_ComponentTransition>;
	};
	private renderSAMLButtons = () => {
		return <LL_V_L className={'saml-buttons'}>
			<Component_GoogleSAMLLogin text={this.state.register ? 'Register With Google' : 'Login With Google'}/>
		</LL_V_L>;
	};
	private renderSwitchButton = () => {
		if (this.state.register)
			return <LL_H_C className={'switch-area'}>
				<div className={'hint'}>Already have an account? Click</div>
				<div className={'clickable'} onClick={() => this.setState({register: !this.state.register})}>here</div>
			</LL_H_C>;

		return <LL_H_C className={'switch-area'}>
			<div className={'hint'}>Don't have an account? Click</div>
			<div className={'clickable'} onClick={() => this.setState({register: !this.state.register})}>here</div>
		</LL_H_C>;
	};

	render() {
		return <LL_H_C id={'page-login'}>
			<LL_V_C className={'form-area'}>
				<img src={require('@res/img/logo--petit-fawn.png')} alt="Logo"/>
				<div className={'form-cards'}>
					{this.renderLoginCard()}
					{this.renderRegisterCard()}
				</div>
			</LL_V_C>
		</LL_H_C>;
	}
}
