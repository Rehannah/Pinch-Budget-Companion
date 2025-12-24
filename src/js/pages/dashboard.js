import { getState, addCategory, updateCategory, updateCategoryLimit } from '../storage.js';

// Dashboard page initializer — exposes global initDashboard for app.js to call.
window.initDashboard = async function() {
    const state = await getState();
    renderDashboard(state);
    attachHandlers(state);
}

function attachHandlers(state){
    const addBtn = document.getElementById('add-category-btn');
    const editBaseBtn = document.getElementById('edit-base');
    const editMonthBtn = document.getElementById('edit-month');

    if(addBtn){
        addBtn.addEventListener('click', () => showAddCategoryModal());
    }
    
    if(editBaseBtn){
        editBaseBtn.addEventListener('click', () => showEditBaseModal(state));
    }

    if(editMonthBtn){
        editMonthBtn.addEventListener('click', () => showEditMonthModal(state));
    }
}

async function showEditBaseModal(state){
    const html = `
        <div class="mb-3">
            <label class="form-label small">Base Budget</label>
            <input id="modal-base" type="number" step="1.00" class="form-control" value="${Number(state.meta.baseBudget || 0).toFixed(2)}" />
        </div>
    `;
    window.showModal({ title: 'Edit Budget Base', html, saveText: 'Save', onSave: async ()=>{
        const newBase = parseFloat(document.getElementById('modal-base').value);
        if(Number.isNaN(newBase) || newBase < 0){ alert('Budget must be a number ≥ 0.'); return false; }
        // Warn if new base is less than the sum of expense category limits
        try{
            const totalAssigned = state.categories.filter(c=>c.type!=='income').reduce((s,c)=>s + Number(c.limit||0),0);
            if(newBase < totalAssigned){
                const confirmed = await new Promise(res => {
                    const diff = totalAssigned - newBase;
                    const html2 = `<p class="small">The sum of your expense category limits is <strong>$${totalAssigned.toFixed(2)}</strong>, which exceeds the new base by <strong>$${diff.toFixed(2)}</strong>. You should adjust category limits or transaction data. Save anyway?</p>`;
                    window.showModal({ title: 'Base smaller than assigned limits', html: html2, saveText: 'Save anyway', onSave: ()=>{ res(true); }, onCancel: ()=>{ const el = document.getElementById('category-list'); if(el) el.scrollIntoView({ behavior: 'smooth' }); res(false); } });
                });
                if(!confirmed) return false;
            }
        }catch(e){ /* noop */ }

        const { saveState } = await import('../storage.js');
        state.meta.baseBudget = newBase;
        await saveState(state);
        const s = await getState();
        renderDashboard(s);
        // Refresh transactions view and other listeners so month changes propagate
        try{ if(window.initTransactions) await window.initTransactions(); }catch(e){}
        try{ window.dispatchEvent(new CustomEvent('appStateChanged')); }catch(e){}
    }});
}

async function showEditMonthModal(state){
    // Use MM-YYYY input for clarity; store internally as YYYY-MM
    const curMonth = state.meta && state.meta.month ? (()=>{
        const parts = String(state.meta.month).split('-');
        if(parts.length === 2) return `${parts[1]}-${parts[0]}`; // MM-YYYY
        return state.meta.month;
    })() : '';

    const html = `
        <div class="mb-3">
            <label class="form-label small">Month (MM-YYYY)</label>
            <input id="modal-month" type="text" class="form-control" placeholder="e.g. 01-2025" value="${curMonth}" />
        </div>
    `;

    window.showModal({ title: 'Edit Month', html, saveText: 'Save', onSave: async ()=>{
        const raw = document.getElementById('modal-month').value.trim();
        const monthRegex = /^(0[1-9]|1[0-2])-(\d{4})$/; // MM-YYYY
        const m = raw.match(monthRegex);
        if(!raw || !m){ alert('Month must be in MM-YYYY format (e.g. 01-2025).'); return false; }
        const month = m[1];
        const year = m[2];
        const newMonth = `${year}-${month}`; // internal YYYY-MM
        const { saveState } = await import('../storage.js');
        state.meta.month = newMonth;
        // update month/year for all existing transactions to keep them in sync
        if(Array.isArray(state.transactions)){
            state.transactions = state.transactions.map(t => {
                try{
                    const parts = (t.date || '').split('-');
                    const day = parts.length >= 3 ? parts[2] : '01';
                    return { ...t, date: `${newMonth}-${String(day).padStart(2,'0')}` };
                }catch(e){
                    return { ...t };
                }
            });
        }
        await saveState(state);
        const s = await getState();
        renderDashboard(s);
    }});
}

