import {ModuleBE_BaseDB} from '@nu-art/db-api-backend';
import {DatabaseDef_Person, DBDef_Person} from '@app/core-shared';

export class ModuleBE_PersonDB_Class
	extends ModuleBE_BaseDB<DatabaseDef_Person> {

	constructor() {
		super(DBDef_Person);
	}
}

export const ModuleBE_PersonDB = new ModuleBE_PersonDB_Class();
