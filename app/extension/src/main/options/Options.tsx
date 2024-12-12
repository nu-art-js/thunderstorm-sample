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
import {BaseAsyncState, ComponentAsync, LL_V_L, SimpleListAdapter, stopPropagation, Thunder, TS_DropDown,} from '@nu-art/thunderstorm/frontend';
import './Options.scss';
import {StorageKey_Name, StorageKey_Title} from '../shared/consts';


type State = {
	name?: string
	title?: { item: string }
}

export class Options
	extends ComponentAsync<{}, State> {

	protected async deriveStateFromProps(nextProps: {}): Promise<BaseAsyncState & State> {
		const name = await StorageKey_Name.get();
		const title = await StorageKey_Title.get();

		return {
			name,
			title,
		};
	}

	render() {
		// @ts-ignore
		const blockRightClick = !Thunder.getInstance().config.isDebug;
		const names = ['Adam', 'Matan', 'Itay', 'ZEVEL'];
		const titles = ['King', 'Clown', 'Biggest S'];
		return (
			<div id="app" onDrop={stopPropagation} onDragOver={stopPropagation} onContextMenu={blockRightClick ? stopPropagation : undefined}>
				<LL_V_L className="match_width">
					<div className="match_width" style={{height: 40, background: 'red'}}></div>
					<div>Selection:</div>
					<div style={{width: 300}}>
						<TS_DropDown<string>
							adapter={SimpleListAdapter(names, (item) => <div>{item.item}</div>)}
							selected={this.state.name}
							onSelected={async (selected) => {
								await StorageKey_Name.set(selected);
								this.reDeriveState();
							}}
						/>
					</div>
					<div>StorageKey_Title:</div>
					<div style={{width: 300}}>
						<TS_DropDown<string>
							adapter={SimpleListAdapter(titles, (item) => <div>{item.item}</div>)}
							selected={this.state.title?.item}
							onSelected={async (selected) => {
								await StorageKey_Title.set({item: selected});
								this.reDeriveState();
							}}
						/>
					</div>
				</LL_V_L>
			</div>);
	}
}
