import {createApisForDBModuleV3} from '@nu-art/thunderstorm/backend/index';
import {ModuleBE_PersonDB} from './ModuleBE_PersonDB.js';


export const ModulePackBE_FAQDB = [ModuleBE_PersonDB, createApisForDBModuleV3(ModuleBE_PersonDB)];