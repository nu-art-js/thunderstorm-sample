import {Module} from '@nu-art/ts-common';


export class ModuleFE_App_Class
	extends Module {

	protected init() {
		window.addEventListener('load', () => {
			this.logInfo('Thunderstorm template FE loaded!');
		});
	}

	// Enable: If using account logic
	// async __onLoginStatusUpdated() {
	// 	if (ModuleFE_Account.isStatus(LoggedStatus.LOGGED_IN)) {
	// 		ModuleFE_SyncManager.startListening();
	// 		const redirectUrl = ModuleFE_BrowserHistory.getQueryParameter('redirectUrl');
	// 		if (redirectUrl)
	// 			window.location.href = (redirectUrl as string);
	// 	} else if (ModuleFE_Account.isStatus(LoggedStatus.LOGGED_OUT)) {
	// 		await ModuleFE_Thunderstorm.clearWebsiteData();
	// 		ModuleFE_RoutingV2.goToRoute(Page_Main.Route, {redirectUrl: window.location.href});
	// 	}
	// }
}

export const ModuleFE_App = new ModuleFE_App_Class();
