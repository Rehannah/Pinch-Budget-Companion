// This file contains the logic for the settings page.

import { clearTransactionsOnly } from '../storage.js';

window.initSettings = async function(){
    const btn = document.getElementById('restart-app');
    if(btn) btn.addEventListener('click', async ()=>{
        if(!confirm('Clear all transactions and restart?')) return;
        await clearTransactionsOnly();
        // Call showOnboarding which should be defined by app.js
        // If not yet available, wait a tick for app.js to load
        if(typeof window.showOnboarding === 'function') {
            await window.showOnboarding();
        } else {
            console.error('showOnboarding not available. Make sure app.js loads before settings.js');
        }
    });
}