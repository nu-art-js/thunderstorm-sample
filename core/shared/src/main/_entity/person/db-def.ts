import {DBDef_V3, tsValidateNumber, tsValidateString} from '@nu-art/ts-common';
import {DBProto_Person,} from './types';

const Validator_ModifiableProps: DBProto_Person['modifiablePropsValidator'] = {
	firstName: tsValidateString(),
	lastName: tsValidateString(),
	age: tsValidateNumber()
};

const Validator_GeneratedProps: DBProto_Person['generatedPropsValidator'] = {};

export const DBDef_Person: DBDef_V3<DBProto_Person> = {
	modifiablePropsValidator: Validator_ModifiableProps,
	generatedPropsValidator: Validator_GeneratedProps,
	generatedProps: [],
	versions: ['1.0.0'],
	dbKey: 'person',
	entityName: 'Person',
	frontend: {
		group: 'sample-app',
		name: 'person'
	},
	backend: {
		name: 'person'
	}
};