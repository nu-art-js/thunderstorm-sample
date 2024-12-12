import {KB, Module} from '@nu-art/ts-common';
import {CollectPermissionsProjects, PermissionProject_Permissions} from '@nu-art/permissions/backend/modules/ModuleBE_Permissions';
import {DefaultDef_Project} from '@nu-art/permissions/shared/types';
import {PermissionsPackage_Translations} from '@infra/translations/backend/_permissions';
import {PermissionsPackage_Store} from '../permissions-tbd/inventory/store';
import {PermissionsPackage_PatchForStrictMode} from '../permissions-tbd/_patch/permissions';
import {PermissionsPackage_Developer, PermissionsPackage_Permissions} from '@nu-art/permissions/backend/permissions';
import {PermissionsPackage_PushMessages} from '@nu-art/push-pub-sub/backend/core/permissions';
import {PermissionsPackage_AssetsManager} from '@nu-art/file-upload/backend/core/permissions';
import {ModuleBE_AssetsDB} from '@nu-art/file-upload/backend';
import {AssetType} from '@app/common/shared/core/types';
import {PermissionsPackage_SupplyChain} from '@app/supply-chain/backend/permissions';
import {PermissionsPackage_CustomerOrder} from '@app/customer-relation/backend/permissions';


const packages = [
	PermissionsPackage_Permissions,
	PermissionsPackage_Developer,
	PermissionsPackage_Translations,
	PermissionsPackage_CustomerOrder,
	PermissionsPackage_Store,
	PermissionsPackage_SupplyChain,
	PermissionsPackage_PatchForStrictMode,
	PermissionsPackage_PushMessages,
	PermissionsPackage_AssetsManager,
];

export const AssetType_TestUpload: AssetType<['test']> = {
	fileTypes: ['txt'],
	key: 'test-upload',
};

export class ModuleBE_AppModule_Class
	extends Module
	implements CollectPermissionsProjects {

	protected init() {
		super.init();

		ModuleBE_AssetsDB.register(AssetType_TestUpload.key, {
			fileType: AssetType_TestUpload.fileTypes,
			maxSize: KB
		});
	}

	__collectPermissionsProjects(): DefaultDef_Project {
		return {
			name: 'Petit Fawn',
			_id: '62354f5e567be2d5bbe2ac6bc163ed2f',
			packages: packages,
			// PATCH: permissions domains unique ids should be project id and domain uid, which then will break the things
			groups: [...PermissionProject_Permissions.groups!]
		};
	}
}

export const ModuleBE_AppModule = new ModuleBE_AppModule_Class();
