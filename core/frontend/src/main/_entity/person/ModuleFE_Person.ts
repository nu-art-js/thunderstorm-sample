import {ModuleFE_BaseApi, DBConfig_ModuleFE, EventDispatcher} from '@nu-art/db-api-frontend';
import {ApiCallerEventType, CrudApiDef} from '@nu-art/db-api-shared';
import {DatabaseDef_Person, DB_Person, DBDef_Person} from '@app/core-shared';

const personConfig: DBConfig_ModuleFE<DatabaseDef_Person> = {
	dbKey: DBDef_Person.dbKey,
	validator: DBDef_Person.modifiablePropsValidator,
	uniqueKeys: (DBDef_Person.uniqueKeys ?? ['_id']) as DatabaseDef_Person['uniqueKeys'],
	versions: DBDef_Person.versions,
	dbConfig: {
		name: DBDef_Person.frontend?.name ?? DBDef_Person.dbKey,
		group: DBDef_Person.frontend?.group ?? 'default',
		version: DBDef_Person.versions[0] ?? '1.0.0',
		uniqueKeys: ['_id']
	}
};

export const dispatch_onPersonUpdated: EventDispatcher<DB_Person> = (..._params: ApiCallerEventType<DB_Person>) => {
	// No-op or wire to app dispatcher when needed
};

export class ModuleFE_Person_Class
	extends ModuleFE_BaseApi<DatabaseDef_Person> {

	constructor() {
		super({
			config: personConfig,
			crudApiDef: CrudApiDef<DatabaseDef_Person>(DBDef_Person.dbKey),
			dispatcher: dispatch_onPersonUpdated
		});
	}
}

export const ModuleFE_Person = new ModuleFE_Person_Class();
