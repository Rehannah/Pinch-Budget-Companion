// This file initializes the application, sets up event listeners, and manages routing between pages.

import { initRouter } from './router.js';
import { initStorage } from './storage.js';

document.addEventListener('DOMContentLoaded', () => {
    initStorage();
    initRouter();
});