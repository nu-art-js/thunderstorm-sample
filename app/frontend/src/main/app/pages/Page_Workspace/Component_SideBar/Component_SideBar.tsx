import * as React from 'react';
import {HTMLAttributes} from 'react';
import {_className, ComponentSync, LL_H_C, LL_V_C, ModuleFE_RoutingV2, StorageKey, TS_Route} from '@nu-art/thunderstorm/frontend';
import './Component_SideBar.scss';
import {ICONSV4} from '@app/common/frontend/icons';
import {OnMenuButtonClicked} from '@consts/interfaces';
import {LOCALE} from '@res/locale';
import {ModuleFE_App} from '@modules/index';
import {resolveContent} from '@nu-art/ts-common';
import {Page_MessageTemplates} from '@app/common/_entity/message-template/frontend';
import {Page_CustomerOrders} from '@app/customer-relation/frontend/customer-order/Page_CustomerOrders';
import {Page_StoreInventoryList} from '@app/customer-relation/frontend/store-inventory/Page_StoreInventoryList';
import {Page_ShipmentManager} from '@app/supply-chain/frontend/shipments/Page_ShipmentManager';
import {Page_ProductTemplateV2} from '@app/product-template/frontend/manager/Page_ProductTemplateV2';
import {Page_ProductsV2} from '@app/store/_entity/product/frontend/manager/Page_ProductsV2';
import {Page_ProductsVariantConfigV2} from '@app/store/_entity/product-variant-config/frontend/manager/Page_ProductsVariantConfigV2';
import {Page_ProductTagsV2} from '@app/store/_entity/product-tag/frontend/manager/Page_ProductTagsV2';
import {Page_VendorsV2} from '@app/common/_entity/vendor/frontend/manager/Page_VendorsV2';
import {Page_Customers} from '@app/customer-relation/_entity/customer-contact/frontend/manager/Page_Customers';
import {Page_ShippingMethods} from '@app/customer-relation/_entity/shipping-method/frontend/manager/Page_ShippingMethods';


type FilterType = 'inventory' | 'store' | 'sales';

type SideNavBarFilter = {
	icon: React.ComponentType<HTMLAttributes<HTMLDivElement>>;
	key: FilterType
	label: string
	options: Option[]
}

type Option = {
	icon: React.ComponentType;
	label: (() => string) | string
	route: TS_Route;
}

// // @ts-ignore
// const icons: SideNavBarIcon[] = [
// 	{
// 		icon: ICONSV4.translate,
// 		label: LOCALE.Translations,
// 		route: Routes.RouteKey_Translations
// 	},
// 	{
// 		icon: ICONSV4.decision_tree,
// 		label: LOCALE.DecisionTree,
// 		route: Routes.RouteKey_DecisionTree
// 	},
// 	{
// 		icon: ICONSV4.lock,
// 		label: LOCALE.Permissions,
// 		route: Routes.RouteKey_Permissions
// 	}
// ];

const Filter_Sales: SideNavBarFilter = {
	icon: ICONSV4.customer_order,
	key: 'sales',
	label: 'Sales',
	options: [
		{
			icon: ICONSV4.customer_order,
			label: LOCALE.Orders,
			route: Page_CustomerOrders.Route
		},
		{
			icon: ICONSV4.customer,
			label: LOCALE.Customers,
			route: Page_Customers.Route
		},
		{
			icon: ICONSV4.location,
			label: LOCALE.ShippingOptions,
			route: Page_ShippingMethods.Route
		},
		{
			icon: ICONSV4.email,
			label: LOCALE.MessageTemplate,
			route: Page_MessageTemplates.Route
		}
	]
};
const Filter_Inventory: SideNavBarFilter = {
	icon: ICONSV4.shipment_plane,
	key: 'inventory',
	label: 'Inventory',
	options: [
		{
			icon: ICONSV4.shipment_plane,
			label: LOCALE.Shipments,
			route: Page_ShipmentManager.Route
		},
		// {
		// 	icon: ICONSV4.scrape,
		// 	label: LOCALE.InvoiceParser,
		// 	route: Routes.RouteKey_InvoiceParser
		// },
		// {
		// 	icon: ICONSV4.magic_stick,
		// 	label: LOCALE.OrderGenerator,
		// 	route: Routes.RouteKey_OrderGenerator
		// },
	]
};
const Filter_Store: SideNavBarFilter = {
	icon: ICONSV4.product,
	key: 'store',
	label: 'Store',
	options: [
		{
			icon: ICONSV4.product,
			label: LOCALE.Products,
			route: Page_ProductsV2.Route
		},
		{
			icon: ICONSV4.magic_stick,
			label: LOCALE.ProductTemplates,
			route: Page_ProductTemplateV2.Route
		},
		{
			icon: ICONSV4.missing_variants,
			label: 'Product Variants',
			route: Page_ProductsVariantConfigV2.Route
		},
		{
			icon: ICONSV4.documents,
			label: LOCALE.ProductTags,
			route: Page_ProductTagsV2.Route
		},
		{
			icon: ICONSV4.shipment_boxes,
			label: LOCALE.StoreInventory,
			route: Page_StoreInventoryList.Route
		},
		{
			icon: ICONSV4.missing_variants,
			label: LOCALE.Vendors,
			route: Page_VendorsV2.Route
		},
	]
};
const filterMenu: SideNavBarFilter[] = [
	Filter_Inventory,
	Filter_Store,
	Filter_Sales
];

type Props = {}

type State = {
	isOpen: boolean;
	filter: FilterType;
}

const menuFilter = new StorageKey<FilterType>('menu-filter-key');

export class Component_SideBar
	extends ComponentSync<Props, State>
	implements OnMenuButtonClicked {

	deriveStateFromProps(nextProps: Props, state: State) {
		state.isOpen = ModuleFE_App.sideBarIsOpen.get(false);
		state.filter = menuFilter.get('sales');
		return state;
	}

	__onMenuButtonClicked(): void {
		const isOpen = ModuleFE_App.sideBarIsOpen.get(false);
		this.setState({...this.state, isOpen});
	}

	render() {
		const routeKey = ModuleFE_RoutingV2.getCurrentRouteKey()?.key;
		const options = filterMenu.find(item => item.key === menuFilter.get('sales'))?.options;
		options?.find(option => routeKey === option.route.key);
		return <div className={_className('manager__side-bar', 'unselectable', this.state.isOpen && 'open')}>
			<LL_H_C className="margin__block">
				{filterMenu.map((item, i) => {
					const Icon = item.icon;
					return <Icon key={i} className={_className(menuFilter.get() === item.key && 'selected')} onClick={() => {
						menuFilter.set(item.key);
						ModuleFE_RoutingV2.goToRoute(item.options[0].route);
						this.forceUpdate();
					}}/>;
				})}
			</LL_H_C>
			{options?.map((icon, i) => {
				const Icon = icon.icon;
				return <LL_H_C key={i} className={_className('manager__side-bar-item', routeKey === icon.route.key && 'selected')} onClick={() => {
					ModuleFE_RoutingV2.goToRoute(icon.route);
					this.forceUpdate();
				}}>
					<LL_V_C className="manager__side-bar__icon-wrapper"><Icon/></LL_V_C>
					<div className={_className('manager__side-bar-item__label', this.state.isOpen && 'open')}>{resolveContent(icon.label)}</div>
				</LL_H_C>;
			})}
		</div>;
	}
}