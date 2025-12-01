// This file contains the logic for the settings page.

import { clearTransactionsOnly } from '../storage.js';

window.initSettings = async function(){
    const btn = document.getElementById('restart-app');
    if(btn) btn.addEventListener('click', async ()=>{
        if(!confirm('Clear all transactions and restart?')) return;
        await clearTransactionsOnly();
        // Show onboarding modal on current page (dashboard will load after onboarding completes)
        if(window.showOnboarding) {
            window.showOnboarding();
        }
    });
}