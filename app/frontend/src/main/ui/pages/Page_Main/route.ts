import {TS_Route} from '@nu-art/thunderstorm/frontend/index';
import {Route_Page_Landing} from '../Page_Landing/route.js';
import {Route_DevPage} from '../Page_Dev/route.js';
import { Page_Main } from './Page_Main.js';

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