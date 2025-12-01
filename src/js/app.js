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
                <input id="onboard-month" type="month" class="form-control" />
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
        row.querySelector('button').addEventListener('click', () => row.remove());
        return row;
    }

    // Helper to show/refresh category display
    function updateCategoryDisplay(showExisting){
        const list = document.getElementById('onboard-cat-list');
        list.innerHTML = '';
        
        if(showExisting && state.categories.length > 0){
            // Show existing categories as read-only labels
            state.categories.forEach(cat => {
                const label = document.createElement('div');
                label.className = 'small p-2 bg-light rounded mb-2';
                label.textContent = `${cat.name} - $${Number(cat.limit).toFixed(2)} (${cat.type})`;
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
        const month = document.getElementById('onboard-month').value;
        const baseBudget = parseFloat(document.getElementById('onboard-base').value);

        // Validate inputs
        if(!month){ alert('Please choose a month to continue.'); return; }
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
                    const limit = Number(limitInput.value);
                    const type = typeSelect.value || 'expense';

                    if(!name){ alert('Category names cannot be empty.'); return; }
                    if(Number.isNaN(limit) || limit < 0){ alert('Category limits must be numbers ≥ 0.'); return; }
                    categories.push({ name, limit, type });
                }
            }
            console.log('[showOnboarding] starting with new categories:', categories.length);
        }

        // Reset to new month and reload pages
        console.log('[showOnboarding] calling resetForNewMonth');
        await resetForNewMonth({ month, baseBudget, categories });
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
});

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
    });
    return modal;
}

// Simple date formatter: yyyy-mm-dd -> dd-mm-yyyy
window.formatDate = function(dateStr){
    if(!dateStr) return '';
    const d = new Date(dateStr);
    if(isNaN(d)){
        // try parsing yyyy-mm-dd
        const parts = dateStr.split('-');
        if(parts.length>=3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
        return dateStr;
    }
    const dd = String(d.getDate()).padStart(2,'0');
    const mm = String(d.getMonth()+1).padStart(2,'0');
    const yyyy = d.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
}