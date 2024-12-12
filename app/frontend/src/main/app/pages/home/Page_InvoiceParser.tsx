import * as React from 'react';
import {CSSProperties} from 'react';
import {
	AppPage,
	ComponentAsync,
	LL_H_C,
	LL_H_T,
	LL_V_C,
	LL_V_L,
	ModuleFE_Thunderstorm,
	ModuleFE_Toaster,
	NodeRendererProps,
	SimpleListAdapter,
	StorageKey,
	TS_Checkbox,
	TS_DropDown,
	TS_Input,
	TS_TextArea
} from '@nu-art/thunderstorm/frontend';
import {
	addItemToArrayAtIndex,
	csvSerializer,
	Filter,
	filterDuplicates,
	filterInstances,
	flatArray,
	generateHex,
	MimeType_csv,
	removeItemFromArray,
	TS_Object
} from '@nu-art/ts-common';
import {ICONSV4} from '@app/common/frontend/icons';
import {COLORS} from '@res/colors';
import {DB_Vendor, DropDown_Vendor, ModuleFE_Vendor} from '@app/common/frontend';
import {FindAndReplace, InvoiceRegexpHeader, InvoiceRegexpParser} from '@app/common/_enum/variant-parser/shared';
import {InferProps, InferState} from '@nu-art/thunderstorm/frontend/utils/types';


type Props = {}
type State = {
	_error?: string
	invoiceNumber?: string
	invoiceDate?: string
	matchGroups?: RegExpMatchArray | never[] | null
	matchDetails?: (RegExpMatchArray | null)[]
	contentLeftovers?: string
	parseItems?: boolean
	content: string
	selectedVendor?: DB_Vendor
	parserId?: string
}

const Prop_Barcode = 'Barcode';
const Prop_SKU = 'Style No';
const Prop_Size = 'Size';
const CsvProperties = [Prop_SKU,
	'Style Name',
	'Brand',
	'Type',
	'Category',
	'Quality',
	'Color',
	Prop_Size,
	'Qty',
	Prop_Barcode,
	'Weight',
	'Country',
	'Customs Tariff No',
	'Wholesale Price EUR'];
const marginsStyle = {marginInlineEnd: 6, marginInlineStart: 6};
const style: CSSProperties = {fontFamily: 'monospace !important', resize: 'none', width: '100%', ...marginsStyle};

const Pref_vendorId = new StorageKey<string>('invoice-parser.vendorId');
const Pref_parserId = new StorageKey<string>('invoice-parser.parserId');

