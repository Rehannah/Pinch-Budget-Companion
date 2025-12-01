// This file contains the logic for the settings page.

import { clearTransactionsOnly, getState } from '../storage.js';

window.initSettings = async function(){
    // Restart: clear transactions and redirect to dashboard where onboarding will show
    const btn = document.getElementById('restart-app');
    if(btn) btn.addEventListener('click', async ()=>{
        if(!confirm('Clear all transactions and restart? You can keep or change categories on the next page.')) return;
        await clearTransactionsOnly();
        // redirect to dashboard so onboarding shows there
        window.location.href = 'dashboard.html';
    });

    // show some info about current state
    const state = await getState();
    
}