/*
 * Copyright (C) 2020 Adam van der Kruk aka TacB0sS
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 */
import {AppPage} from '@nu-art/thunderstorm-frontend';
import {Outlet} from 'react-router-dom';

export class Page_Main
	extends AppPage {

	constructor(props: any) {
		super(props);
	}

	render() {
		return <Outlet/>;
	}
}
