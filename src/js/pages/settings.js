// This file contains the logic for the settings page.

import { clearTransactionsOnly, getState } from '../storage.js';

window.initSettings = async function(){
    const btn = document.getElementById('restart-app');
    if(btn) btn.addEventListener('click', async ()=>{
        if(!confirm('Clear all transactions and restart?')) return;
        
        // Store flag so dashboard knows to show onboarding
        sessionStorage.setItem('showOnboardingAfterRestart', 'true');
        
        // Clear transactions
        await clearTransactionsOnly();
        
        // Redirect to dashboard
        window.location.href = 'dashboard.html';
    });
}