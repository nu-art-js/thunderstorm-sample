import {_className, ComponentSyncInfer, LL_H_C, LL_VH_C, ModuleFE_BrowserHistory, ModuleFE_Notifications, openContent} from '@nu-art/thunderstorm/frontend';
import {ICONSV4} from '@app/common/frontend/icons';
import {Component_AccountThumbnail, ModuleFE_Account, PopUp_AccountMenu, SessionKeyFE_Account} from '@nu-art/user-account/frontend';
import {LOCALE} from '@res/locale';
import * as React from 'react';
import {dispatcher_onMenuButtonClicked, OnMenuButtonClicked} from '@consts/interfaces';
import {DeclaredStrings} from '@res/localization/AppLanguage';
import {ModuleFE_App} from '@modules/index';
import {ModuleFE_PushPubSub} from '@nu-art/push-pub-sub/frontend';
import './Component_MainHeader.scss';
import {Minute, resolveContent, UniqueId} from '@nu-art/ts-common';
import {OnPageTitleChangedListener} from '@nu-art/thunderstorm/frontend/core/consts';
import {HeaderOption} from '@app/common/frontend/components/header/type';
import {OnUpdateHeaderOptions} from '@app/common/frontend/components/header/Component_Header';
import {ModuleFE_Store} from '@app/common/_entity/store/frontend';
import {Component_UserDetailsEditor} from '@page/Page_Workspace/Component_UserDetailsEditor/Component_UserDetailsEditor';
import {dispatcher_onToggleDebugVisibility} from '@app/common/frontend/core/debug-interface';
import {EventProcessor, Module_KeyBinder} from '@app/customer-relation/frontend/customer-order/Page_CustomerOrder';
import {InferProps, InferState} from '@nu-art/thunderstorm/frontend/utils/types';
import {ReactNode} from 'react';


type Props = {}
type State = {
	title: ReactNode
	options: HeaderOption[]
}

const devToolsOption: HeaderOption = {
	icon: ICONSV4.gear,
	tooltip: 'Tooltip_OpenDevTools',
	action: () => {
		ModuleFE_BrowserHistory.setUrl('/app-tools');
	}
};
const menuOption: HeaderOption = {
	icon: ICONSV4.menu,
	tooltip: 'Tooltip_ToggleMenuVisibility',
	action: () => {
		const isOpen = ModuleFE_App.sideBarIsOpen.get(false);
		ModuleFE_App.sideBarIsOpen.set(!isOpen);
		dispatcher_onMenuButtonClicked.dispatchUI();
	}
};
const showDebug: HeaderOption = {
	icon: ICONSV4.debug,
	tooltip: 'Tooltip_ToggleDebugPanel',
	action: () => {
		dispatcher_onToggleDebugVisibility.dispatchUI();
	}
};
const syncShop: HeaderOption = {
	icon: ICONSV4.sync,
	tooltip: 'Tooltip_SyncStore',
	action: () => {
		ModuleFE_Notifications
			.create()
			.content('Syncing with Shopify')
			.execute(async () => {
				const storeId = (await ModuleFE_Store.getDefaultStore())?.storeId;
				return ModuleFE_Store._v1.syncStore({storeId}).setTimeout(5 * Minute).executeSync();
			});
	}
};

