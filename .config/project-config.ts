import {ProjectConfigV2} from '@nu-art/build-and-install/v2/project/types';
import * as fs from 'fs';
import {BadImplementationException, lastElement} from '@nu-art/ts-common';
import {
	App,
	Unit_Core,
	Unit_Root,
} from './units/units';
import {MemKey_PhaseRunner} from '@nu-art/build-and-install/v2/phase-runner/consts';
import {
	phase_Compile,
	phase_DeployBackend,
	phase_DeployFrontend,
	phase_Launch,
	phases_Build,
	phases_Deploy,
	phases_Launch,
	phases_Terminating
} from '@nu-art/build-and-install/v2/phase';
import {RuntimeParams} from '@nu-art/build-and-install/core/params/params';
import {MemKey_BAIScreenManager} from '@nu-art/build-and-install/v2/screens/BAIScreenManager';
import {BAIScreen_UnitList} from '@nu-art/build-and-install/v2/screens/BAIScreen_UnitList';
import {BAIScreen_Launch} from '@nu-art/build-and-install/v2/screens/BAIScreen_Launch';
import {convertToFullPath} from '@nu-art/commando/shell/tools';
import {Unit_Firebase} from '@nu-art/build-and-install/v2/unit/thunderstorm';


export default async () => {
	const pathToProjectVersion = convertToFullPath('version-app.json');
	const pathToThunderstormVersion = convertToFullPath('version-thunderstorm.json');

	if (!fs.existsSync(pathToProjectVersion))
		throw new BadImplementationException('Missing version-app.json file in project root');

	if (!fs.existsSync(pathToThunderstormVersion))
		throw new BadImplementationException('Missing version-thunderstorm.json file in project root');

	const runner = MemKey_PhaseRunner.get();
	const phases = [
		...phases_Terminating,
		...phases_Build,
		...phases_Launch,
		...phases_Deploy,
	];
	phases.forEach(phase => runner.appendPhase(phase));

	//Set screens
	const screenManager = MemKey_BAIScreenManager.get();
	const unitListScreen = new BAIScreen_UnitList();
	const launchScreen = new BAIScreen_Launch();
	unitListScreen.setOnKillCallback(() => runner.killRunner());
	launchScreen.setOnKillCallback(() => runner.killRunner());
	screenManager.addScreen(unitListScreen, {
		startOnPhase: phases[0],
		stopOnPhase: RuntimeParams.launch ? phase_Launch : lastElement(phases), condition: () => !RuntimeParams.allLogs
	});
	screenManager.addScreen(launchScreen, {
		startOnPhase: phase_Launch,
		stopOnPhase: RuntimeParams.launch ? lastElement(phases) : phase_Launch,
		condition: () => !RuntimeParams.allLogs
	});
	// @ts-ignore
	Unit_Firebase.config = {...Unit_Firebase.config, customTSConfig: true};
	const units = [
		Unit_Root,
		Unit_Core.shared,
		Unit_Core.frontend,
		Unit_Core.backend,
		App.backend,
		App.frontend,
	];
	runner.registerUnits(units);

	phase_DeployBackend.unitFilter = (unit) => {
		return !!unit.config.key.match(new RegExp(RuntimeParams.deployBackend))?.[0];
	};

	phase_Compile.unitFilter = (unit) => {
		return !RuntimeParams.noBuild;
	};

	phase_DeployFrontend.unitFilter = (unit) => {
		return !!unit.config.key.match(new RegExp(RuntimeParams.deployFrontend))?.[0];
	};

	phase_Launch.unitFilter = (unit) => {
		return !!unit.config.key.match(new RegExp(RuntimeParams.launch))?.[0];
	};

	const config: ProjectConfigV2 = {
		projectVersion: require(pathToProjectVersion).version,
		thunderstormVersion: require(pathToThunderstormVersion).version,
		params: {
			'GOOGLE_CLOUD_COMMON': '^5.0.2',
			'GOOGLE_CLOUD_STORAGE': '^7.15.0',
			'GOOGLE_CLOUD_FIRESTORE': '^7.11.0',
			'MOMENT_PKG_VERSION': '^2.29.4',
			'FIREBASE_PKG_VERSION': '^11.1.0',
			'FIREBASE_ADMIN_PKG_VERSION': '13.0.2',
			'FIREBASE_FUNCTIONS_PKG_VERSION': '6.2.0',
			'REACT_PKG_VERSION': '^18.2.0',
			'REACT_DOM_PKG_VERSION': '^18.2.0',
			'REACT_ROUTER_DOM_PKG_VERSION': '^6.9.0',
			'REACT_TYPES_VERSION': '^18.0.29',
			'REACT_DOM_TYPES_VERSION': '^18.0.11',
			'REACT_ROUTER_TYPES_VERSION': '^5.1.20',
			'REACT_ROUTER_DOM_TYPES_VERSION': '^5.3.3',

			'CHAI_TYPES_VERSION': '^4.3.4',
			'MOCHA_TYPES_VERSION': '^10.0.1',

			'QS_TYPES_VERSION': '^6.5.2',
			'NODE_TYPES_VERSION': '^22.0.0',
			'EXPRESS_PKG_VERSION': '^4.18.2',
			'EXPRESS_TYPES_VERSION': '^4.17.17',
			'EXPRESS_SERVE_STATIC_CORE_TYPES_VERSION': '^4.17.0',
			'TYPESCRIPT_PKG_VERSION': 'latest',
			'ANTLR_PKG_VERSION': '0.5.0-alpha.4',
			'LINT_MAIN_COMMAND': 'lint',
			'REACT_DATE_PICKER_PKG_VERSION': '^4.10.0',
			'REACT_KONVA_PKG_VERSION': '^18.2.5',
			'REACT_DATE_PICKER_TYPES_VERSION': '^4.10.0',
			'GOOGLE_SPREADSHEET_TYPE_VERSION': '^4.0.0',
			'GOOGLE_SPREADSHEET_PKG_VERSION': '^4.0.0',
			'GOOGLE_TRANSLATE_PKG_VERSION': '^8.2.0',
			'WEBPACK_PKG_VERSION': '5.95.0',
			'SASS_LOADER_PKG_VERSION': '16.0.2',
			'ES_LINT_VERSION': '9.18.0',
			'ES_LINT_PLUGIN_VERSION': '8.19.1',
		},
		defaultFileRoutes: {
			firebaseConfig: {
				databaseRules: `${__dirname}/.firebase-config/database.rules.json`,
				storageRules: `${__dirname}/.firebase-config/storage.rules`,
				firestoreIndexesRules: `${__dirname}/.firebase-config/firestore.indexes.json`,
				firestoreRules: `${__dirname}/.firebase-config/firestore.rules`,
			},
		}
	};

	return config;
}