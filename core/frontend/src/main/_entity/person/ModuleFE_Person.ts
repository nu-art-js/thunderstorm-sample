import {buildConfigFromDBDef, ModuleFE_BaseApi} from '@nu-art/db-api-frontend';
import {type ApiCallerEventType, CrudApiDef} from '@nu-art/db-api-shared';
import {ThunderDispatcher} from '@nu-art/thunder-core';
import {DatabaseDef_Person, DBDef_Person} from '@app/core-shared';

export interface OnPersonUpdated {
	__onPersonUpdated: (...params: ApiCallerEventType<DatabaseDef_Person['dbType']>) => void;
}

export const dispatch_onPersonChanged = new ThunderDispatcher<OnPersonUpdated, '__onPersonUpdated'>('__onPersonUpdated');

export class ModuleFE_Person_Class
	extends ModuleFE_BaseApi<DatabaseDef_Person> {

	constructor() {
		super({
			config: buildConfigFromDBDef<DatabaseDef_Person>(DBDef_Person),
			crudApiDef: CrudApiDef<DatabaseDef_Person>(DBDef_Person.dbKey),
			dispatcher: (...args) => dispatch_onPersonChanged.dispatchAll(...args)
		});
	}
}

export const ModuleFE_Person = new ModuleFE_Person_Class();
