import * as React from 'react';
import {
	AppPage,
	LL_H_C,
	LL_H_T,
	LL_V_L,
	ModuleFE_Thunderstorm,
	ModuleFE_Toaster,
	NodeRendererProps,
	SimpleListAdapter,
	StorageKey,
	TS_DropDown,
	TS_Input,
	TS_Loader
} from '@nu-art/thunderstorm/frontend';
import {csvSerializer, Filter, filterInstances, flatArray, generateHex, MimeType_csv, removeItemFromArray, sortArray} from '@nu-art/ts-common';
import {ICONSV4} from '@app/common/frontend/icons';
import {DB_Product, DB_ProductVariant, DB_VariantOption, ModuleFE_Product, ModuleFE_ProductVariant, ModuleFE_VariantOption} from '@app/store/frontend';
import {DB_Vendor, DropDown_Vendor, ModuleFE_Vendor} from '@app/common/frontend';
import {InferProps, InferState} from '@nu-art/thunderstorm/frontend/utils/types';


type GeneratedOrder = {
	_id: string,
	vendorId: string,
	orderNumber: string,
	orderDate: number,
	items: { label: string, variantId: string, productId: string, quantity: number, price: number, country: string, tariff: string }[]
}

type Props = {}
type FilterItem = { product: DB_Product, variant: DB_ProductVariant };
type State = {
	filterText: string
	allOrders: GeneratedOrder[]
	order?: GeneratedOrder
	vendors: DB_Vendor[]
	selectedVendor?: DB_Vendor
	variants: FilterItem[]
	allVariants: DB_ProductVariant[]
	products: DB_Product[]
	variantOptions: DB_VariantOption[]
}

// const Prop_Barcode = 'Barcode';
// const Prop_SKU = 'Style No';
// const Prop_Size = 'Size';
// const CsvProperties = [Prop_SKU,
// 	'Style Name',
// 	'Brand',
// 	'Type',
// 	'Category',
// 	'Quality',
// 	'Color',
// 	Prop_Size,
// 	'Qty',
// 	Prop_Barcode,
// 	'Weight',
// 	'Country',
// 	'Customs Tariff No',
// 	'Wholesale Price EUR'];

const Pref_orders = new StorageKey<GeneratedOrder[]>(`invoice-generator.orders`);
const Pref_orderId = new StorageKey<string>(`invoice-generator.orderId`);
const Pref_vendorId = new StorageKey<string>('invoice-generator.vendorId');

