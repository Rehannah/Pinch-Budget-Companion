// App bootstrap (ES module). Mounts header and initializes storage and current page script.
import Header, { initHeader } from '../components/header.js';
import { initStorage, getState } from './storage.js';
// Removed CSS import to run without a bundler.

function mountHeader() {
    const el = document.getElementById('app-header');
    if (!el) return;
    el.innerHTML = Header();
    // attach basic nav handlers / highlight active link
    initHeader();
}

document.addEventListener('DOMContentLoaded', async () => {
    const state = await initStorage();
    mountHeader();

    // Note: dark mode toggle removed per user request. Theme-related CSS remains.

    // On first run (no month set) show onboarding
    if(!state || !state.meta || !state.meta.month){
        showOnboarding();
    }

    // subscribe to state changes for autosave/export
    window.addEventListener('appStateChanged', (e)=>{
        const s = e.detail;
        tryAutoExport(s);
    });

        // Service worker registration removed to avoid caching during development

    // If page-specific init functions exist, call them.
    if (window.initDashboard) window.initDashboard();
    if (window.initTransactions) window.initTransactions();
    if (window.initSettings) window.initSettings();
});

async function tryAutoExport(state){
    if(!state || !state.meta) return;
    if(state.meta.saveLocation === 'download' && state.meta.autoSaveToFile){
        // trigger a download of the JSON backup
        const filename = `pinch-backup-${(state.meta.month||'unspecified')}-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;
        const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(a.href);
    }
}

function showOnboarding(){
    // Simple modal injected into DOM to collect month/base/categories
    if(document.getElementById('onboard-modal')) return;
    const modal = document.createElement('div');
    modal.id = 'onboard-modal';
    modal.className = 'position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-4';
    modal.style.backgroundColor = 'rgba(0,0,0,0.5)';
        // Friendly onboarding: allow adding categories with a small form list
        modal.innerHTML = `
            <div class="bg-white rounded shadow p-4" style="max-width:28rem; width:100%">
                <h3 class="h5 fw-semibold">Welcome — Setup your month</h3>
                <div class="mt-3">
                    <label class="form-label small">Month</label>
                    <input id="onboard-month" type="month" class="form-control" />
                    <label class="form-label small mt-2">Base budget</label>
                    <input id="onboard-base" type="number" step="0.01" class="form-control" placeholder="0.00" />

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

        // helper to add a category row
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
            const removeBtn = row.querySelector('button');
            removeBtn.addEventListener('click', ()=> row.remove());
            document.getElementById('onboard-cat-list').appendChild(row);
        }

        document.getElementById('onboard-add-cat').addEventListener('click', ()=> addCatRow());
        document.getElementById('onboard-skip').addEventListener('click', ()=>{ modal.remove(); });
        document.getElementById('onboard-save').addEventListener('click', async ()=>{
                const month = document.getElementById('onboard-month').value || null;
                const base = parseFloat(document.getElementById('onboard-base').value);
                // basic validation
                if(!month){ alert('Please choose a month to continue.'); return; }
                if(Number.isNaN(base) || base < 0){ alert('Base budget must be a number ≥ 0.'); return; }
                const rows = Array.from(document.getElementById('onboard-cat-list').children);
                const cats = [];
                for(const r of rows){
                    const inputs = r.querySelectorAll('input,select');
                    const name = (inputs[0].value || '').trim();
                    const limit = Number(inputs[1].value);
                    const type = inputs[2].value || 'expense';
                    if(!name){ alert('Category names cannot be empty.'); return; }
                    if(Number.isNaN(limit) || limit < 0){ alert('Category limits must be numbers ≥ 0.'); return; }
                    cats.push({ name, limit, type });
                }
                const { resetForNewMonth } = await import('./storage.js');
                await resetForNewMonth({ month, baseBudget: base, categories: cats });
                modal.remove();
                // re-init pages
                if (window.initDashboard) window.initDashboard();
                if (window.initTransactions) window.initTransactions();
                if (window.initSettings) window.initSettings();
            });
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