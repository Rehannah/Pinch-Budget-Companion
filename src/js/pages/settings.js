// This file contains the logic for the settings page, including functions for exporting and importing data.

import { clearAllData, resetForNewMonth, getState } from '../storage.js';

window.initSettings = async function(){
    // Simple restart: clear all stored data and reload so onboarding runs again
    const btn = document.getElementById('restart-app');
    if(btn) btn.addEventListener('click', async ()=>{
        if(!confirm('This will remove all app data and restart. Are you sure?')) return;
        await clearAllData();
        // reload so app.js will run initStorage and show onboarding when no month is set
        window.location.reload();
    });

    // show some info about current state
    const state = await getState();
    
}