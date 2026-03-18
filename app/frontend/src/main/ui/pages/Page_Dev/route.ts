import {TS_AppTools} from '@nu-art/thunder-ui-modules';
import {TS_Route} from '@nu-art/thunder-routing';
import {Page_Dev_Screens} from './screens.js';

const devPageKey = 'dev-page';
export const Route_DevPage: TS_Route = TS_AppTools.createRoute(
	Page_Dev_Screens,
	devPageKey,
);