/*
 * Permissions management system, define access level for each of
 * your server apis, and restrict users by giving them access levels
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

export const config = {
	ModuleFE_Thunderstorm: {
		appName: '(DEV) - Petit Fawn - Scraper'
	},
	ModuleFE_XHR: {
		// origin: "http://192.168.1.5:3000",
		origin: 'https://us-central1-shopify-manager-tool-dev.cloudfunctions.net/api',
		timeout: 30000
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
};
