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
		appName: "(STG) - Petit Fawn - Scraper"
	},
	ModuleFE_XHR: {
		origin: "https://us-central1-knac-staging.cloudfunctions.net/api",
		timeout: 10000
	},
	ModuleFE_Firebase: {
		local: {
			apiKey: "AIzaSyB-7ArLARa4VJ2DCQOp7cFIi8rnI2HwkxA",
			authDomain: "knac-staging.firebaseapp.com",
			databaseURL: "https://knac-staging.firebaseio.com",
			projectId: "knac-staging",
			storageBucket: "knac-staging.appspot.com",
			messagingSenderId: "470576855702",
			appId: "1:470576855702:web:d3e753a5186cfc23cda0b7",
			measurementId: "G-QL1J2E5TTG"
		}
	},
	ModuleFE_PushPubSub: {
		publicKeyBase64: 'BMhtg_rH-jnn_Cp9rG79GiUcdkCyXgrPj-_t1aXo27nuyPWM83IzAA_Ue7G2nSmacOM9jZyXNGokqYvAcEzGP5k'
	},
	ModuleFE_ForceUpgrade: {
		assertVersionUrl: "/v1/version/assert"
	},
};
