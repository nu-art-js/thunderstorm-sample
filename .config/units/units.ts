import {Unit_TypescriptLib, Unit_TypescriptProject} from '@nu-art/build-and-install/v2/unit/core';
import {RelativePath} from '@nu-art/ts-common';


export const Unit_Root = new Unit_TypescriptProject({key: 'root', label: 'Root', pathToPackage: '.' as RelativePath,});

export const Unit_Core = {
	shared: new Unit_TypescriptLib({key: 'core-shared', pathToPackage: 'core/shared' as RelativePath, label: 'Core Shared', output: 'dist'}),
	frontend: new Unit_TypescriptLib({key: 'core-frontend', pathToPackage: 'core/frontend' as RelativePath, label: 'Core FE', output: 'dist'}),
	backend: new Unit_TypescriptLib({key: 'core-backend', pathToPackage: 'core/backend' as RelativePath, label: 'Core BE', output: 'dist'}),
};
