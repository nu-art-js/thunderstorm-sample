import {createApisForDBModule} from '@nu-art/db-api-backend';
import {ModuleBE_PersonDB} from './ModuleBE_PersonDB.js';

export const ModulePackBE_PersonDB = [ModuleBE_PersonDB, createApisForDBModule(ModuleBE_PersonDB)];
