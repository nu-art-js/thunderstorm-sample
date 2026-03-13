import {tsValidateNumber, tsValidateString} from '@nu-art/ts-common';
import {Database} from '@nu-art/db-api-shared';
import {DatabaseDef_Person} from './types.js';

const Validator_ModifiableProps: DatabaseDef_Person['modifiablePropsValidator'] = {
	firstName: tsValidateString(),
	lastName: tsValidateString(),
	age: tsValidateNumber()
};

const Validator_GeneratedProps: DatabaseDef_Person['generatedPropsValidator'] = {};

export const DBDef_Person: Database<DatabaseDef_Person> = {
	dbKey: 'person',
	entityName: 'Person',
	modifiablePropsValidator: Validator_ModifiableProps,
	generatedPropsValidator: Validator_GeneratedProps,
	versions: ['1.0.0'],
	uniqueKeys: ['_id'],
	frontend: {
		group: 'sample-app',
		name: 'person'
	},
	backend: {
		name: 'person'
	}
};