async function showAddCategoryModal(){
    const html = `
        <div class="mb-3">
            <input id="modal-cat-name" class="form-control mb-2" placeholder="Category name" />
            <div class="d-flex gap-2">
                <input id="modal-cat-limit" class="form-control flex-grow-1" placeholder="Limit (optional for income)" />
                <select id="modal-cat-type" class="form-select" style="width:10rem"><option value="expense">Expense</option><option value="income">Income</option></select>
            </div>
        </div>
    `;
        window.showModal({ title: 'Add category', html, onSave: async ()=>{
            const name = document.getElementById('modal-cat-name').value || 'Unnamed';
            const type = document.getElementById('modal-cat-type').value || 'expense';
            let limit;
            if(type === 'expense'){
                const raw = document.getElementById('modal-cat-limit').value;
                limit = raw === '' ? 0 : parseFloat(raw);
                if(Number.isNaN(limit) || limit < 0){ alert('Limit must be a number ≥ 0.'); return false; }
                const st = await getState();
                const baseBudget = Number(st.meta.baseBudget || 0);
                if(baseBudget > 0 && limit > baseBudget){ alert('Category limit cannot exceed the Base Budget.'); return false; }
            } else {
                limit = undefined;
            }
            const newCat = await addCategory({ name, limit, type });
            const s = await getState(); renderDashboard(s);
            // after adding, encourage full allocation if baseBudget not fully assigned
            try{
                const base = Number(s.meta.baseBudget || 0);
                if(base > 0){
                    const totalAssigned = s.categories.filter(c=>c.type!=='income').reduce((sum,c)=>sum+Number(c.limit||0),0);
                    const remaining = Math.max(0, base - totalAssigned);
                    if(remaining > 0){
                        await new Promise(res => {
                            const html2 = `<p class="small">You have $${remaining.toFixed(2)} of your base budget unallocated. Do you want to add it to this category now?</p>`;
                            window.showModal({ title: 'Unallocated budget', html: html2, saveText: 'Add to this category', onSave: async ()=>{
                                const newLimit = (Number(newCat.limit||0) || 0) + remaining;
                                await updateCategory(newCat.id, { limit: newLimit });
                                const s2 = await getState(); renderDashboard(s2);
                                res();
                            }, onCancel: ()=> res() });
                        });
                    }
                }
            }catch(e){ /* noop */ }
        }});
        // Toggle limit input visibility when type changes
        setTimeout(()=>{
            const typeSel = document.getElementById('modal-cat-type');
            const limitInput = document.getElementById('modal-cat-limit');
            if(!typeSel || !limitInput) return;
            function toggle(){ limitInput.style.display = (typeSel.value === 'income') ? 'none' : 'block'; }
            typeSel.addEventListener('change', toggle);
            toggle();
        }, 10);
}