export class Page_InvoiceParser
	extends AppPage<Props, State> {

	static defaultProps = {
		modules: [ModuleFE_Vendor],
		pageTitle: 'Invoice Parser'
	};

	constructor(props: Props) {
		super(props);
	}

	getContent(parserId: string) {
		return new StorageKey<string>(`invoice-parser.invoice.${parserId}`).get('');
	}

	setContent(content: string) {
		return new StorageKey<string>(`invoice-parser.invoice.${this.state.parserId}`).set(content);
	}

	protected deriveStateFromProps(nextProps: InferProps<this>, state: InferState<this>) {
		state.parserId = state?.parserId || Pref_parserId.get('');
		state.content = this.getContent(state.parserId);
		const vendorId = state?.selectedVendor?._id || Pref_vendorId.get();

		state.selectedVendor = ModuleFE_Vendor.cache.unique(vendorId);

		try {
			const {matchGroups, matchDetails, _error, invoiceNumber} = this.calculate(false);
			state.matchGroups = matchGroups;
			state.matchDetails = matchDetails;
			state._error = _error;
			state.invoiceNumber = invoiceNumber;
		} catch (e: any) {
			state.matchGroups = [];
			state.matchDetails = [];
			state._error = e.message;
			state.invoiceNumber = '';
		}

		return state;
	}

	render() {
		return <div className="ll_h_t match_height">
			<div className="ll_v_l match_height">
				<div className="match_width ll_h_c children_space">{this.renderVendor()} {this.renderDownloadButton()}</div>

				{this.renderParserSelector()}
				{this.renderParser()}
				{this.renderContentLeftovers()}
				{this.renderContent()}
				{this.state._error && <div style={{fontSize: 24, color: COLORS.red()}}>Error: {this.state._error}</div>}
			</div>
			<div className="ll_v_l children_fill" style={{overflowY: 'auto', height: '100%'}}>
				{/*{this.state.matchGroups && this.state.matchGroups.map((group, index) => <div className="ll_h_c" style={{height: 40}}>*/}
				{/*	<div style={{fontSize: 24, marginInlineEnd: 8}}>{index}</div>*/}
				{/*	{group.toString()}</div>)}*/}
				{this.state.invoiceNumber && <div className="ll_h_c children_space" style={{margin: 4, background: COLORS.gray()}}>
					<div>Invoice Number: {this.state.invoiceNumber}</div>
					<div>Date: {this.state.invoiceDate}</div>
					<div>Matches #{this.state.matchDetails?.length}</div>
				</div>}
				{this.state.matchDetails && this.state.matchDetails.map((groupDetails, _index) => (
					<div className="ll_h_c " style={{margin: 4, background: COLORS.gray()}}>
						<div className="ll_v_c" style={{fontSize: 32, minWidth: 48}}>{_index}</div>
						<div className="ll_v_l" style={{background: COLORS.veryLightPink(), inlineSize: '-webkit-fill-available'}}>
							{groupDetails && groupDetails.map((group, index) => <div className="ll_h_c" style={{margin: 2}}>
								<div className="ll_v_c" style={{fontSize: 24, minWidth: 40, height: '100%'}}>{index}</div>
								<div>{group?.toString()}</div>
							</div>)}
						</div>
					</div>))}
			</div>
		</div>;
	}

	private renderVendor() {
		return <DropDown_Vendor.selectable
			selected={this.state.selectedVendor}
			onSelected={(selectedVendor) => {
				if (!selectedVendor.invoiceParsers)
					selectedVendor.invoiceParsers = [];
				Pref_vendorId.set(selectedVendor._id);
				return this.setState({selectedVendor});
			}}/>;
	}

	private renderParserSelector() {
		const vendor = this.state.selectedVendor;
		if (!vendor)
			return '';

		const parsers = vendor.invoiceParsers || (vendor.invoiceParsers = []);
		const adapter = SimpleListAdapter(parsers, (props: NodeRendererProps<InvoiceRegexpParser>) => <div
			className="ll_h_c"
			style={{justifyContent: 'space-between'}}>{props.item.name}{ICONSV4.remove({onClick: () => removeItemFromArray(parsers, props.item)})}</div>);

		return <TS_DropDown<InvoiceRegexpParser>
			placeholder={'Choose parser'}
			adapter={adapter}
			filter={new Filter(vendor => [vendor.name])}
			selected={this.resolveParser()}
			onNoMatchingSelectionForString={(label?: string) => {
				if (!label?.length || label.length < 5)
					return;

				const parserId = generateHex(32);
				parsers.push({
					_id: parserId,
					name: label
				});
				Pref_parserId.set(parserId);
				this.setState({parserId, content: this.getContent(parserId)});
			}}
			onSelected={(parser: InvoiceRegexpParser) => {
				Pref_parserId.set(parser._id);
				this.setState({parserId: parser._id, content: this.getContent(parser._id)});
			}}
		/>;
	}

	private renderParser() {
		const selectedParser = this.resolveParser();
		if (!selectedParser)
			return '';

		return <Component_InvoiceParserEditor
			parser={selectedParser}
			matchesCount={this.state.matchDetails?.[0]?.length || 0}
			onChanged={() => {
				this.calculate();
			}}
			parseItems={this.state.parseItems || false}
			parseItemsChanged={(enabled) => {
				this.setState({parseItems: enabled}, this.calculate);
			}}
			onSave={() => {
				ModuleFE_Vendor.v1.upsert(this.state.selectedVendor as DB_Vendor).execute();
			}}/>;
	}

	private renderContent() {
		return <div className="ll_h_t">
			<div style={{minWidth: 80}}>Content</div>
			<TS_TextArea
				id={`invoice-${this.state.parserId}`}
				type={'text'} style={{...style, width: '100%', height: 400}}
				value={this.state.content}
				onBlur={() => {
					this.calculate();
				}}
				onChange={(content) => {
					this.setContent(content);
					this.setState({content: content}, this.calculate);
				}}
			/>
		</div>;
	}

	private renderContentLeftovers() {
		return <div className="ll_h_t">
			<div style={{minWidth: 80}}>Leftovers</div>
			<TS_TextArea
				enable={false}
				id={`invoice-leftovers-${this.state.parserId}`}
				type={'text'} style={{...style, width: 1000, height: 400}}
				value={this.state.contentLeftovers}
			/>
		</div>;
	}

	private calculate(setState = true) {
		const parser = this.resolveParser();
		if (!parser)
			return {matchGroups: [], matchDetails: [], _error: '', invoiceNumber: '', contentLeftovers: ''};

		let content: string;
		try {
			content = parser.regexpFindReplace?.filter(i => i.enabled !== false)
				.reduce((toRet, findAndReplace) => toRet.replace(new RegExp(findAndReplace.find, 'g'), findAndReplace.replace), this.state.content) || this.state.content;
		} catch (e: any) {
			this.setState({_error: e.message});
			content = this.state.content;
		}
		let invoiceNumber: string = '';
		if (parser.invoiceNumberRegexp) {
			const invoiceNumberRegExp = new RegExp(parser.invoiceNumberRegexp);
			const invoiceMatch = content.match(invoiceNumberRegExp);
			invoiceNumber = invoiceMatch?.[1] || '';
		}
		let invoiceDate: string = '';
		if (parser.invoiceDateRegexp) {
			const dateRegexp = new RegExp(parser.invoiceDateRegexp);
			const dateMatch = content.match(dateRegexp);
			invoiceDate = dateMatch?.[1] || '';
		}
		const itemsRegexp = parser.regexpItems || '';
		if (!parser)
			return {matchGroups: [], matchDetails: [], _error: '', invoiceNumber};

		const regExpGroup = new RegExp(itemsRegexp, 'gm');
		const regExp = new RegExp(itemsRegexp);
		const matchGroups = content.match(regExpGroup);
		let contentLeftovers = content;
		if (this.state.parseItems)
			contentLeftovers = matchGroups?.reduce((toRet, match) => {
				return toRet.replace(match, '');
			}, content) || '';

		const matchDetails = matchGroups?.map(match => match.match(regExp));
		const state = {matchGroups, matchDetails, _error: '', invoiceNumber, invoiceDate, contentLeftovers};
		if (setState)
			this.setState(state);
		return state;
	}

	private resolveParser() {
		return this.state.selectedVendor?.invoiceParsers?.find(p => p._id === this.state.parserId);
	}

	private renderDownloadButton() {
		const parser = this.resolveParser();
		if (!parser)
			return '';

		return ICONSV4.download_csv({
			onClick: (e) => {
				const {matchDetails, _error} = this.calculate(false);
				if (_error)
					return ModuleFE_Toaster.toastError(_error);

				if (!matchDetails)
					return ModuleFE_Toaster.toastError('No content to export');

				const headerMapper = parser.headerMapper;
				if (!headerMapper)
					return ModuleFE_Toaster.toastError('No headerMapper to export');

				const rowsObjects = flatArray(filterInstances((matchDetails as (RegExpMatchArray | null)[]).map(groupDetails => {
					if (!groupDetails)
						return undefined;

					const items = headerMapper.reduce((toRet, header, index) => {
						const value = groupDetails[header.index];
						let item = toRet[toRet.length - 1];
						if (!value || !header)
							return toRet;

						if (item[header.property] !== undefined) {
							item = {...item};
							toRet.push(item);
							for (let i = index + 1; i < headerMapper.length; i++) {
								const _header = headerMapper[i];

								if (!_header)
									continue;
								delete item[_header.property];

								if (_header.property === header.property)
									break;
							}
						}

						item[header.property] = value?.toString() || '';
						return toRet;
					}, [{}] as TS_Object[]);

					if (items.length > 1) {
						const sku = items[0][Prop_SKU];
						items.forEach(item => {
							if (item[Prop_Barcode] === sku) {
								item[Prop_Barcode] = `${item[Prop_SKU]}-${item[Prop_Size]}`;
							}
							if (item[Prop_SKU] === sku) {
								item[Prop_SKU] = `${item[Prop_SKU]}-${item[Prop_Size]}`;
							}
						});
					}
					return items;
				})));

				const headersOrder: string[] = filterDuplicates(headerMapper.map(header => header.property));
				const content = csvSerializer(rowsObjects, {columns: headersOrder});
				const fileName = `${this.state.selectedVendor?.title}-${this.state.invoiceNumber}.csv`;
				ModuleFE_Thunderstorm.downloadFile({fileName, mimeType: MimeType_csv, content: content});
			}
		});
	}
}

