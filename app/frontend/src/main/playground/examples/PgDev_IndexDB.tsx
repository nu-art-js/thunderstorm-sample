import * as React from 'react';
import {
	AppPage, ATS_ToRefactor,
	IndexedDB,
	StorageKey,
	TS_Input
} from '@nu-art/thunderstorm/frontend';
import {DB_Object} from '@nu-art/ts-common/';


type Type1 = DB_Object & {
	_id: string
	key: string
	content: string
}
const typeValue1 = {key: '1111', _id: 'qqqq', content: 'content1'} as Type1;
const typeValue2 = {key: '2222', _id: 'aaaa', content: 'content1'} as Type1;
const typeValue3 = {key: '3333', _id: 'qqqq', content: 'content1'} as Type1;
const typeValue4 = {key: '1111', _id: 'aaaa', content: 'content2'} as Type1;
const typeValue5 = {key: '1111', _id: 'bbbb', content: 'Some text'} as Type1;
const typeValue6 = {key: '2222', _id: 'cccc', content: 'text other'} as Type1;
const typeValue7 = {key: '3333', _id: 'dddd', content: 'send texture'} as Type1;
const typeValue8 = {key: '2222', _id: 'eeee', content: 'pah male texul'} as Type1;

class Pg_Component
	extends AppPage<{}, { regexp?: string, results?: Type1[] }> {
	private dbType1!: IndexedDB<Type1, 'key' | '_id'>;
	private ashpa!: IndexedDB<any, any>;

	private regexp = new StorageKey<string>('regexp-search-test');
	static defaultProps = {
		pageTitle: () => PgDev_IndexDB.name
	};

	constructor(p: {}) {
		super(p);
	}

	protected deriveStateFromProps(nextProps: {}) {
		return {regexp: this.regexp?.get('')};
	}

	openType1 = async () => {
		this.dbType1 = IndexedDB.getOrCreate<Type1, 'key' | '_id'>({name: 'type1-db', uniqueKeys: ['key', '_id']});
		await this.dbType1.open();
	};

	openAshpa = async () => {
		this.ashpa = IndexedDB.getOrCreate({name: 'type2-db', uniqueKeys: ['_id']});
		await this.ashpa.open();
	};

	addAshpa = async () => {
		await this.ashpa.upsert({ashpa: 'zevel1'});
	};

	render() {
		return <>
			<div className="ll_h_t">
				<div className="ll_v_l">
					<div>TYPE1</div>
					<button style={{marginRight: 8}} onClick={this.openType1}>Open</button>
					<hr/>
					<button style={{marginRight: 8}} onClick={async () => this.logDebug(await this.dbType1.upsert(typeValue1))}>upsert 'type1_1'</button>
					<button style={{marginRight: 8}} onClick={async () => this.logDebug(await this.dbType1.upsert(typeValue2))}>upsert 'type1_2'</button>
					<button style={{marginRight: 8}} onClick={async () => this.logDebug(await this.dbType1.upsert(typeValue3))}>upsert 'type1_3'</button>
					<button style={{marginRight: 8}} onClick={async () => this.logDebug(await this.dbType1.upsert(typeValue4))}>upsert 'type1_4'</button>
					<button style={{marginRight: 8}} onClick={async () => this.logDebug(await this.dbType1.upsert(typeValue5))}>upsert 'type1_5'</button>
					<button style={{marginRight: 8}} onClick={async () => this.logDebug(await this.dbType1.upsert(typeValue6))}>upsert 'type1_6'</button>
					<button style={{marginRight: 8}} onClick={async () => this.logDebug(await this.dbType1.upsert(typeValue7))}>upsert 'type1_7'</button>
					<button style={{marginRight: 8}} onClick={async () => this.logDebug(await this.dbType1.upsert(typeValue8))}>upsert 'type1_8'</button>
					<hr/>
					<button style={{marginRight: 8}} onClick={async () => this.logDebug(await this.dbType1.get({key: '1111', _id: 'qqqq'}))}>get 'type1_1'</button>
					<hr/>
					<button style={{marginRight: 8}} onClick={async () => this.logDebug(await this.dbType1.delete({key: '1111', _id: 'qqqq'}))}>delete 'type1_1'</button>
					<TS_Input value={this.state.regexp} onChange={async (value) => {
						this.regexp.set(value);
						const results = await this.dbType1.queryFilter((item) => new RegExp(value || '').test(item.content));
						return this.setState({regexp: value, results});
					}} type={'text'} id="regexp"/>
					{this.state.results?.map(r => <div>{JSON.stringify(r)}</div>)}
					{/*<button style={{marginRight: 8}} onClick={async () => this.logDebug(await this.dbType1.delete(typeValue4.key, typeValue4._id))}>delete 'type1_4'</button>*/}
				</div>
				<div className="ll_v_l">
					<div>TYPE2</div>
					<button style={{marginRight: 8}} onClick={this.openAshpa}>Open</button>
					<button style={{marginRight: 8}} onClick={this.addAshpa}>Add to 'zevel'</button>
				</div>
			</div>
		</>;
	}
}

export const PgDev_IndexDB = {name: 'IndexDB', renderer: Pg_Component, group: ATS_ToRefactor};
