import {FirebaseEnvConfig} from '@nu-art/build-and-install/core/types';

const GCP_ProjectId_Dev = 'my-gcp-project-id-dev';
const GCP_ProjectId_Staging = 'my-gcp-project-id-staging';
const GCP_ProjectId_Prod = 'my-gcp-project-id';

const App_Local: FirebaseEnvConfig<'local'> = {
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
			config: {
				apiKey: 'apiKey-dev',
				authDomain: 'my-gcp-project-id-dev.firebaseapp.com',
				databaseURL: 'https://my-gcp-project-id-dev-default-rtdb.firebaseio.com',
				projectId: 'my-gcp-project-id-dev',
				storageBucket: 'my-gcp-project-id-dev.appspot.com',
				messagingSenderId: '641435297260',
				appId: 'appId-dev',
				measurementId: 'G-3J8TGPS7EM'
			}
		}
	}
};

const App_Dev: FirebaseEnvConfig<'dev'> = {
	name: 'Dev',
	env: 'dev',
	projectId: GCP_ProjectId_Dev,
	backend: {
		url: 'https://advisor-backend.dev.quai.md',
		timeout: 30000
	},
	firebase: {
		listener: {
			config: {
				apiKey: 'apiKey-dev',
				authDomain: 'my-gcp-project-id-dev.firebaseapp.com',
				databaseURL: 'https://my-gcp-project-id-dev-default-rtdb.firebaseio.com',
				projectId: 'my-gcp-project-id-dev',
				storageBucket: 'my-gcp-project-id-dev.appspot.com',
				messagingSenderId: '641435297260',
				appId: 'appId-dev',
				measurementId: 'G-3J8TGPS7EM'
			}
		}
	}
};

const App_Staging: FirebaseEnvConfig<'staging'> = {
	name: 'Staging',
	env: 'staging',
	projectId: GCP_ProjectId_Staging,
	backend: {
		url: 'https://advisor-backend.staging.quai.md/',
		timeout: 30000
	},
	firebase: {
		listener: {
			config: {
				apiKey: 'apiKey-staging',
				authDomain: 'my-gcp-project-id-staging.firebaseapp.com',
				databaseURL: 'https://my-gcp-project-id-staging-default-rtdb.firebaseio.com',
				projectId: 'my-gcp-project-id-staging',
				storageBucket: 'my-gcp-project-id-staging.appspot.com',
				messagingSenderId: '946431553636',
				appId: 'appId-staging',
				measurementId: 'G-ZM2N77KQ7X'
			}
		}
	}
};

const App_Prod: FirebaseEnvConfig<'prod'> = {
	name: 'Prod',
	env: 'prod',
	projectId: GCP_ProjectId_Prod,
	backend: {
		url: 'https://advisor-backend.quai.md/',
		timeout: 30000
	},
	firebase: {
		listener: {
			config: {
				apiKey: 'apiKey-prod',
				authDomain: 'my-gcp-project-id.firebaseapp.com',
				databaseURL: 'https://my-gcp-project-id-default-rtdb.firebaseio.com',
				projectId: 'my-gcp-project-id',
				storageBucket: 'my-gcp-project-id.appspot.com',
				messagingSenderId: '662263362818',
				appId: 'appId-prod'
			}
		}
	}
};

const App_Envs = [
	App_Local,
	App_Dev,
	App_Staging,
	App_Prod,
];


export const AppConfig = {
	...{
		'pathToFirebaseConfig': '.firebase_config',
		'functions': {
			'ignore': ['src',
			           '.config',
			           'dist-test',
			           'deploy.js',
			           'node_modules',
			           'firebase-export-*',
			           'launch-server.sh',
			           'ports-release.sh',
			           'ui-debug.log',
			           'database-debug.log',
			           'firestore-debug.log',
			           'firebase-debug.log']
		},
		'hosting': {
			'public': 'dist',
			'rewrites': [
				{'source': '**', 'destination': '/index.html'}
			]
		},
		'headers': [
			{
				'source': '**/*.html',   // Target all HTML files
				'headers': [
					{
						'key': 'Cache-Control',
						'value': 'no-store, no-cache, must-revalidate, proxy-revalidate'
					},
					{
						'key': 'Pragma',
						'value': 'no-cache'
					},
					{
						'key': 'Expires',
						'value': '0'
					}
				]
			},
			// {
			// 	'source': '**/*.{js,css}',  // Apply 31 day cache for JS/CSS with versioning
			// 	'headers': [
			// 		{
			// 			'key': 'Cache-Control',
			// 			'value': 'public, max-age=111600, immutable'
			// 		}
			// 	]
			// }
		]
	},
	name: 'App Backend',
	envs: App_Envs,
	ssl: {
		pathToKey: `${__dirname}/.ssl/server-key.pem`,
		pathToCertificate: `${__dirname}/.ssl/server-cert.pem`
	},
	debugPort: 8300,
	hostingPort: 8301,
	basePort: 8302
};
