import * as React from 'react';
import {DebugPanel} from '../workspace/DebugPanel';
import {LL_H_T, LL_V_L, TS_Route} from '@nu-art/thunderstorm/frontend';
import {Component_MainHeader} from './Component_MainHeader';
import {Component_SideBar} from './Component_SideBar';
import './Page_Workspace.scss';
import {Outlet} from 'react-router-dom';
import {DispatcherInterface} from '@nu-art/thunderstorm/frontend/core/db-api-gen/types';
import {DispatcherType_Store} from '@app/common/_entity/store/frontend';
import {Page_CustomerOrders} from '@app/customer-relation/frontend/customer-order/Page_CustomerOrders';
import {Page_CustomerOrder} from '@app/customer-relation/frontend/customer-order/Page_CustomerOrder';
import {Page_StoreInventoryList} from '@app/customer-relation/frontend/store-inventory/Page_StoreInventoryList';
import {Page_ShipmentManager} from '@app/supply-chain/frontend/shipments/Page_ShipmentManager';
import {Page_ProductTemplateV2} from '@app/product-template/frontend/manager/Page_ProductTemplateV2';
import {Page_ProductTagsV2} from '@app/store/_entity/product-tag/frontend/manager/Page_ProductTagsV2';
import {Page_ProductsVariantConfigV2} from '@app/store/_entity/product-variant-config/frontend/manager/Page_ProductsVariantConfigV2';
import {Page_ProductsV2} from '@app/store/_entity/product/frontend/manager/Page_ProductsV2';
import {Page_VendorsV2} from '@app/common/_entity/vendor/frontend/manager/Page_VendorsV2';
import {Page_Customers} from '@app/customer-relation/_entity/customer-contact/frontend/manager/Page_Customers';
import {Page_ShippingMethods} from '@app/customer-relation/_entity/shipping-method/frontend/manager/Page_ShippingMethods';
import {Page_MessageTemplates} from '@app/common/_entity/message-template/frontend';


type Props = {}
type State = {}

function routeGroup(path: string, key: string, index: boolean = false, ...children: TS_Route<any>[]): TS_Route {
	return {path, key, index, children};
}

export class Page_Workspace
	extends React.Component<Props, State>
	implements DispatcherInterface<DispatcherType_Store> {

	static Route_Sales: TS_Route = {
		path: 'sales', key: 'sales', Component: Page_Workspace, fallback: true, children: [
			routeGroup('orders', 'orders', true, {...Page_CustomerOrders.Route, index: true}, Page_CustomerOrder.Route),
			Page_Customers.Route,
			Page_MessageTemplates.Route,
			Page_ShippingMethods.Route,
		]
	};

	private static Route_Product: TS_Route = {
		path: 'product', key: 'product', children: [
			{...Page_ProductTemplateV2.Route, index: true},
			Page_ProductTagsV2.Route,
			Page_ProductsVariantConfigV2.Route,
			Page_ProductsV2.Route,
		]
	};

	static Route_Store: TS_Route = {
		path: 'store', key: 'store', Component: Page_Workspace, fallback: true, children: [
			this.Route_Product,
			Page_VendorsV2.Route,
			routeGroup('inventory', 'inventory', false, Page_StoreInventoryList.Route),
			{...Page_ShipmentManager.Route, index: true},
		]
	};

	constructor(props: any) {
		super(props);
		this.state = {register: false};
	}

	__onStoreUpdated(): void {
		this.forceUpdate();
	}

	render() {
		return (
			<LL_V_L className="workspace">
				<Component_MainHeader/>
				<LL_H_T className="workspace-navigation">
					<Component_SideBar/>
					<LL_V_L className="match_parent" style={{overflow: 'auto'}}>
						<Outlet/>
					</LL_V_L>
					<DebugPanel/>
				</LL_H_T>
			</LL_V_L>
		);
	}
}