export class Component_MainHeader
	extends ComponentSyncInfer<Props, State>
	implements OnPageTitleChangedListener, OnUpdateHeaderOptions, OnMenuButtonClicked {

	constructor(p: Props) {
		super(p);
	}

	protected deriveStateFromProps(nextProps: InferProps<this>, state: InferState<this>) {
		state.title = '';
		state.options = [devToolsOption, syncShop, showDebug];
		return state;
	}

	__onMenuButtonClicked() {
		this.forceUpdate();
	}

	__updateHeaderOptions(pageOptions: HeaderOption[]): void {
		this.setState((prevState) => {
			prevState.options.forEach(option => {
				if (!option.condition)
					return;

				Module_KeyBinder.unbind(option as EventProcessor);
			});

			const options = [syncShop, showDebug, ...pageOptions];
			options.forEach(option => {
				if (!option.condition)
					return;

				Module_KeyBinder.bind(option as EventProcessor);
			});

			return {options: options};
		});
	}

	__onPageTitleChanged(title: ReactNode) {
		this.setState({title});
	}

	render() {
		const isOpen = ModuleFE_App.sideBarIsOpen.get(false);
		return <LL_H_C className="main-header">

			<LL_H_C className="flex__grow">
				{this.renderAction(menuOption, 0, _className('main-header__sidebar-button', isOpen && 'open'))}
				{this.state.options.map((o, i) => this.renderAction(o, i + 1))}
			</LL_H_C>
			<LL_VH_C className="main-header__title flex__grow">{this.state.title}</LL_VH_C>

			<LL_H_C className="main-header__user flex__grow">
				<div>{ICONSV4.bell({
					onClick: async (e) => {
						await ModuleFE_PushPubSub.requestPermissions();
					}
				})}</div>
				<Component_AccountThumbnail
					accountId={SessionKeyFE_Account.get()._id}
					onClick={this.openAccountMenu}
				/>
			</LL_H_C>
		</LL_H_C>;
	}

	private openAccountMenu = (e: React.MouseEvent) => {
		PopUp_AccountMenu.show(
			e,
			{
				accountId: SessionKeyFE_Account.get()._id,
				accountDisplayModifier: (account) => {
					return ModuleFE_Account.cache.unique(account._id)?.displayName?.trim() ?? 'no name';
				},
				acronymComposer: this.userAcronymComposer,
				menuActions: [
					PopUp_AccountMenu.Action_EditPassword,
					{
						label: 'Edit My Details',
						type: 'page',
						pageKey: 'edit-my-details',
						content: (account, trigger) => <Component_UserDetailsEditor account={account} onSubmitCompleted={trigger}/>
					},
					PopUp_AccountMenu.Action_AppToolsButton('/app-tools')]
			},
			{offset: {y: 20, x: 15}}
		);
	};
	private userAcronymComposer = (accountId: UniqueId): string | undefined => {
		const nameParts = (ModuleFE_Account.cache.unique(accountId)?.displayName ?? 'not available').split(' ');
		return nameParts[0].charAt(0) + nameParts[1].charAt(0);
	};

	// private openMenu = (e: React.MouseEvent<HTMLSpanElement>) => {
	// 	const menuItems: any[] = [
	// 		{label: 'Logout', onClick: ModuleFE_Account.logout}
	// 	];
	// 	const userProfileMenu: Model_Menu = {
	// 		id: 'user-thumbnail-menu',
	// 		adapter: SimpleListAdapter(menuItems, renderer => <div>{renderer.item.label}</div>),
	// 		offset: {},
	// 		originPos: {x: 1, y: 0},
	// 		modalPos: {y: 0, x: -1},
	//
	// 		onNodeClicked: (path: string, item: any) => {
	// 			ModuleFE_MouseInteractivity.hide('pop-up');
	// 			item.onClick?.();
	// 		}
	// 	};
	//
	// 	ModuleFE_MouseInteractivity.showMenu(userProfileMenu);
	// };

	private renderAction = (option: HeaderOption, index: number, className?: string) => {
		const tooltipKey = !option.tooltip ? 'Tooltip_BeResponsible' : typeof option.tooltip === 'function' ? option.tooltip() : option.tooltip;

		return (
			<LL_VH_C
				className={_className('main-header__action-button', className)}
				onClick={option.action}
				key={index}
				{...openContent.tooltip.right(`action-${index}`, () => <div style={{margin: 4}}>{LOCALE[tooltipKey as keyof DeclaredStrings]?.() || tooltipKey}</div>)}>
				{resolveContent(option.icon)}
			</LL_VH_C>
		);
	};
}