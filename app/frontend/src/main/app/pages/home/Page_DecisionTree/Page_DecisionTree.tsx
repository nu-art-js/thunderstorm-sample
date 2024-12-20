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

import {AppPageV2, BaseAsyncState} from '@nu-art/thunderstorm/frontend';
import * as React from 'react';


type Props = {}
type State = {}

export class Page_DecisionTree
	extends AppPageV2<Props, State> {

	constructor(props: any) {
		super(props, 'Decision Tree');
		this.state = {};
	}

	protected async deriveStateFromProps(nextProps: Props): Promise<BaseAsyncState & State> {
		return super.deriveStateFromProps(nextProps);
	}

	render() {
		return <div className="page__decision-tree">

		</div>;
	}
}
