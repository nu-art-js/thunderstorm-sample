/*
 * Copyright (C) 2020 Adam van der Kruk aka TacB0sS
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 */
import {createRoot} from 'react-dom/client';
import {App} from './App.js';
import './App.scss';

const root = document.getElementById('root');
if (!root)
	throw new Error('Root element not found');

createRoot(root).render(<App />);
