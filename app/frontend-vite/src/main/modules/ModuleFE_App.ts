/*
 * Copyright (C) 2020 Adam van der Kruk aka TacB0sS
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 */
import {Module} from '@nu-art/ts-common';

export class ModuleFE_App_Class
	extends Module {

	protected init() {
		window.addEventListener('load', () => {
			this.logInfo('Thunderstorm template FE (Vite) loaded!');
		});
	}
}

export const ModuleFE_App = new ModuleFE_App_Class();
