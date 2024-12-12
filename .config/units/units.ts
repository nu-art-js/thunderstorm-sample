import {Unit_TypescriptLib, Unit_TypescriptProject} from '@nu-art/build-and-install/v2/unit/core';
import {RelativePath} from '@nu-art/ts-common';
import {Unit_FirebaseFunctionsApp, Unit_FirebaseHostingApp} from '@nu-art/build-and-install/v2/unit/firebase-units';
import {AppConfig} from './app-configs';


export const Unit_Root = new Unit_TypescriptProject({key: 'root', label: 'Root', pathToPackage: '.' as RelativePath,});

export const Unit_Core = {
	shared: new Unit_TypescriptLib({key: 'core-shared', pathToPackage: 'core/shared' as RelativePath, label: 'Core Shared', output: 'dist'}),
	frontend: new Unit_TypescriptLib({key: 'core-frontend', pathToPackage: 'core/frontend' as RelativePath, label: 'Core FE', output: 'dist'}),
	backend: new Unit_TypescriptLib({key: 'core-backend', pathToPackage: 'core/backend' as RelativePath, label: 'Core BE', output: 'dist'}),
};


export const App = {
	backend: new Unit_FirebaseFunctionsApp({
		                                       key: 'app-backend', label: 'Backend', pathToPackage: 'app/backend' as RelativePath, output: 'dist',
		                                       firebaseConfig: AppConfig
	                                       }),
	frontend: new Unit_FirebaseHostingApp({
		                                      key: 'app-frontend', label: 'Frontend', pathToPackage: 'app-frontend' as RelativePath, output: 'dist',
		                                      customTSConfig: true, firebaseConfig: AppConfig,
	                                      })

};