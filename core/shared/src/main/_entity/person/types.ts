import {DB_Object, DB_ProtoSeed, DB_Prototype, VersionsDeclaration} from '@nu-art/db-api-shared';

type DBKey = 'person';

export type DB_Person = DB_Object<DBKey> & {
	firstName: string;
	lastName: string;
	age: number;
};

type VersionTypes_Person = { '1.0.0': DB_Person };
type Versions = VersionsDeclaration<['1.0.0'], VersionTypes_Person>;
type UniqueKeys = '_id';
type GeneratedKeys = never;
type Dependencies = {};

export type DatabaseDef_Person = DB_Prototype<DB_ProtoSeed<DB_Person, DBKey, GeneratedKeys, Versions, UniqueKeys, Dependencies>>;
export type UI_Person = DatabaseDef_Person['uiType'];