const regexpItemsPref = new StorageKey<string>('invoice-parser.regexpItems');
const regexpFindReplacePref = new StorageKey<FindAndReplace[]>('invoice-parser.regexpFindReplace');
const headerMapperPref = new StorageKey<InvoiceRegexpHeader[]>('invoice-parser.headerMapperV2');

class Component_InvoiceParserEditor
	extends ComponentAsync<{
		parser: InvoiceRegexpParser,
		parseItems: boolean,
		parseItemsChanged: (enabled: boolean) => void,
		onChanged: () => void,
		onSave: () => void,
		matchesCount: number
	}> {

	shouldComponentUpdate(): boolean {
		return true;
	}

	render() {
		return <div>
			{this.renderLabel()}
			{this.renderItemsRegexp()}
			<LL_H_T>
				{this.renderHeadersMapper()}
				<LL_V_L>
					{this.renderInvoiceNumberRegexp()}
					{this.renderInvoiceDateRegexp()}
				</LL_V_L>
			</LL_H_T>
			{this.renderFindAndReplace()}
		</div>;
	}

	private renderLabel() {
		return <LL_H_T>
			<div style={{minWidth: 80, width: 80}}>Label</div>
			<div style={marginsStyle}>
				<TS_Input
					onChange={value => this.props.parser.name = value}
					onBlur={this.props.onSave}
					type="text"
					id="parser-name"
					value={this.props.parser.name} style={{border: '1px solid black'}}/>
			</div>
		</LL_H_T>;
	}

	private renderInvoiceNumberRegexp() {
		return <LL_H_T>
			<div style={{minWidth: 80, width: 150}}>Invoice Number:</div>
			<div className="match_width" style={marginsStyle}>
				<TS_Input
					onChange={value => {
						this.props.parser.invoiceNumberRegexp = value;
						this.props.onChanged();
					}}
					type="text"
					id="invoice-number-regexp"
					value={this.props.parser.invoiceNumberRegexp} style={{border: '1px solid black'}}
					onBlur={this.props.onSave}
				/>

			</div>
		</LL_H_T>;
	}

	private renderInvoiceDateRegexp() {
		return <LL_H_T>
			<div style={{minWidth: 80, width: 150}}>Invoice Date:</div>
			<div className="match_width" style={marginsStyle}>
				<TS_Input
					onChange={value => {
						this.props.parser.invoiceDateRegexp = value;
						this.props.onChanged();
					}}
					type="text"
					id="invoice-date-regexp"
					value={this.props.parser.invoiceDateRegexp} style={{border: '1px solid black'}}
					onBlur={this.props.onSave}
				/>

			</div>
		</LL_H_T>;
	}

	private renderHeadersMapper() {
		const headers = this.props.parser.headerMapper || (this.props.parser.headerMapper = headerMapperPref.get([]));
		const indexAdapter = SimpleListAdapter(new Array(this.props.matchesCount).fill(0).map((k, i) => i),
			toRender => <>{toRender.item}</>);

		const propertyAdapter = SimpleListAdapter(CsvProperties, toRender => <>{toRender.item}</>);

		return <LL_H_T>
			<div style={{minWidth: 80, width: 80}}>Match to Prop</div>
			<div style={{...marginsStyle, width: 500}}>
				{headers.map((header, index) => <LL_H_C className="match_width" key={`header-${index}`}>
						<div style={{width: 200}}>
							<TS_DropDown<number>
								selectedItemRenderer={(index) => <div>{index}</div>}
								filter={new Filter((index) => [`${index}`])}
								adapter={indexAdapter}
								selected={header.index}
								onSelected={(index) => {
									header.index = index;
									headerMapperPref.set(headers);
									this.props.onSave();
								}}/>
						</div>
						<div style={marginsStyle}>=&gt;</div>
						<div style={{width: 200}}>
							<TS_DropDown<string>
								selectedItemRenderer={(index) => <div>{index}</div>}
								filter={new Filter((property) => [property])}
								adapter={propertyAdapter}
								selected={header.property}
								onSelected={(property) => {
									header.property = property;
									headerMapperPref.set(headers);
									this.props.onSave();
								}}/>
						</div>
						<div style={marginsStyle}>{ICONSV4.remove({
							onClick: () => {
								removeItemFromArray(headers, header);
								this.props.onSave();
								this.forceUpdate();
							}
						})}</div>

					</LL_H_C>
				)}
				{ICONSV4.add({
					onClick: (e) => {
						headers.push({index: 0, property: ''});
						this.forceUpdate();
					}
				})}
			</div>
		</LL_H_T>;
	}

	private renderFindAndReplace() {
		const regexpFindReplace = this.props.parser.regexpFindReplace || (this.props.parser.regexpFindReplace = regexpFindReplacePref.get([]));
		return <div>
			{regexpFindReplace.map((findAndReplace, index) => {
					if (findAndReplace.enabled === undefined)
						findAndReplace.enabled = true;

					return <LL_H_C style={{marginTop: 6, marginBottom: 6}}>
						<div style={{minWidth: 80, width: 80}}>Find</div>
						<LL_V_C style={{marginInlineEnd: 6}}>
							{ICONSV4.triangle_up({
								style: {marginBottom: 1},
								onClick: (e) => {
									if (index === 0)
										return;

									removeItemFromArray(regexpFindReplace, findAndReplace);
									addItemToArrayAtIndex(regexpFindReplace, findAndReplace, index - 1);
									return this.props.onChanged();
								}
							})}
							{ICONSV4.triangle_down({
								style: {marginTop: 1},
								onClick: (e) => {
									if (index >= regexpFindReplace.length - 1)
										return;

									removeItemFromArray(regexpFindReplace, findAndReplace);
									addItemToArrayAtIndex(regexpFindReplace, findAndReplace, index + 1);
									return this.props.onChanged();
								}
							})}
						</LL_V_C>
						<TS_Checkbox id={`invoice-find-on-${index}`} checked={findAndReplace.enabled} onCheck={enabled => {
							findAndReplace.enabled = enabled;
							this.props.onChanged();
						}}/>
						<TS_TextArea
							id={`invoice-find-${index}`}
							type={'text'}
							style={{...style, width: 420, height: 20}}
							value={findAndReplace.find}
							onBlur={this.props.onSave}
							onChange={(regexpFind) => {
								findAndReplace.find = regexpFind;
								regexpFindReplacePref.set(regexpFindReplace);
								this.props.onChanged();
							}}/>
						<div style={{minWidth: 80, width: 80}}>Replace</div>
						<TS_TextArea
							id={`invoice-replace-${index}`}
							type={'text'}
							style={{...style, width: 420, height: 20}}
							value={findAndReplace.replace}
							onBlur={this.props.onSave}
							onChange={(regexpReplace) => {
								findAndReplace.replace = regexpReplace;
								regexpFindReplacePref.set(regexpFindReplace);
								this.props.onChanged();
							}}/>
						{ICONSV4.remove({
							onClick: () => {
								removeItemFromArray(regexpFindReplace, findAndReplace);
								this.props.onSave();
							}
						})}
					</LL_H_C>;
				}
			)}
			{ICONSV4.add({
				onClick: (e) => {
					regexpFindReplace.push({find: '', replace: '', enabled: true});
					this.forceUpdate();
				}
			})}
		</div>;
	}

	private renderItemsRegexp() {
		const parser = this.props.parser;
		return <LL_H_C>
			<div style={{minWidth: 80, width: 80}}>Regexp Items</div>
			<TS_TextArea
				id={`items-regexp`}
				type={'text'} style={{...style, width: '100%', height: 60}}
				value={parser.regexpItems || regexpItemsPref.get('')}
				onBlur={this.props.onSave}
				onChange={(regexpItems) => {
					regexpItemsPref.set(regexpItems);
					parser.regexpItems = regexpItems;
					this.props.onChanged();
				}}/>
			<TS_Checkbox id={`invoice-items-regexp`} checked={this.props.parseItems} onCheck={enabled => {
				this.props.parseItemsChanged(enabled);
			}}/>
		</LL_H_C>;
	}

}

