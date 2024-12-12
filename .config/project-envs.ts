import {FirebaseEnvConfig} from '@nu-art/build-and-install/core/types';
import {Default_FirebaseProjectConfig} from '@nu-art/build-and-install/core/package/consts';


const GCP_ProjectId_Dev = 'my-firebase-project-dev';
const GCP_ProjectId_Prod = 'my-firebase-project-prod';

export const GCP_ProjectIds = {
	local: GCP_ProjectId_Dev,
	dev: GCP_ProjectId_Dev,
	prod: GCP_ProjectId_Prod,
};

const KM_Local: FirebaseEnvConfig<'local'> = {
	name: 'Local',
	env: 'local',
	isLocal: true,
	projectId: GCP_ProjectId_Dev,
	backend: {
		url: '',
		timeout: 30000
	},
	firebase: {
		listener: {
			config: {my-firebase - project - prod}
		}
	},
	otherConfig: {
		ModuleFE_PushPubSub: {
			publicKeyBase64: 'BHFJ2eKaeY6bADT1Udrh5L8wKTENwSGTcxyieZAo2jrjJ-mR4VzW-koYTkz8B3jbBYhzGsB4KpNKjEOAToEG_4Y'
		},
		ModuleFE_Firebase: {
			local: 'my-firebase-project-prod'
		},
		isDebug: true
	}
};

const KM_Dev: FirebaseEnvConfig<'dev'> = {
	name: 'Dev',
	env: 'dev',
	projectId: GCP_ProjectId_Dev,
	backend: {
		url: 'https://api-hhvladacia-uc.a.run.app',
		timeout: 30000
	},
	firebase: {
		listener: {
			config: {my-firebase - project - prod}
		}
	},
	otherConfig: {
		ModuleFE_PushPubSub: {
			publicKeyBase64: 'BHFJ2eKaeY6bADT1Udrh5L8wKTENwSGTcxyieZAo2jrjJ-mR4VzW-koYTkz8B3jbBYhzGsB4KpNKjEOAToEG_4Y'
		},
	}
};

const KM_Prod: FirebaseEnvConfig<'prod'> = {
	name: 'Prod',
	env: 'prod',
	projectId: GCP_ProjectId_Prod,
	backend: {
		url: 'https://mng.be.petitfawn.com',
		timeout: 30000
	},
	firebase: {
		listener: {
			config: {
				apiKey: 'AIzaSyD_zO7uY-0fIhTFR_NPv2320sl0tYRw8Ts',
				authDomain: 'my-firebase-project-prod.firebaseapp.com',
				databaseURL: 'https://my-firebase-project-prod-default-rtdb.firebaseio.com',
				projectId: 'my-firebase-project-prod',
				storageBucket: 'my-firebase-project-prod.appspot.com',
				messagingSenderId: '527530216622',
				appId: '1:527530216622:web:8509ced07bb75013f8f13f',
				measurementId: 'G-3E915TD8G9'
			}
		}
	},
// @ts-ignore
	ModuleFE_PushPubSub: {
		publicKeyBase64: 'BAWFTwi0qWaZnKs3TjAHG4ypdPRGcW9x-_94U-WDUcayijM-IBV8Bn8jgZg-RNR4Im8pl8DyHRchiTJzFxzrGIE'
	},
};

const KM_Envs = [
	KM_Local,
	KM_Dev,
	KM_Prod,
];

export const AppConfig_PetitFawnManager = {
	...Default_FirebaseProjectConfig,
	name: 'Petit Fawn - Manager',
	envs: KM_Envs,
	ssl: {
		pathToKey: `${__dirname}/.ssl/server-key.pem`,
		pathToCertificate: `${__dirname}/.ssl/server-cert.pem`
	},
	debugPort: 8120,
	hostingPort: 8121,
	basePort: 8122
};
