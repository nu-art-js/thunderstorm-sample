/*
 * A typescript & react boilerplate with api call example
 *
 * Copyright (C) 2020 Adam van der Kruk aka TacB0sS
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// tslint:disable:no-import-side-effect
import './res/styles/index.scss';
import {ModuleFE_Locale, ModulePackFE_Thunderstorm, Thunder} from '@nu-art/thunderstorm/frontend';
import {FirebaseAnalyticsModule} from '@nu-art/firebase/frontend';
import {ModuleFE_App} from '@modules/index';
import {ModulePackFE_Permissions} from '@nu-art/permissions/frontend';
import {ModulePackFE_FileUploader} from '@nu-art/file-upload/frontend';
import {MimeType_csv} from '@nu-art/ts-common';
import * as React from 'react';
import {LanguageEN, Locale_EN} from '@res/localization/en';
import {LanguageNL, Locale_NL} from '@res/localization/nl';
import {LanguageHE, Locale_HE} from '@res/localization/he';
import {Page_Main} from '@page/Page_Main';
import './App.scss';
import {ThunderstormDefaultApp} from '@nu-art/thunderstorm/frontend/core/ThunderstormDefaultApp';
import {ModuleFE_Theme} from '@modules/ModuleFE_Themes';
import {ModulePackFE_Accounts} from '@nu-art/user-account/frontend';
import {ModulePackFE_TranslationInfra} from '@infra/translations/frontend';
import {ModuleFE_PDF} from '@nu-art/ts-pdf/frontend/modules/ModuleFE_PDF';
import {AssetRenderer, AssetRendererProps} from '@app/common/frontend/components/asset/AssetRenderer';
import {ModulePackFE_SupplyChain} from '@app/supply-chain/frontend/module-pack';
import {ModulePackFE_CommonTBD} from '@app/common/frontend/module-pack';
import {ModuleFE_FirebaseListener} from '@nu-art/firebase/frontend/ModuleFE_FirebaseListener/ModuleFE_FirebaseListener';
import {ModuleFE_TranslationEntry} from '@app/common/_entity/translation/frontend';
import {Module_KeyBinder} from '@app/customer-relation/frontend/customer-order/Page_CustomerOrder';
import {ModulePackFE_AutoComplete} from '@app/tools/_entity/auto-complete/frontend/module-pack';
import {ModulePackFE_Inventory} from '@app/store/frontend/module-pack';
import {ModulePackFE_CustomerRelation} from '@app/customer-relation/frontend/module-pack';
import {ModulePackFE_FocusedObject} from '@nu-art/ts-focused-object/frontend/modules/module-pack';
import {ModuleFE_ProductTemplate} from '@app/product-template/_entity/product-template/frontend';

// ModuleFE_LocalStorage.setPersistentDebugState();
const modules = [
	FirebaseAnalyticsModule,
	ModuleFE_PDF,

	ModuleFE_TranslationEntry,
	ModuleFE_ProductTemplate,

	ModuleFE_App,
	ModuleFE_Theme,

	ModuleFE_Locale,
];

ModuleFE_Locale.setDefaultConfig({
	languages: {
		[LanguageHE.shortLocale]: {
			language: LanguageHE,
			texts: Locale_HE
		},
		[LanguageEN.shortLocale]: {
			language: LanguageEN,
			texts: Locale_EN
		},
		[LanguageNL.shortLocale]: {
			language: LanguageNL,
			texts: Locale_NL
		}
	},
	defaultLocal: LanguageEN.shortLocale
});

AssetRenderer.setCustomRenderers({
	[MimeType_csv]: (p: AssetRendererProps) => <div>
		<img src={require('@res/img/file-type--csv.png')}/>
	</div>
});

Module_KeyBinder.mount();
// eslint-disable-next-line @typescript-eslint/no-var-requires
const config = require('./config').config;
new Thunder()
	.setConfig(config)
	.addModulePack([ModuleFE_FirebaseListener])
	.addModulePack(ModulePackFE_Thunderstorm)
	.addModulePack(ModulePackFE_Accounts)
	.addModulePack(ModulePackFE_FocusedObject)
	// .addModulePack(ModulePackFE_PushPubSub)
	.addModulePack(ModulePackFE_Permissions)
	.addModulePack(ModulePackFE_AutoComplete)
	.addModulePack(ModulePackFE_CommonTBD)
	.addModulePack(ModulePackFE_SupplyChain)
	.addModulePack(ModulePackFE_Inventory)
	.addModulePack(ModulePackFE_CustomerRelation)
	.addModulePack(ModulePackFE_FileUploader)
	.addModulePack(ModulePackFE_TranslationInfra)
	.addModulePack(modules)
	.setMainApp(ThunderstormDefaultApp, {rootRoute: Page_Main.Route})
	.build();

