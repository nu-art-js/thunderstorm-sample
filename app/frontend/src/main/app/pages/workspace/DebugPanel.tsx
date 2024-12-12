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
import {
	Adapter,
	ComponentSync,
	NodeRendererProps,
	TreeNode,
	TS_Tree
} from '@nu-art/thunderstorm/frontend';
import {
	_keys,
	DB_OBJECT_PROP__CREATED,
	DB_OBJECT_PROP__ID,
	DB_OBJECT_PROP__UPDATED,
	DB_OBJECT_PROP__VERSION,
	exists,
	randomNumber,
	sortArray
} from '@nu-art/ts-common';
import {OnDebugListener} from '@app/common/frontend/core/debug-interface';


type Props = { id?: string }
type State = {
	visible: boolean,
	title: string
	id: string
	data: any
	expandedPaths: { [path: string]: true | undefined }
}

function deriveFirstPaths(data: any) {
	const paths = _keys(data).map(k => `/${String(k)}/`);
	paths.push('/');
	return paths;
}

const propsOrder = [
	DB_OBJECT_PROP__ID,
	DB_OBJECT_PROP__VERSION,
	DB_OBJECT_PROP__CREATED,
	DB_OBJECT_PROP__UPDATED,
	(prop: string) => prop.startsWith('__'),
	(prop: string) => prop.startsWith('_'),
	'blob',
	'storeId',
	'shopifyId',
	'syncTimestamp',
	(prop: string) => prop.endsWith('Id'),
	(prop: string) => prop.endsWith('Ids'),
];

const sortLogic = (prop: string) => {
	for (let i = 0; i < propsOrder.length; i++) {
		const propsOrderElement = propsOrder[i];
		if (typeof propsOrderElement === 'string' ? prop === propsOrderElement : propsOrderElement(prop))
			return i;
	}

	return propsOrder.length;
};

export class DebugPanel
	extends ComponentSync<Props, State>
	implements OnDebugListener {

	constructor(props: any) {
		super(props);
	}

	protected deriveStateFromProps(nextProps: Props): State {
		return {
			visible: false,
			title: 'Nothing set',
			id: 'debug-state',
			data: {},
			expandedPaths: {}
		};
	}

	render() {
		if (!this.state.visible)
			return '';

		const adapter = new Adapter(this.state.data).setTreeNodeRenderer(Example_ColorfulNodeRenderer);

		return (
			<div style={{fontFamily: 'monospace !important', width: '32em', 'position': 'fixed', 'top': '0', 'bottom': '0', 'right': '0'}}>
				<div className={`ll_v_l`} style={{
					border: 'solid 3px #000',
					backgroundColor: '#FFF',
					'position': 'absolute',
					'top': '0',
					'bottom': '0',
					'left': '0',
					'right': '0',
					'color': '#eee',
					'overflow': 'auto',
					'padding': '1em'
				}}>
					<h3 style={{color: '#000'}}>{this.state.title}</h3>
					<TS_Tree
						id={`debug-state-${randomNumber(1000)}`}
						adapter={adapter}
						expanded={this.state.expandedPaths}
					/>
				</div>
			</div>
		);
	}

	__onToggleDebugVisibility() {
		this.setState({visible: !this.state.visible});
	}

	__onUpdateDebugData(id: string, title: string, data: any, expandedPathsList = deriveFirstPaths(data)) {
		const state = this.deriveState(data, expandedPathsList, id, title);
		this.setState({...state, visible: false});
	}

	private deriveState(dbObject: any, expandedPathsList: string[], id: string, title: string) {
		const sortedKeys = sortArray(sortArray(Object.keys(dbObject)), sortLogic);
		const newInstance = sortedKeys.reduce((newInstance, key) => {
			newInstance[key] = dbObject[key];
			return newInstance;
		}, {} as any);

		const expandedPaths = expandedPathsList.reduce((toRet, path) => {
			toRet[path] = true;
			return toRet;
		}, {} as { [path: string]: true });

		newInstance.blob = newInstance.blob ? JSON.parse(newInstance.blob) : undefined;
		if (!exists(newInstance.blob))
			delete newInstance.blob;

		return {
			id,
			title,
			data: newInstance,
			expandedPaths
		};
	}

	__onShowDebugData(id: string, title: string, data: any, expandedPathsList = deriveFirstPaths(data)) {
		const state = this.deriveState(data, expandedPathsList, id, title);
		this.setState({...state, visible: true});
	}
}

const ExpandCollapseComponentSVG = (props: TreeNode) => {
	const children = props.adapter.getFilteredChildren(props.item);

	let toDisplay;
	if (children.length === 0)
		toDisplay = '';
	else if (!props.expanded)
		toDisplay = <svg width="15" height="15" viewBox="0 0 15 15" fill="currentColor" style={{color: '#9b59b6', verticalAlign: 'text-top'}}>
			<path d="M0 14l6-6-6-6z"/>
		</svg>;
	else
		toDisplay = <svg width="15" height="15" viewBox="0 0 15 15" fill="currentColor" style={{color: '#3498db', verticalAlign: 'text-top'}}>
			<path d="M0 5l6 6 6-6z"/>
		</svg>;

	return <div className={`clickable`} onClick={props.expandToggler} style={{width: '15px', marginRight: 2}}>{toDisplay}</div>;
};

class Example_ColorfulNodeRenderer
	extends React.Component<NodeRendererProps> {

	constructor(props: NodeRendererProps) {
		super(props);
	}

	render() {
		const valueStyle = (_value: any) => {
			switch (typeof _value) {
				case 'string':
					return {color: '#e67e22'};

				case 'boolean':
					return {color: '#bf95d0'};

				case 'number':
					if (isNaN(_value))
						return {color: '#e0e0e0'};

					return {color: '#2ecc71'};

				case 'undefined' :
					return {color: '#000'};

				case 'object':
					if (_value === null)
						return {color: '#f1c40f'};

				// eslint-disable-next-line no-fallthrough
				default:
					return {color: '#000000'};
			}
		};

		let value: any;
		const item = this.props.item;
		if (typeof item !== 'object' || item === undefined || item === null)
			value = `${item}`;
		else if (Array.isArray(item))
			value = `[${item.length}]`;
		else if (Object.keys(item).length === 0)
			value = '{}';
		else
			value = '';

		const nameStyle = {color: '#000000'};

		return (
			<div className="ll_h_c" style={{fontSize: '0.9em', lineHeight: 1.25}}>
				<ExpandCollapseComponentSVG {...this.props.node}/>
				<div>
					<span style={nameStyle}>
						{this.props.node.propKey}
					</span>
					{value !== '' ? ': ' : ''}
					<span style={valueStyle(value)}>{`${value}`}</span>
				</div>
			</div>
		);
	}
}
