// This file contains the logic for the settings page.

import { getState, resetForNewMonth, clearAllData } from '../storage.js';

window.initSettings = async function(){
    const btn = document.getElementById('restart-app');
    if(btn) btn.addEventListener('click', async ()=>{
        // Show a modal to choose restart options (keep categories or clear everything)
        const html = `
            <div class="space-y-3">
                <label class="block text-sm">New month</label>
                <input id="restart-month" type="month" class="w-full p-2 border rounded" />
                <label class="block text-sm">Base budget</label>
                <input id="restart-base" type="number" step="0.01" class="w-full p-2 border rounded" placeholder="0.00" />
                <label class="flex items-center gap-2"><input id="restart-keep-cats" type="checkbox" /> Keep existing categories for next month</label>
                <div class="text-sm text-gray-600">If you do NOT keep categories, all categories and transactions will be cleared and the app will start fresh.</div>
                <label class="flex items-center gap-2 mt-2"><input id="restart-clear-all" type="checkbox" /> Also clear <strong>everything</strong> (delete all metadata, categories, transactions)</label>
            </div>
        `;

        window.showModal({ title: 'Restart for new month', html, saveText: 'Restart', onSave: async ()=>{
            const month = document.getElementById('restart-month').value || null;
            const base = parseFloat(document.getElementById('restart-base').value) || 0;
            const keepCats = !!document.getElementById('restart-keep-cats').checked;

            if(!month){
                alert('Please choose a month to continue.');
                return false; // keep modal open
            }
            if(Number.isNaN(base) || base < 0){
                alert('Base budget must be a number ≥ 0.');
                return false;
            }

            // If user requested full clear, delete all persisted data and caches.
            const clearAll = !!document.getElementById('restart-clear-all').checked;
            if(clearAll){
                // Confirm destructive action
                if(!confirm('This will delete ALL app data (including month, base, categories, and transactions). Are you sure?')) return false;
                // Clear IndexedDB/localforage store
                await clearAllData();
                // Clear SW caches (best-effort)
                if(window.clearServiceWorkersAndCaches) await window.clearServiceWorkersAndCaches();
                // Notify user
                if(window.showToast) window.showToast('All app data cleared. Starting fresh.');
                // Redirect to dashboard which will trigger onboarding (no month set)
                setTimeout(()=> window.location.href = 'dashboard.html', 500);
                return;
            }

            // When keepCats is true, pass the current categories into resetForNewMonth so they persist
            // When false, pass an empty array so categories are cleared.
            const state = await getState();
            let catsToPass = keepCats ? state.categories.map(c=>({ name: c.name, limit: c.limit, type: c.type })) : [];
            // Validate category limits do not exceed baseBudget
            const expenseCats = catsToPass.filter(c=>c.type !== 'income');
            const totalAssigned = expenseCats.reduce((s,c)=>s + Number(c.limit || 0), 0);
            if(totalAssigned > base){ alert('One or more category limits exceed the Base Budget. Please adjust limits before restarting.'); return false; }
            // If there is remaining unallocated budget, inform the user (do not auto-apply)
            const remaining = Math.max(0, base - totalAssigned);
            if(remaining > 0 && expenseCats.length > 0){
                const html2 = `<div class="mb-2"><p class="small">You have $${remaining.toFixed(2)} unallocated from your base budget. You can manually allocate this later from Settings or the Dashboard.</p></div>`;
                // show informational modal only; do not automatically add the remaining amount to any category
                await new Promise(res => { window.showModal({ title: 'Unallocated budget', html: html2, saveText: 'OK', onSave: ()=>{ res(); }, onCancel: ()=> res(); }); });
            }

            await resetForNewMonth({ month, baseBudget: base, categories: catsToPass });
            if(window.showToast) window.showToast('Restart complete — new month set.');
            // Redirect to dashboard
            setTimeout(()=> window.location.href = 'dashboard.html', 400);
        }});
    });
}