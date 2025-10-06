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
import {ComponentAsync, stopPropagation, Thunder, TS_Button,} from '@nu-art/thunderstorm/frontend/index';
import './App.scss';
import {StorageKey_Name, StorageKey_Title} from '../shared/consts';
import {scriptTest1} from './script/test-1';


type State = {
	name: string
	title: string
}

export class App
	extends ComponentAsync<{}, State> {

	protected async deriveStateFromProps(nextProps: {}) {
		const name = await StorageKey_Name.get();
		const title = await StorageKey_Title.get();
		return {
			name,
			title: title.item
		};
	}

	render() {
		// @ts-ignore
		const blockRightClick = !Thunder.getInstance().config.isDebug;
		return (
			<div id="app" onDrop={stopPropagation} onDragOver={stopPropagation} onContextMenu={blockRightClick ? stopPropagation : undefined}>
				Hello Thunderstorm:<br/> {this.state.name} is the {this.state.title}

				<TS_Button onClick={async () => {
					const [tab] = await chrome.tabs.query({active: true, currentWindow: true});

					if (!tab.id)
						return console.log('no Tab ID');

					console.log(`scriptTest1 running on Tab: ${tab.id}`);
					await chrome.scripting.executeScript({
						target: {tabId: tab.id},
						func: scriptTest1,
					});

				}}>scriptTest1</TS_Button>
				<TS_Button onClick={async () => {
					const [tab] = await chrome.tabs.query({active: true, currentWindow: true});

					if (!tab.id)
						return console.log('no Tab ID');

					console.log(`scriptTest2 running on Tab: ${tab.id}`);
					await chrome.scripting.executeScript({
						target: {tabId: tab.id},
						files: ['dist/scriptTest2.js']
					});

				}}>scriptTest2</TS_Button>
			</div>);
	}
}


