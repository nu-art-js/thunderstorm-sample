import * as React from 'react';
import {AppPageV2, Thunder, TS_Route} from '@nu-art/thunderstorm/frontend';
import {TS_DevPage} from '../TS_DevPage/TS_DevPage';


export class Page_Dev
	extends AppPageV2 {

	static Route: TS_Route<{}> = {path: 'dev', key: 'dev-screen', Component: this};

	constructor(p: {}) {
		super(p, `Dev Dashboard (${Thunder.getInstance().getConfig().label})`);
	}

	render() {
		const env = Thunder.getInstance().getConfig().label;
		return <TS_DevPage pages={[]} header={`Dev Dashboard${env ? ` - ${env}` : ''}`}/>;
	}
}