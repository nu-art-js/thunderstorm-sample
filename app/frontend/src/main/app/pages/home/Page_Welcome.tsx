import * as React from 'react';
import {AppPage} from '@nu-art/thunderstorm/frontend';

import {dispatch_updateHeaderOption} from '@app/common/frontend/components/header/Component_Header';
import {DispatcherType_Store} from '@app/common/_entity/store/frontend';
import {DispatcherInterface} from '@nu-art/thunderstorm/frontend/core/db-api-gen/types';


type Props = {}
type State = {}

export class Page_Welcome
	extends AppPage<Props, State>
	implements DispatcherInterface<DispatcherType_Store> {

	static defaultProps = {
		pageTitle: 'Home Screen'
	};

	constructor(props: any) {
		super(props);
	}

	componentDidMount() {
		dispatch_updateHeaderOption.dispatchUI([]);
	}

	__onStoreUpdated(): void {
		this.forceUpdate();
	}

	render() {
		return <div>WELCOME</div>;
	}
}
