import {ModuleFE_BaseApi} from '@nu-art/thunderstorm/frontend/index';
import {DispatcherDef, ThunderDispatcherV3} from '@nu-art/thunderstorm/frontend/core/db-api-gen/types';
import {DBDef_Person, DBProto_Person} from '@app/core-shared/_entity/person/index';

export type DispatcherType_Person = DispatcherDef<DBProto_Person, `__onPersonUpdated`>;
export const dispatch_onPersonUpdated = new ThunderDispatcherV3<DispatcherType_Person>('__onPersonUpdated');

export class ModuleFE_Person_Class
	extends ModuleFE_BaseApi<DBProto_Person> {

	constructor() {
		super(DBDef_Person, dispatch_onPersonUpdated);
	}

}

export const ModuleFE_Person = new ModuleFE_Person_Class();