export class Page_OrderGenerator
	extends AppPage<Props, State> {

	static defaultProps = {
		modules: [
			ModuleFE_Vendor,
			ModuleFE_Product,
			ModuleFE_ProductVariant,
			ModuleFE_VariantOption],
		pageTitle: 'Invoice Generator'

	};

	constructor(props: Props) {
		super(props);
	}

	protected deriveStateFromProps(nextProps: InferProps<this>, state: InferState<this>) {
		const orderId = Pref_orderId.get('');
		const vendorId = this.state?.selectedVendor?._id || Pref_vendorId.get();

		state.selectedVendor = ModuleFE_Vendor.cache.unique(vendorId);
		state.vendors = ModuleFE_Vendor.cache.allMutable();
		state.products = ModuleFE_Product.cache.allMutable();
		state.variantOptions = ModuleFE_VariantOption.cache.allMutable();
		state.allOrders = Pref_orders.get([]);
		state.order = state.allOrders.find(o => o._id === orderId);
		state.allVariants = ModuleFE_ProductVariant.cache.allMutable();
		state.variants = sortArray((state.allVariants.map(variant => {
			const product = (ModuleFE_Product.cache.unique(variant.productId))!;
			return {product, variant};
		})), item => item.product.title);
		state.filterText = '';
		return state;
	}

	render() {
		return <LL_H_T className="match_height match_width">
			<LL_V_L className="match_height match_width">
				<LL_H_C>
					{this.renderVendor()}
					{this.renderFilter()}
					{this.renderDownloadButton()}
				</LL_H_C>
				{this.renderOrderSelector()}
				<LL_H_T className="match_width">
					<div style={{width: '40%'}}>
						{this.renderVariantList()}
					</div>
					<div style={{width: '60%'}}>
						{this.renderOrder()}
					</div>
				</LL_H_T>
			</LL_V_L>
		</LL_H_T>;
	}

	private renderVendor() {
		if (!this.state.vendors)
			return '';

		return <DropDown_Vendor.selectable
			selected={this.state.selectedVendor}
			onSelected={(selectedVendor) => {
				if (!selectedVendor.invoiceParsers)
					selectedVendor.invoiceParsers = [];
				Pref_vendorId.set(selectedVendor._id);
				return this.setState({selectedVendor});
			}}/>;
	}

	private renderOrderSelector() {
		const vendor = this.state.selectedVendor;
		if (!vendor || !this.state.allOrders)
			return <TS_Loader/>;

		const orders = this.state.allOrders.filter(order => order.vendorId === vendor._id);
		const adapter = SimpleListAdapter(orders, (props: NodeRendererProps<GeneratedOrder>) => <div
			className="ll_h_c"
			style={{justifyContent: 'space-between'}}>{props.item.orderNumber}{ICONSV4.remove({
			onClick: () => {
				removeItemFromArray(this.state.allOrders, props.item);
				Pref_orders.set(this.state.allOrders);
			}
		})}</div>);

		return <TS_DropDown<GeneratedOrder>
			placeholder={'Choose parser'}
			adapter={adapter}
			filter={new Filter(order => [order.orderNumber])}
			selected={this.state.order}
			onNoMatchingSelectionForString={(label?: string) => {
				if (!label?.length || label.length < 4)
					return ModuleFE_Toaster.toastError('need to be at least 4 chars long');

				const orderId = generateHex(32);
				const order = {
					_id: orderId,
					orderNumber: label,
					orderDate: 0,
					vendorId: vendor._id,
					items: []
				};
				this.state.allOrders.push(order);

				Pref_orderId.set(orderId);
				Pref_orders.set(this.state.allOrders);

				this.setState({order});
			}}
			onSelected={(order) => {
				Pref_orderId.set(order._id);
				this.setState({order: orders.find(o => o._id === order._id)});
			}}
		/>;
	}

	private renderDownloadButton() {
		const order = this.state.order;
		if (!order)
			return '';

		return ICONSV4.download_csv({
			onClick: async (e) => {
				const rowsObjects = order.items.map(async item => {
					const product = ModuleFE_Product.cache.unique(item.productId) as DB_Product;
					const variant = ModuleFE_ProductVariant.cache.unique(item.variantId) as DB_ProductVariant;
					return {
						'Style No': variant.sku || variant.barcode || '',
						'Style Name': product.title,
						'Brand': 'nvm',
						'Type': 'nvm',
						'Category': 'nvm',
						'Quality': 'nvm',
						'Color': 'nvm',
						'Size': 'nvm',
						'Qty': `${item.quantity}`,
						'Barcode': variant.barcode || variant.sku || '',
						'Weight': 'nvm',
						'Country': item.country,
						'Customs Tariff No': item.tariff,
						'Wholesale Price EUR': `${item.price.toFixed(2)}`,
					};
				});

				const CsvProperties = ['Style No',
					'Style Name',
					'Brand',
					'Type',
					'Category',
					'Quality',
					'Color',
					'Size',
					'Qty',
					'Barcode',
					'Weight',
					'Country',
					'Customs Tariff No',
					'Wholesale Price EUR'];

				const content = csvSerializer<any>(rowsObjects, {columns: CsvProperties});

				const fileName = `${this.state.selectedVendor?.title}-${order?.orderNumber}.csv`;
				ModuleFE_Thunderstorm.downloadFile({fileName, mimeType: MimeType_csv, content: content});
			}
		});
	}

	private renderVariantList() {
		const order = this.state.order;
		if (!this.state.variants)
			return '';

		const filteredVariants = new Filter<FilterItem>(item => item.product.vendorId !== this.state.selectedVendor?._id ? [] : flatArray([item.product.title || '', item.variant.sku || '']))
			.filter(this.state.variants, this.state.filterText || '');

		if (!order)
			return '';

		return <LL_V_L>
			{filteredVariants.map(i => {
				const variants = !i.variant.variantOptionIds?.length ? '' : ` - ${filterInstances(i.variant.variantOptionIds.map(variantOptionId => this.state.variantOptions.find(vo => vo._id === variantOptionId)?.label))}`;
				return <LL_H_C className="clickable" onClick={() => {
					let item = order.items.find(v => v.variantId === i.variant._id);
					if (!item) {
						item = {variantId: i.variant._id, productId: i.product._id, quantity: 0, price: 0, country: '', tariff: '', label: i.product.title};
						order.items.push(item);
					}
					item.quantity++;

					sortArray(order.items, item => item.label || '');
					Pref_orders.set(this.state.allOrders);
					this.forceUpdate();
				}}>{i.product.title} - {variants}</LL_H_C>;
			})}
		</LL_V_L>;
	}

	private renderOrder() {
		const order = this.state.order;
		if (!order)
			return '';

		let totalItems = 0;
		let sum = 0;
		return <LL_V_L>
			{order.items.map(orderItem => {
				sum += (orderItem.quantity || 0) * (orderItem.price || 0);
				totalItems += orderItem.quantity || 0;
				const variant = this.state.allVariants.find(v => v._id === orderItem.variantId);
				const variants = !variant?.variantOptionIds?.length ? '' : ` - ${filterInstances(variant.variantOptionIds.map(variantOptionId => this.state.variantOptions.find(vo => vo._id === variantOptionId)?.label))}`;
				return <LL_H_C key={orderItem.variantId} style={{height: 30, background: (variant?.barcode || variant?.sku) ? 'unset' : '#88000044'}}>
					{ICONSV4.delete_x({
						style: {marginInlineEnd: 20},
						onClick: () => {
							removeItemFromArray(order.items, orderItem);
							Pref_orders.set(this.state.allOrders);
							this.forceUpdate();
						}
					})}
					<TS_Input id={`price-${orderItem.variantId}`} type="number" value={`${orderItem.price}`}
										style={{width: 50, border: 'solid 1px black', marginInlineEnd: 20}}
										onChange={value => {
											const price = +value;
											order.items.filter(i => i.productId === orderItem.productId).forEach(i => i.price = price);
											Pref_orders.set(this.state.allOrders);
											this.forceUpdate();
										}}/>
					<TS_Input id={`tariff-${orderItem.variantId}`} type="number" value={`${orderItem.tariff}`}
										style={{width: 150, border: 'solid 1px black', marginInlineEnd: 20}}
										onChange={tariff => {
											order.items.filter(i => i.productId === orderItem.productId).forEach(i => i.tariff = tariff);
											Pref_orders.set(this.state.allOrders);
											this.forceUpdate();
										}}/>

					<TS_DropDown
						selected={orderItem.country}
						adapter={SimpleListAdapter(['Spain', 'Portugal', 'China', 'India', 'Latvia', 'Turkey', 'Denmark'], (props) => <div>{props.item}</div>)}
						onSelected={(country) => {
							order.items.filter(i => i.productId === orderItem.productId).forEach(i => i.country = country);
							Pref_orders.set(this.state.allOrders);
							this.forceUpdate();
						}}
					/>
					<div>{orderItem.quantity} -- {orderItem.label}{variants}</div>
				</LL_H_C>;
			})}
			<div>Total: {sum.toFixed(2)} ({totalItems})</div>
		</LL_V_L>;
	}

	private renderFilter() {
		return <TS_Input
			type="text"
			id={'order-generator-filter-input'}
			value={this.state.filterText}
			onChange={(filterText) => this.setState({filterText})}
			style={{width: 200}}
			placeholder={'Filter apis'}
		/>;
	}
}