function renderDashboard(state){
        // display full month name (e.g. November 2025)
        let monthLabel = 'Unnamed month';
        if(state.meta && state.meta.month){
                try{
                    // Parse year-month safely (avoid timezone shift) and build a local Date
                    const parts = String(state.meta.month).split('-');
                    if(parts.length === 2){
                        const yyyy = Number(parts[0]);
                        const mm = Number(parts[1]);
                        const d = new Date(yyyy, Math.max(0, mm - 1), 1);
                        monthLabel = d.toLocaleString(undefined, { month: 'long', year: 'numeric' });
                    } else {
                        monthLabel = state.meta.month;
                    }
                }catch(e){ monthLabel = state.meta.month; }
            }
        document.getElementById('month-label').textContent = monthLabel;
        document.getElementById('budget-base').textContent = `Base Budget: $${Number(state.meta.baseBudget || 0).toFixed(2)}`;

    // summary cards
        const totalIncome = state.transactions.filter(t=>t.type==='income').reduce((s,t)=>s+Number(t.amount),0);
        const totalExpense = state.transactions.filter(t=>t.type==='expense').reduce((s,t)=>s+Number(t.amount),0);
        // percentage spent should be based on baseBudget only (income doesn't change base)
        const baseBudget = Number(state.meta.baseBudget || 0) || 0;
        const saved = Math.max(0, baseBudget - totalExpense);
        const spentPercent = baseBudget > 0 ? Math.min(100, Math.round((totalExpense / baseBudget) * 100)) : 0;

    const cards = document.getElementById('summary-cards');
    cards.innerHTML = `
        <div class="col">
            <div class="card text-center p-3">
                <div class="small text-muted">Income</div>
                <div class="h5 fw-semibold text-success">$${totalIncome.toFixed(2)}</div>
            </div>
        </div>
        <div class="col">
            <div class="card text-center p-3">
                <div class="small text-muted">Expenses</div>
                <div class="h5 fw-semibold text-danger">$${totalExpense.toFixed(2)}</div>
            </div>
        </div>
        <div class="col">
            <div class="card text-center p-3">
                <div class="small text-muted">Remaining</div>
                <div class="h5 fw-semibold">$${saved.toFixed(2)}</div>
            </div>
        </div>
    `;

    // show a persistent banner if base budget is not fully allocated across expense categories
    try{
        const container = document.querySelector('.container');
        if(container){
            // remove old banner if present
            const old = document.getElementById('unallocated-banner');
            if(old) old.remove();
            const base = Number(state.meta.baseBudget || 0);
            const totalAssigned = state.categories.filter(c=>c.type!=='income').reduce((s,c)=>s + Number(c.limit||0),0);
            const remaining = Math.max(0, base - totalAssigned);
            if(base > 0 && remaining > 0){
                const banner = document.createElement('div');
                banner.id = 'unallocated-banner';
                banner.className = 'alert alert-warning d-flex justify-content-between align-items-center';
                banner.innerHTML = `<div class="small">You have $${remaining.toFixed(2)} of your base budget unallocated.</div><div><button id="redistribute-btn" class="btn btn-sm btn-outline-primary me-2">Redistribute</button><button id="dismiss-unalloc" class="btn btn-sm btn-secondary">Dismiss</button></div>`;
                // insert banner just after the first section
                const firstSection = container.querySelector('section');
                if(firstSection && firstSection.parentNode){ firstSection.parentNode.insertBefore(banner, firstSection.nextSibling); }
                // attach handlers
                banner.querySelector('#dismiss-unalloc').addEventListener('click', ()=> banner.remove());
                banner.querySelector('#redistribute-btn').addEventListener('click', ()=> showRedistributeModal(remaining, state.categories.filter(c=>c.type!=='income')));
            }
        }
    }catch(e){ /* noop */ }

    // progress bars: income and expense relative to baseBudget (fallback to relative proportions)
    // Top-level: only show how much of the base budget is used (spend bar)
    const spendBar = document.getElementById('spend-bar');
    const percent = document.getElementById('spend-percent');
    if(spendBar) spendBar.style.width = `${Math.min(100, spentPercent)}%`;
    if(percent) percent.textContent = `${spentPercent}% spent`;

    // categories
        // Split categories into income and expense
        const expenseList = document.getElementById('category-list');
        expenseList.innerHTML = '';
        const incomeListContainer = document.createElement('div');
        incomeListContainer.id = 'income-category-list';
        // give extra bottom margin so income and expense lists are visually separated
        incomeListContainer.className = 'mt-3 mb-4';

        // render income categories separately
        const incomeCats = state.categories.filter(c => c.type === 'income');
        const expenseCats = state.categories.filter(c => c.type !== 'income');

        // show income categories
        // show income categories separately with progress bars (income categories have no limits)
        if(incomeCats.length){
            const header = document.createElement('h3'); header.className = 'small fw-semibold'; header.textContent = 'Income';
            incomeListContainer.appendChild(header);

            // compute fallback denominator if no limits present
            const maxEarned = Math.max(...incomeCats.map(c => {
                return state.transactions.filter(t=>t.categoryId===c.id && t.type==='income').reduce((s,t)=>s+Number(t.amount),0);
            }), 1);

            incomeCats.forEach(cat => {
                const earned = state.transactions.filter(t=>t.categoryId===cat.id && t.type==='income').reduce((s,t)=>s+Number(t.amount),0);
                // Income categories have no stored limits. Use relative earned values for a progress visualization.
                const pct = maxEarned > 0 ? Math.min(100, Math.round((earned / maxEarned) * 100)) : 0;

                const li = document.createElement('div');
                li.className = 'py-2 border-bottom';
                li.innerHTML = `
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <div class="fw-medium">${cat.name}</div>
                            <div class="small text-muted">Earned: $${earned.toFixed(2)}</div>
                        </div>
                        <div class="small text-success fw-semibold">Income</div>
                    </div>
                    <div class="w-100 bg-light rounded h-3 mt-2 overflow-hidden">
                        <div class="h-3 bg-success" style="width:${pct}%"></div>
                    </div>
                `;
                // add edit/delete actions for income categories as well
                const actions = document.createElement('div');
                actions.className = 'd-flex align-items-center gap-2 mt-2';
                actions.innerHTML = `<button data-action="edit" data-id="${cat.id}" class="btn btn-link btn-sm text-primary p-0">Edit</button><button data-action="delete" data-id="${cat.id}" class="btn btn-link btn-sm text-danger p-0">Delete</button>`;
                li.appendChild(actions);
                incomeListContainer.appendChild(li);
            });
                expenseList.parentElement.insertBefore(incomeListContainer, expenseList);
                // If there are expense categories, add a clear header for them below the income list
                if(expenseCats.length){
                    const expenseHeader = document.createElement('h3');
                    expenseHeader.className = 'small fw-semibold mt-4';
                    expenseHeader.textContent = 'Expenses';
                    expenseList.parentElement.insertBefore(expenseHeader, expenseList);
                }
                // attach edit/delete handlers for income categories (same logic as expenses)
                incomeListContainer.querySelectorAll('button[data-action]').forEach(btn=>{
                    btn.addEventListener('click', async ()=>{
                        const id = btn.getAttribute('data-id');
                        const action = btn.getAttribute('data-action');
                        if(action === 'delete'){
                            if(confirm('Delete this category? This will not remove transactions.')){
                                const { removeCategory } = await import('../storage.js');
                                await removeCategory(id);
                                const s = await getState(); renderDashboard(s);
                            }
                        } else if(action === 'edit'){
                            const s = await getState();
                            const cat = s.categories.find(c=>c.id===id);
                            if(!cat) return;
                            const html = `
                                <div class="mb-3">
                                    <input id="edit-cat-name" class="form-control mb-2" value="${cat.name}" />
                                    <div class="d-flex gap-2">
                                        <input id="edit-cat-limit" class="form-control flex-grow-1" value="${cat.limit == null ? '' : cat.limit}" />
                                        <select id="edit-cat-type" class="form-select" style="width:10rem"><option value="expense">Expense</option><option value="income">Income</option></select>
                                    </div>
                                </div>
                            `;
                            window.showModal({ title: 'Edit category', html, onSave: async ()=>{
                                const newName = document.getElementById('edit-cat-name').value || cat.name;
                                const newType = document.getElementById('edit-cat-type').value || 'expense';
                                let newLimit;
                                if(newType === 'expense'){
                                    const raw = document.getElementById('edit-cat-limit').value;
                                    newLimit = raw === '' ? 0 : parseFloat(raw);
                                    if(Number.isNaN(newLimit) || newLimit < 0){ alert('Limit must be a number ≥ 0.'); return false; }
                                    const st = await getState();
                                    const baseBudget = Number(st.meta.baseBudget || 0);
                                    if(baseBudget > 0 && newLimit > baseBudget){ alert('Category limit cannot exceed the Base Budget.'); return false; }
                                } else {
                                    newLimit = undefined;
                                }
                                await updateCategory(id, { name: newName, limit: newLimit, type: newType });
                                const s2 = await getState(); renderDashboard(s2);
                                // encourage redistribution if budget not fully assigned
                                try{
                                    const base = Number(s2.meta.baseBudget || 0);
                                    if(base > 0){
                                        const totalAssigned = s2.categories.filter(c=>c.type!=='income').reduce((sum,c)=>sum+Number(c.limit||0),0);
                                        const remaining = Math.max(0, base - totalAssigned);
                                        if(remaining > 0){
                                            await new Promise(res => {
                                                const html2 = `<p class="small">You have $${remaining.toFixed(2)} of your base budget unallocated. Do you want to add it to this category now?</p>`;
                                                window.showModal({ title: 'Unallocated budget', html: html2, saveText: 'Add to this category', onSave: async ()=>{
                                                    const cur = (s2.categories.find(c=>c.id===id)?.limit) || 0;
                                                    await updateCategory(id, { limit: Number(cur) + remaining });
                                                    const s3 = await getState(); renderDashboard(s3);
                                                    res();
                                                }, onCancel: ()=> res() });
                                            });
                                        }
                                    }
                                }catch(e){ /* noop */ }
                            }});
                            // pre-select type and toggle limit input visibility
                            setTimeout(()=>{
                                const typeEl = document.getElementById('edit-cat-type');
                                const limitEl = document.getElementById('edit-cat-limit');
                                if(!typeEl || !limitEl) return;
                                function toggle(){ limitEl.style.display = (typeEl.value === 'income') ? 'none' : 'block'; }
                                typeEl.addEventListener('change', toggle);
                                typeEl.value = cat.type || 'expense';
                                toggle();
                            }, 10);
                        }
                    });
                });
        }

    // show expense categories with bars and remaining balance
    expenseCats.forEach(cat => {
        const spent = state.transactions.filter(t=>t.categoryId===cat.id && t.type==='expense').reduce((s,t)=>s+Number(t.amount),0);
        const limit = (typeof cat.limit === 'number') ? Number(cat.limit) : 0;
        const remaining = Math.max(0, limit - spent);
        const pct = limit > 0 ? Math.min(100, Math.round((spent / limit) * 100)) : 0;
        const li = document.createElement('li');
        li.className = 'py-3';
        li.innerHTML = `
            <div class="d-flex justify-content-between align-items-center">
                <div>
                    <div class="fw-medium">${cat.name}</div>
                        <div class="small text-muted">Spent: $${spent.toFixed(2)} | Remaining: $${remaining.toFixed(2)}</div>
                </div>
                <div class="small">
                        <div class="fw-semibold">$${limit.toFixed(2)} limit</div>
                </div>
            </div>
            <div class="w-100 bg-light rounded mt-2 overflow-hidden" style="height:0.5rem;">
                <div class="h-100 ${pct > 100 ? 'bg-danger' : 'bg-warning'}" style="width:${Math.min(100, pct)}%"></div>
            </div>
        `;
        // add edit/delete buttons for each category
        const actions = document.createElement('div');
        actions.className = 'd-flex align-items-center gap-2 mt-2';
        actions.innerHTML = `<button data-action="edit" data-id="${cat.id}" class="btn btn-link btn-sm text-primary p-0">Edit</button><button data-action="delete" data-id="${cat.id}" class="btn btn-link btn-sm text-danger p-0">Delete</button>`;
        li.appendChild(actions);
        expenseList.appendChild(li);
    });

            // attach edit/delete handlers for categories
        expenseList.querySelectorAll('button[data-action]').forEach(btn=>{
            btn.addEventListener('click', async ()=>{
                const id = btn.getAttribute('data-id');
                const action = btn.getAttribute('data-action');
                if(action === 'delete'){
                    if(confirm('Delete this category? This will not remove transactions.')){
                        const { removeCategory } = await import('../storage.js');
                        await removeCategory(id);
                        const s = await getState(); renderDashboard(s);
                    }
                        } else if(action === 'edit'){
                            const s = await getState();
                            const cat = s.categories.find(c=>c.id===id);
                            if(!cat) return;
                            // show modal edit form
                            const html = `
                                <div class="mb-3">
                                    <input id="edit-cat-name" class="form-control mb-2" value="${cat.name}" />
                                    <div class="d-flex gap-2">
                                        <input id="edit-cat-limit" class="form-control flex-grow-1" value="${cat.limit == null ? '' : cat.limit}" />
                                        <select id="edit-cat-type" class="form-select" style="width:10rem"><option value="expense">Expense</option><option value="income">Income</option></select>
                                    </div>
                                </div>
                            `;
                            window.showModal({ title: 'Edit category', html, onSave: async ()=>{
                                const newName = document.getElementById('edit-cat-name').value || cat.name;
                                const newType = document.getElementById('edit-cat-type').value || 'expense';
                                let newLimit;
                                if(newType === 'expense'){
                                    const raw = document.getElementById('edit-cat-limit').value;
                                    newLimit = raw === '' ? 0 : parseFloat(raw);
                                    if(Number.isNaN(newLimit) || newLimit < 0){ alert('Limit must be a number ≥ 0.'); return false; }
                                } else {
                                    newLimit = undefined;
                                }
                                await updateCategory(id, { name: newName, limit: newLimit, type: newType });
                                const s2 = await getState(); renderDashboard(s2);
                            }});
                            // pre-select type and toggle limit visibility
                            setTimeout(()=>{
                                const typeEl = document.getElementById('edit-cat-type');
                                const limitEl = document.getElementById('edit-cat-limit');
                                if(!typeEl || !limitEl) return;
                                function toggle(){ limitEl.style.display = (typeEl.value === 'income') ? 'none' : 'block'; }
                                typeEl.addEventListener('change', toggle);
                                typeEl.value = cat.type || 'expense';
                                toggle();
                            }, 10);
                }
            });
        });

}

