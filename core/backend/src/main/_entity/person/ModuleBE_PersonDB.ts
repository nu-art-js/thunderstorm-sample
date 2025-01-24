import {DBApiConfigV3, ModuleBE_BaseDB,} from '@nu-art/thunderstorm/backend';
import {DBDef_Person, DBProto_Person} from '@app/core-shared/_entity/person';

type Config = DBApiConfigV3<DBProto_Person> & {};

export class ModuleBE_PersonDB_Class
	extends ModuleBE_BaseDB<DBProto_Person, Config> {

	constructor() {
		super(DBDef_Person);
	}
}

export const ModuleBE_PersonDB = new ModuleBE_PersonDB_Class();
