import {LoggedStatus, ModuleFE_Account, OnLoginStatusUpdated} from '@nu-art/user-account/frontend';
import {Module} from '@nu-art/ts-common';
import {ModuleFE_BrowserHistory, ModuleFE_RoutingV2, ModuleFE_Thunderstorm, StorageKey} from '@nu-art/thunderstorm/frontend';
import {ModuleFE_SyncManager} from '@nu-art/thunderstorm/frontend/modules/sync-manager/ModuleFE_SyncManager';
import {Page_Main} from '@page/Page_Main';
import {ModuleFE_MessageTemplate} from '@app/common/_entity/message-template/frontend';
import {DBProto_CustomerOrder} from '@app/customer-relation/_entity/customer-order/shared';
import {MessageTemplateInput} from '@app/common/_entity/message-template/shared';
import {DummyOrder1} from '@modules/consts/dummy-orders';


export class ModuleFE_App_Class
	extends Module
	implements OnLoginStatusUpdated {

	sideBarIsOpen = new StorageKey<boolean>('global-config__side-bar__open');

	constructor() {
		super();
	}

	protected init() {
		window.addEventListener('unload', function unloadListener() {
			console.log(`href: ${window.location.href}`);
		});

		ModuleFE_MessageTemplate.registerMessageType({key: 'whatsapp', label: 'WhatsApp'});
		ModuleFE_MessageTemplate.registerMessageType({key: 'email', label: 'Email'});
		ModuleFE_MessageTemplate.registerMessageType({key: 'sms', label: 'SMS'});
		const inputType: MessageTemplateInput<DBProto_CustomerOrder['uiType']> = {
			key: 'customer-order', label: 'Customer Order', sampleInput: [DummyOrder1]
		};
		ModuleFE_MessageTemplate.registerMessageInputType(inputType);
	}

	async __onLoginStatusUpdated() {
		if (ModuleFE_Account.isStatus(LoggedStatus.LOGGED_IN)) {
			ModuleFE_SyncManager.startListening();
			const redirectUrl = ModuleFE_BrowserHistory.getQueryParameter('redirectUrl');
			if (redirectUrl)
				window.location.href = (redirectUrl as string);

		} else if (ModuleFE_Account.isStatus(LoggedStatus.LOGGED_OUT)) {
			await ModuleFE_Thunderstorm.clearWebsiteData();
			ModuleFE_RoutingV2.goToRoute(Page_Main.Route, {redirectUrl: window.location.href});
		}
	}
}

export const ModuleFE_App = new ModuleFE_App_Class();
