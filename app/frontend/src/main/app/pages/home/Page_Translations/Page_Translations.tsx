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

import {AppPageV2, BaseAsyncState, ModuleFE_BrowserHistory, getQueryParameter, TS_Input} from '@nu-art/thunderstorm/frontend';
import * as React from 'react';
import {arrayToMap, filterInstances, TypedMap} from '@nu-art/ts-common';
import {DB_TranslationEntry, IndexKey_Translation_GroupId} from '@app/common/_entity/translation/shared';
import {ModuleFE_TranslationEntry} from '@app/common/_entity/translation/frontend';


type Props = {
	fromLocale: string,
	otherLocales: string[]
}
type State = {
	group?: string
	translations?: TypedMap<DB_TranslationEntry>[],
}

export class Page_Translations
	extends AppPageV2<Props, State> {
	static defaultProps: Partial<Props> = {
		fromLocale: 'en',
		otherLocales: ['he']
	};

	constructor(props: any) {
		super(props);
		this.state = {};
	}

	protected async deriveStateFromProps(nextProps: Props): Promise<BaseAsyncState & State> {
		const group = getQueryParameter('group');
		if (!group || this.state?.group !== group)
			return {};

		const promises = [this.props.fromLocale, ...this.props.otherLocales].map(async locale => ModuleFE_TranslationEntry.IDB.query([group, locale], IndexKey_Translation_GroupId));
		const translationsPerLocale = await Promise.all(promises);
		const translations = translationsPerLocale[0].map((translation) => {
			return arrayToMap(filterInstances(translationsPerLocale.map(tl => tl.find(_t => _t.sharedId === translation.sharedId))), t => t.locale);
		});
		return {translations};
	}

	render() {
		// const rows = this.state.translations;

		return <div className="page__translations">
			<TS_Input
				id="input--translation-group"
				type="text"
				onBlur={this.onUpdate}
				onAccept={this.onUpdate}
				value={this.state.group || ''}
			/>
			{}
		</div>;
	}

	private onUpdate = (value: string) => this.setState({group: ''}, () => ModuleFE_BrowserHistory.addQueryParam('group', value));
}