async function showRedistributeModal(remaining, expenseCats){
    if(!expenseCats || expenseCats.length === 0) return;
    const rows = expenseCats.map(c => `
        <div class="d-flex gap-2 align-items-center mb-2">
            <div class="flex-grow-1">${c.name} <div class="small text-muted">current: $${Number(c.limit||0).toFixed(2)}</div></div>
            <div style="width:10rem"><input type="number" min="0" step="0.01" class="form-control alloc-input" data-cat-id="${c.id}" value="0" /></div>
        </div>
    `).join('');

    const html = `<div class="mb-2"><p class="small">Distribute the <strong>$${remaining.toFixed(2)}</strong> remaining across your expense categories. Values must sum to the remaining amount.</p>${rows}<div class="d-flex gap-2 mt-2"><button id="even-dist" class="btn btn-sm btn-outline-secondary">Evenly distribute</button><div class="flex-grow-1"></div><div class="small text-muted">Remaining must be fully allocated to save.</div></div></div>`;

    await new Promise(res=>{
        window.showModal({ title: 'Redistribute unallocated budget', html, saveText: 'Save', onSave: async ()=>{
            const inputs = Array.from(document.querySelectorAll('.alloc-input'));
            let sum = 0;
            const assigns = inputs.map(inp=>{
                const val = parseFloat(inp.value) || 0;
                sum += val;
                return { id: inp.getAttribute('data-cat-id'), val };
            });
            // allow small floating rounding tolerance
            if(Math.abs(sum - remaining) > 0.01){ alert(`Allocated sum $${sum.toFixed(2)} does not equal remaining $${remaining.toFixed(2)}.`); return false; }
            // apply updates: add assigned amounts to existing limits
            for(const a of assigns){
                const cat = expenseCats.find(c=>c.id === a.id);
                if(!cat) continue;
                const newLimit = (Number(cat.limit||0) + Number(a.val || 0));
                await updateCategory(cat.id, { limit: newLimit });
            }
            const s = await getState(); renderDashboard(s);
            res();
        }, onCancel: ()=> res() });

        // even distribute handler
        setTimeout(()=>{
            const evenBtn = document.getElementById('even-dist');
            evenBtn?.addEventListener('click', ()=>{
                const per = Number((remaining / expenseCats.length).toFixed(2));
                document.querySelectorAll('.alloc-input').forEach(i=> i.value = per);
            });
        }, 10);
    });
}