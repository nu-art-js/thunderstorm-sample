import {TS_AppTools, TS_Route} from '@nu-art/thunderstorm/frontend/index';
import {Page_Dev_Screens} from './screens.js';

const devPageKey = 'dev-page';
export const Route_DevPage: TS_Route = TS_AppTools.createRoute(
	Page_Dev_Screens,
	devPageKey,
);