import {RuntimeParams} from '@nu-art/build-and-install/core/params/params';
import {Phase} from '@nu-art/build-and-install/v2/phase';

// can add custom phases here
export type Phase_SetupLocalProject = typeof phase_SetupLocalProject;
export const phase_SetupLocalProject: Phase<'setupLocalProject'> = {
	key: 'setup-local-project',
	name: 'Setup Local Project',
	method: 'setupLocalProject',
	filter: () => RuntimeParams.setup,
};
