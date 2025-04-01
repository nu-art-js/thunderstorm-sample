import {createApisForDBModuleV3} from '@nu-art/thunderstorm/backend';
import {ModuleBE_PersonDB} from './ModuleBE_PersonDB';


export const ModulePackBE_FAQDB = [ModuleBE_PersonDB, createApisForDBModuleV3(ModuleBE_PersonDB)];