import {TS_Route} from '@nu-art/thunderstorm/frontend';
import {Route_Page_Landing} from '../Page_Landing/route';
import {Route_DevPage} from '../Page_Dev/route';
import { Page_Main } from './Page_Main';

export const Route_Page_Main: TS_Route = {
	path: '',
	key: 'root',
	Component: Page_Main,
	fallback: true,
	children: [
		Route_Page_Landing,
		Route_DevPage,
	]
};