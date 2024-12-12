export const config = {
	ModuleFE_Thunderstorm: {
		appName: '(LOCAL) - Petit Fawn - Scraper'
	},
	ModuleFE_XHR: {
		origin: 'https://localhost:8008',
		timeout: 30000,
		compress: false
	},
	EnvironmentModule: {
		envName: 'local',
	},
	ModuleFE_Firebase: {
		local: {
			apiKey: 'AIzaSyADXumUuQ8r1IS6kpXJlg4-CqIUhWjzY8o',
			authDomain: 'shopify-manager-tool-dev.firebaseapp.com',
			databaseURL: 'https://shopify-manager-tool-dev-default-rtdb.firebaseio.com',
			projectId: 'shopify-manager-tool-dev',
			storageBucket: 'shopify-manager-tool-dev.appspot.com',
			messagingSenderId: '1032362823947',
			appId: '1:1032362823947:web:eba19963ec48814d6ed20e',
			measurementId: 'G-YM9KX3S6MN'
		}
	},
	ModuleFE_PushPubSub: {
		publicKeyBase64: 'BHFJ2eKaeY6bADT1Udrh5L8wKTENwSGTcxyieZAo2jrjJ-mR4VzW-koYTkz8B3jbBYhzGsB4KpNKjEOAToEG_4Y'
	},
	ModuleFE_ForceUpgrade: {
		assertVersionUrl: '/v1/version/assert'
	},
	isDebug: true
};
