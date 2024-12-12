import {Locale_EN} from "@res/localization/en";
import {AppStrings, DeclaredStrings} from "@res/localization/AppLanguage";
import {_keys} from "@nu-art/ts-common";
import {ModuleFE_Locale, ModuleFE_Locale_Class} from "@nu-art/thunderstorm/frontend";

export const LOCALE: AppStrings = _keys(Locale_EN).reduce((toRet, key) => {
	toRet[key] = (ModuleFE_Locale as unknown as ModuleFE_Locale_Class<DeclaredStrings>).stringify(key)
	return toRet;
}, {} as AppStrings)
