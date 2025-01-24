import {DB_Object, DBProto, Proto_DB_Object, VersionsDeclaration} from '@nu-art/ts-common';

type VersionTypes_Person = {
	'1.0.0': DB_Person
}
type Versions = VersionsDeclaration<['1.0.0'], VersionTypes_Person>;
type UniqueKeys = '_id';
type GeneratedProps = never
type Dependencies = {}
type DBKey = 'person'
type Proto = Proto_DB_Object<DB_Person, DBKey, GeneratedProps, Versions, UniqueKeys, Dependencies>;
export type DBProto_Person = DBProto<Proto>;
export type UI_Person = DBProto_Person['uiType'];


export type DB_Person = DB_Object & {
	firstName: string,
	lastName: string,
	age: number
};