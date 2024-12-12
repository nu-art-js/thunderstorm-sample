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
		appName: 'Petit Fawn - Scraper'
	},
	ModuleFE_XHR: {
		origin: 'https://us-central1-shopify-manager-tool.cloudfunctions.net/api',
		timeout: 10000
	},
	ModuleFE_Firebase: {
		local: {
			apiKey: "AIzaSyD_zO7uY-0fIhTFR_NPv2320sl0tYRw8Ts",
			authDomain: "shopify-manager-tool.firebaseapp.com",
			databaseURL: "https://shopify-manager-tool-default-rtdb.firebaseio.com",
			projectId: "shopify-manager-tool",
			storageBucket: "shopify-manager-tool.appspot.com",
			messagingSenderId: "527530216622",
			appId: "1:527530216622:web:8509ced07bb75013f8f13f",
			measurementId: "G-3E915TD8G9"		}
	},
	ModuleFE_ForceUpgrade: {
		assertVersionUrl: "/v1/version/assert"
	},
	ModuleFE_PushPubSub: {
		publicKeyBase64: 'BAWFTwi0qWaZnKs3TjAHG4ypdPRGcW9x-_94U-WDUcayijM-IBV8Bn8jgZg-RNR4Im8pl8DyHRchiTJzFxzrGIE'
	},
};
