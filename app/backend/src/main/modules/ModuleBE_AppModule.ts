import {Module} from '@nu-art/ts-common';
import {CollectPermissionsProjects, DefaultDef_Project, PermissionProject_Permissions, PermissionsPackage_Developer, PermissionsPackage_Permissions} from '@nu-art/permissions-backend';
import {toPermissionProjectId} from '@nu-art/permissions-shared';

const packages = [
	PermissionsPackage_Permissions,
	PermissionsPackage_Developer,
];

export class ModuleBE_AppModule_Class
	extends Module
	implements CollectPermissionsProjects {

	protected init() {
		super.init();
	}

	__collectPermissionsProjects(): DefaultDef_Project {
		return {
			name: 'Petit Fawn',
			_id: toPermissionProjectId('62354f5e567be2d5bbe2ac6bc163ed2f'),
			packages: packages,
			// PATCH: permissions domains unique ids should be project id and domain uid, which then will break the things
			groups: [...PermissionProject_Permissions.groups!]
		};
	}
}

export const ModuleBE_AppModule = new ModuleBE_AppModule_Class();
