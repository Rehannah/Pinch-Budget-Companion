// App bootstrap (ES module). Mounts header and initializes storage and current page script.
import Header, { initHeader } from '../components/header.js';
import { initStorage, getState, resetForNewMonth } from './storage.js';

function mountHeader() {
    const el = document.getElementById('app-header');
    if (!el) return;
    el.innerHTML = Header();
    initHeader();
}

async function showOnboarding(isRestarting = false){
    console.log('[showOnboarding] called with isRestarting:', isRestarting);
    if(document.getElementById('onboard-modal')) {
        console.log('[showOnboarding] modal already exists, returning');
        return;
    }
    
    const state = await getState();
    const hasExistingCategories = isRestarting && state && state.categories && state.categories.length > 0;
    console.log('[showOnboarding] hasExistingCategories:', hasExistingCategories);
    
    // Build modal HTML
    const modal = document.createElement('div');
    modal.id = 'onboard-modal';
    modal.className = 'position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-4';
    modal.style.backgroundColor = 'rgba(0,0,0,0.5)';
    modal.innerHTML = `
        <div class="bg-white rounded shadow p-4" style="max-width:28rem; width:100%">
            <h3 class="h5 fw-semibold">${isRestarting ? 'Restart' : 'Welcome'} — Setup your month</h3>
            <div class="mt-3">
                <label class="form-label small">Month</label>
                <input id="onboard-month" type="text" class="form-control" placeholder="e.g. 01-2025" />
                <label class="form-label small mt-2">Base budget</label>
                <input id="onboard-base" type="number" step="0.01" class="form-control" placeholder="0.00" />

                ${hasExistingCategories ? `
                <div class="form-check mt-2 mb-2">
                    <input class="form-check-input" type="checkbox" id="onboard-keep-cats" checked />
                    <label class="form-check-label small" for="onboard-keep-cats">Keep existing categories</label>
                </div>
                ` : ''}

                <div class="mt-3">
                    <div class="d-flex align-items-center justify-content-between">
                        <label class="form-label small">Categories</label>
                        <button id="onboard-add-cat" class="btn btn-link small text-primary">+ Add</button>
                    </div>
                    <div id="onboard-cat-list" class="mt-2" style="max-height:10rem; overflow:auto"></div>
                </div>

                <div class="d-flex gap-2 justify-content-end mt-3">
                    <button id="onboard-skip" class="btn btn-secondary">Skip</button>
                    <button id="onboard-save" class="btn btn-primary">Start</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    console.log('[showOnboarding] modal appended to DOM');

    // Helper to create a category input row
    function addCatRow(name='', limit='', type='expense'){
        const row = document.createElement('div');
        row.className = 'd-flex gap-2 align-items-center mb-2';
        row.innerHTML = `
            <input class="form-control flex-grow-1" placeholder="Category name" value="${name}" />
            <input class="form-control" style="width:6rem" placeholder="Limit" value="${limit}" />
            <select class="form-select" style="width:8rem">
                <option value="expense" ${type==='expense'?'selected':''}>Expense</option>
                <option value="income" ${type==='income'?'selected':''}>Income</option>
            </select>
            <button class="btn btn-link text-danger p-0">Remove</button>
        `;
        // Toggle limit input visibility/disabled state based on type selection
        const parts = row.querySelectorAll('input,select');
        const nameInput = parts[0];
        const limitInput = parts[1];
        const typeSelect = parts[2];
        function toggleLimit(){
            if(typeSelect.value === 'income'){
                limitInput.style.display = 'none';
                limitInput.disabled = true;
                limitInput.value = '';
            } else {
                limitInput.style.display = 'block';
                limitInput.disabled = false;
            }
        }
        typeSelect.addEventListener('change', toggleLimit);
        toggleLimit();
        row.querySelector('button').addEventListener('click', () => row.remove());
        return row;
    }

    // Helper to show/refresh category display
    function updateCategoryDisplay(showExisting){
        const list = document.getElementById('onboard-cat-list');
        list.innerHTML = '';
        
        if(showExisting && state.categories.length > 0){
            // Show existing categories as read-only labels. Do not show limits for income categories.
            state.categories.forEach(cat => {
                const label = document.createElement('div');
                label.className = 'small p-2 bg-light rounded mb-2';
                if(cat.type === 'expense'){
                    label.textContent = `${cat.name} - $${Number(cat.limit).toLocaleString(undefined,{minimumFractionDigits:2, maximumFractionDigits:2})} (${cat.type})`;
                } else {
                    label.textContent = `${cat.name} (${cat.type})`;
                }
                list.appendChild(label);
            });
        }
    }

    // Set up event handlers
    const keepCheckbox = document.getElementById('onboard-keep-cats');
    const categoryList = document.getElementById('onboard-cat-list');
    const addBtn = document.getElementById('onboard-add-cat');
    const skipBtn = document.getElementById('onboard-skip');
    const saveBtn = document.getElementById('onboard-save');

    // Initialize category display
    if(keepCheckbox && keepCheckbox.checked){
        updateCategoryDisplay(true);
    }

    // Toggle between keeping categories and adding new ones
    if(keepCheckbox){
        keepCheckbox.addEventListener('change', () => {
            updateCategoryDisplay(keepCheckbox.checked);
        });
    }

    // Add category button
    addBtn.addEventListener('click', () => {
        if(!keepCheckbox || !keepCheckbox.checked){
            categoryList.appendChild(addCatRow());
        }
    });

    // Skip button
    skipBtn.addEventListener('click', () => {
        console.log('[showOnboarding] skip clicked');
        modal.remove();
    });

    // Save button
    saveBtn.addEventListener('click', async () => {
        console.log('[showOnboarding] save clicked');
        const rawMonth = document.getElementById('onboard-month').value.trim();
        const baseBudget = parseFloat(document.getElementById('onboard-base').value);

        // Validate inputs
        // Expect MM-YYYY for onboarding
        const monthRegex = /^(0[1-9]|1[0-2])-(\d{4})$/; // MM-YYYY
        const m = rawMonth.match(monthRegex);
        if(!rawMonth || !m){ alert('Please enter a month in MM-YYYY format (e.g. 01-2025).'); return; }
        const month = `${m[2]}-${m[1]}`; // convert to YYYY-MM
        if(Number.isNaN(baseBudget) || baseBudget < 0){ alert('Base budget must be a number ≥ 0.'); return; }

        // Collect categories
        let categories = [];
        const keepExisting = keepCheckbox && keepCheckbox.checked;

        if(keepExisting){
            // Keep existing categories with their limits
            categories = state.categories || [];
            console.log('[showOnboarding] keeping existing categories:', categories.length);
        } else {
            // Either collect new categories or start with empty array
            const rows = Array.from(categoryList.children).filter(r => r.classList.contains('d-flex'));
            if(rows.length > 0){
                for(const r of rows){
                    const [nameInput, limitInput, typeSelect] = r.querySelectorAll('input,select');
                    const name = (nameInput.value || '').trim();
                    const type = typeSelect.value || 'expense';
                    let limit;
                    if(type === 'expense'){
                        limit = Number(limitInput.value);
                        if(Number.isNaN(limit) || limit < 0){ alert('Category limits must be numbers ≥ 0.'); return; }
                    } else {
                        limit = undefined;
                    }

                    if(!name){ alert('Category names cannot be empty.'); return; }
                    categories.push({ name, limit, type });
                }
            }
            console.log('[showOnboarding] starting with new categories:', categories.length);
        }

        // Reset to new month and reload pages
        console.log('[showOnboarding] calling resetForNewMonth');
        await resetForNewMonth({ month, baseBudget, categories });
        // Show confirmation toast
        try{ window.showToast('Saved successfully'); }catch(e){}
        modal.remove();
        
        if (window.initDashboard) window.initDashboard();
        if (window.initTransactions) window.initTransactions();
        if (window.initSettings) window.initSettings();
    });
}

// Expose globally so settings.js can call it
window.showOnboarding = showOnboarding;

document.addEventListener('DOMContentLoaded', async () => {
    const state = await initStorage();
    mountHeader();

    // Check if we're restarting (came from settings)
    const isRestarting = sessionStorage.getItem('showOnboardingAfterRestart');
    sessionStorage.removeItem('showOnboardingAfterRestart'); // Clear the flag
    
    // Show onboarding if: first run (no month) OR restarting
    if(isRestarting || !state || !state.meta || !state.meta.month){
        console.log('[DOMContentLoaded] showing onboarding (isRestarting:', isRestarting, ')');
        showOnboarding(isRestarting);
    }

    // If page-specific init functions exist, call them.
    if (window.initDashboard) window.initDashboard();
    if (window.initTransactions) window.initTransactions();
    if (window.initSettings) window.initSettings();

    // Show persistent budget mismatch banner across pages (if any)
    try{ window.showBudgetWarningBanner?.(); }catch(e){/* noop */}
});

// Small toast helper for brief success/info messages
window.showToast = function(message, { timeout = 3000 } = {}){
    try{
        const existing = document.getElementById('app-toast');
        if(existing) existing.remove();
        const t = document.createElement('div');
        t.id = 'app-toast';
        t.style.position = 'fixed';
        t.style.right = '1rem';
        t.style.top = '1rem';
        t.style.zIndex = 9999;
        t.style.background = 'rgba(16,24,40,0.95)';
        t.style.color = '#fff';
        t.style.padding = '0.6rem 1rem';
        t.style.borderRadius = '0.5rem';
        t.style.boxShadow = '0 6px 18px rgba(2,6,23,0.2)';
        t.style.fontSize = '0.95rem';
        t.textContent = message;
        document.body.appendChild(t);
        setTimeout(()=>{ t.style.transition = 'opacity 300ms'; t.style.opacity = '0'; setTimeout(()=>t.remove(), 320); }, timeout);
    }catch(e){ console.warn('showToast failed', e); }
};

// Persistent banner: show when total category limits exceed base budget
window.showBudgetWarningBanner = async function(){
    try{
        const state = await getState();
        if(!state) return;
        const base = Number(state.meta?.baseBudget || 0);
        const totalAssigned = (state.categories || []).filter(c=>c.type!=='income').reduce((s,c)=>s + Number(c.limit||0),0);
        const existing = document.getElementById('budget-mismatch-banner');
        // only show when base > 0 and assigned > base
        if(base > 0 && totalAssigned > base){
            // remove existing then re-add to refresh content
            if(existing) existing.remove();
            const diff = totalAssigned - base;
            const banner = document.createElement('div');
            banner.id = 'budget-mismatch-banner';
            banner.className = 'alert alert-danger d-flex justify-content-between align-items-center';
            banner.style.position = 'sticky';
            banner.style.top = '0';
            banner.style.zIndex = 1050;
            banner.innerHTML = `<div class="small">Warning: your expense category limits total <strong>$${totalAssigned.toLocaleString(undefined,{minimumFractionDigits:2, maximumFractionDigits:2})}</strong>, which exceeds your Base Budget <strong>$${base.toLocaleString(undefined,{minimumFractionDigits:2, maximumFractionDigits:2})}</strong> by <strong>$${diff.toLocaleString(undefined,{minimumFractionDigits:2, maximumFractionDigits:2})}</strong>. Adjust limits or transactions.</div><div><button id="dismiss-budget-mismatch" class="btn btn-sm btn-secondary me-2">Dismiss</button></div>`;
            const headerEl = document.getElementById('app-header');
            if(headerEl && headerEl.parentNode) headerEl.parentNode.insertBefore(banner, headerEl.nextSibling);
            else document.body.insertBefore(banner, document.body.firstChild);
            banner.querySelector('#dismiss-budget-mismatch')?.addEventListener('click', ()=> banner.remove());
        } else {
            if(existing) existing.remove();
        }
    }catch(e){ console.warn('showBudgetWarningBanner error', e); }
}

// Helper to unregister service workers and clear Cache Storage (best-effort)
window.clearServiceWorkersAndCaches = async function(){
    try{
        if('serviceWorker' in navigator){
            const regs = await navigator.serviceWorker.getRegistrations();
            for(const r of regs) await r.unregister();
        }
    }catch(e){ console.warn('SW unregister failed', e); }

    try{
        if('caches' in window){
            const keys = await caches.keys();
            await Promise.all(keys.map(k => caches.delete(k)));
        }
    }catch(e){ console.warn('Clearing caches failed', e); }
};

// Listen for changes to the persisted state and update dashboard if present
window.addEventListener('appStateChanged', async (e) => {
    try{
        if(window.initDashboard){
            // Re-initialize dashboard to refresh UI
            window.initDashboard();
        }
        // Refresh global budget warning banner when state changes
        try{ window.showBudgetWarningBanner?.(); }catch(e){/* noop */}
        // Refresh unallocated-banner on dashboard when state changes
        try{ window.showUnallocatedBanner?.(); }catch(e){/* noop */}
    }catch(err){ console.error('appStateChanged handler error', err); }
});

// Show persistent unallocated budget banner on dashboard pages
window.showUnallocatedBanner = async function(){
    try{
        const state = await getState();
        if(!state) return;
        const base = Number(state.meta?.baseBudget || 0);
        const totalAssigned = (state.categories || []).filter(c=>c.type!=='income').reduce((s,c)=>s + Number(c.limit||0),0);
        const remaining = Math.max(0, base - totalAssigned);
        console.debug('[showUnallocatedBanner] base=', base, 'remaining=', remaining);
        const existing = document.getElementById('unallocated-banner');
        if(base > 0 && remaining > 0){
            if(existing) existing.remove();
            const banner = document.createElement('div');
            banner.id = 'unallocated-banner';
            banner.className = 'alert alert-warning d-flex justify-content-between align-items-center';
            banner.innerHTML = `<div class="small">You have $${remaining.toLocaleString(undefined,{minimumFractionDigits:2, maximumFractionDigits:2})} of your base budget unallocated.</div><div><button id="redistribute-btn" class="btn btn-sm btn-outline-primary me-2">Redistribute</button><button id="dismiss-unalloc" class="btn btn-sm btn-secondary">Dismiss</button></div>`;
            const container = document.querySelector('.container');
            const firstSection = container?.querySelector('section');
            if(firstSection && firstSection.parentNode) firstSection.parentNode.insertBefore(banner, firstSection.nextSibling);
            else if(container) container.insertBefore(banner, container.firstChild);
            else document.body.insertBefore(banner, document.body.firstChild);
            banner.querySelector('#dismiss-unalloc')?.addEventListener('click', ()=> banner.remove());
            banner.querySelector('#redistribute-btn')?.addEventListener('click', ()=> showRedistributeModal(remaining, state.categories.filter(c=>c.type!=='income')));
        } else {
            if(existing) existing.remove();
        }
    }catch(e){ /* noop */ }
}

// Small modal utility used by pages to show forms/prompts
window.showModal = function({ title = '', html = '', onSave = null, saveText = 'Save', onCancel = null }){
    const existing = document.getElementById('generic-modal');
    if(existing) existing.remove();
    const modal = document.createElement('div');
    modal.id = 'generic-modal';
    modal.className = 'position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-4';
    modal.style.backgroundColor = 'rgba(0,0,0,0.5)';
    modal.innerHTML = `
        <div class="bg-white rounded shadow p-4" style="max-width:28rem; width:100%">
            <h3 class="h5 fw-semibold">${title}</h3>
            <div class="mt-3">${html}</div>
            <div class="d-flex gap-2 justify-content-end mt-4">
                <button id="modal-cancel" class="btn btn-secondary">Cancel</button>
                <button id="modal-save" class="btn btn-primary">${saveText}</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    document.getElementById('modal-cancel').addEventListener('click', ()=>{ modal.remove(); if(onCancel) onCancel(); });
    document.getElementById('modal-save').addEventListener('click', async ()=>{
        if(onSave){
            try{
                // If onSave explicitly returns false, keep the modal open (useful for validation)
                const res = await onSave();
                if(res === false) return; // do not remove modal
            }catch(err){
                // if onSave throws, log and keep modal open so user can fix issues
                console.error('modal onSave error', err);
                return;
            }
        }
        modal.remove();
        try{ window.showToast('Saved successfully'); }catch(e){}
    });
    return modal;
}

// Simple date formatter: yyyy-mm-dd -> dd-mm-yyyy
window.formatDate = function(dateStr){
    if(!dateStr) return '';
    // Prefer parsing explicit YYYY-MM-DD to avoid timezone shifts from Date constructor
    const isoMatch = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if(isoMatch){
        const yyyy = isoMatch[1];
        const mm = isoMatch[2];
        const dd = isoMatch[3];
        return `${dd}-${mm}-${yyyy}`;
    }
    // Fallback to Date parsing for other formats
    const d = new Date(dateStr);
    if(isNaN(d)) return dateStr;
    const dd = String(d.getDate()).padStart(2,'0');
    const mm = String(d.getMonth()+1).padStart(2,'0');
    const yyyy = d.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
}