import { getState, addTransaction, addCategory, updateCategory, editTransaction as editTx, deleteTransaction as deleteTx, transferBetweenCategories } from '../storage.js';

// Debug: confirm module load
console.log('transactions.js loaded');

window.initTransactions = async function(){
    await populateCategories();
    await updateBaseMonthLabel();
    attachForm();
    await renderTransactions();
}

async function updateBaseMonthLabel(){
    try{
        const state = await getState();
        const el = document.getElementById('transaction-base-month');
        if(!el) return;
        if(state.meta && state.meta.month){
            try{
                const parts = String(state.meta.month).split('-');
                if(parts.length === 2){
                    const yyyy = Number(parts[0]);
                    const mm = Number(parts[1]);
                    const d = new Date(yyyy, Math.max(0, mm - 1), 1);
                    el.textContent = d.toLocaleString(undefined, { month: 'short', year: 'numeric' });
                } else {
                    el.textContent = state.meta.month;
                }
            }catch(e){ el.textContent = state.meta.month; }
        } else {
            el.textContent = '';
        }
    }catch(e){}
}

async function populateCategories(){
    const state = await getState();
    const sel = document.getElementById('transaction-category');
    if(!sel) return;
    sel.innerHTML = '';
    state.categories.forEach(c=>{
        const opt = document.createElement('option');
        opt.value = c.id; opt.textContent = c.name;
        sel.appendChild(opt);
    });
    // If no categories, show a hint option
    if(state.categories.length === 0){
      const opt = document.createElement('option'); opt.value = '__no_cat__'; opt.textContent = 'No categories — add one'; sel.appendChild(opt);
    }
    // allow quick add category
    const addOpt = document.createElement('option');
    addOpt.value = '__add_new__'; addOpt.textContent = '+ Add new category';
    sel.appendChild(addOpt);
    sel.addEventListener('change', async ()=>{
        if(sel.value === '__add_new__'){
                        // open modal to create category with type and optional limit
                                            const html = `
                                                <div class="mb-2">
                                                    <p class="small">Total expenses would exceed Budget Base by $${excess.toLocaleString(undefined,{minimumFractionDigits:2, maximumFractionDigits:2})}.</p>
                                                    <p class="small text-muted">Current Budget Base: $${baseBudget.toLocaleString(undefined,{minimumFractionDigits:2, maximumFractionDigits:2})} | Current Total Expense: $${totalExpense.toLocaleString(undefined,{minimumFractionDigits:2, maximumFractionDigits:2})}</p>
                                    <input id="new-cat-limit" class="form-control flex-grow-1" placeholder="Limit (for expense)" />
                                    <select id="new-cat-type" class="form-select" style="width:10rem"><option value="expense">Expense</option><option value="income">Income</option></select>
                                </div>
                            </div>
                        `;
                        await new Promise(resolve => {
                                window.showModal({ title: 'Add category', html, saveText: 'Add', onSave: async ()=>{
                                const name = (document.getElementById('new-cat-name').value || '').trim();
                                const type = document.getElementById('new-cat-type').value || 'expense';
                                let limit;
                                if(type === 'expense'){
                                    const limitRaw = document.getElementById('new-cat-limit').value;
                                    limit = limitRaw === '' ? 0 : parseFloat(limitRaw);
                                    if(Number.isNaN(limit) || limit < 0){ alert('Limit must be a number ≥ 0.'); return false; }
                                    const st = await getState();
                                    const baseBudget = Number(st.meta.baseBudget || 0);
                                    if(baseBudget > 0 && limit > baseBudget){ alert('Category limit cannot exceed the Base Budget.'); return false; }
                                } else {
                                    limit = undefined;
                                }
                                if(!name){ alert('Category name is required.'); return false; }
                                const newCat = await addCategory({ name, limit, type });
                                await populateCategories();
                                sel.value = newCat.id;
                                // encourage allocation of remaining budget
                                try{
                                    const s = await getState();
                                    const base = Number(s.meta.baseBudget || 0);
                                    if(base > 0){
                                        const totalAssigned = s.categories.filter(c=>c.type!=='income').reduce((sum,c)=>sum+Number(c.limit||0),0);
                                        const remaining = Math.max(0, base - totalAssigned);
                                            if(remaining > 0){
                                                // Do not show modal here; the transaction form displays an inline warning instead.
                                            }
                                    }
                                }catch(e){}
                                resolve();
                            }, onCancel: ()=> resolve() });
                            // toggle limit input visibility
                            setTimeout(()=>{
                                const typeSel = document.getElementById('new-cat-type');
                                const limitEl = document.getElementById('new-cat-limit');
                                if(!typeSel || !limitEl) return;
                                function toggle(){ limitEl.style.display = (typeSel.value === 'income') ? 'none' : 'block'; }
                                typeSel.addEventListener('change', toggle);
                                toggle();
                            }, 10);
                        });
        }
    });
}

function attachForm(){
    const form = document.getElementById('transaction-form');
    if(!form) return;
        // show inline warning about unallocated base budget when relevant
        const amountEl = document.getElementById('transaction-amount');
        const categoryEl = document.getElementById('transaction-category');
        async function updateUnallocatedWarning(){
            try{
                const st = await getState();
                const base = Number(st.meta.baseBudget || 0);
                const expenseCats = st.categories.filter(c=>c.type !== 'income');
                const totalAssigned = expenseCats.reduce((s,c)=>s + Number(c.limit || 0), 0);
                const remaining = Math.max(0, base - totalAssigned);

                // remove any previous inline warning
                const oldInline = document.getElementById('unallocated-warning');
                if(oldInline) oldInline.remove();

                // show banner only for expense transactions
                const typeEl = document.getElementById('transaction-type');
                const isExpense = typeEl && typeEl.value === 'expense';
                const existingBanner = document.getElementById('unallocated-banner-transactions');

                if(base > 0 && remaining > 0 && isExpense){
                    if(!existingBanner){
                        const container = document.querySelector('.container');
                        const banner = document.createElement('div');
                        banner.id = 'unallocated-banner-transactions';
                        banner.className = 'alert alert-warning d-flex justify-content-between align-items-center';
                        banner.innerHTML = `<div class="small">You have $${remaining.toLocaleString(undefined,{minimumFractionDigits:2, maximumFractionDigits:2})} of your base budget unallocated.</div><div><button id="dismiss-unalloc-tx" class="btn btn-sm btn-secondary">Dismiss</button></div>`;
                        if(container){
                            const firstSection = container.querySelector('section');
                            if(firstSection && firstSection.parentNode) firstSection.parentNode.insertBefore(banner, firstSection);
                            else container.insertBefore(banner, container.firstChild);
                        } else {
                            document.body.insertBefore(banner, document.body.firstChild);
                        }
                        banner.querySelector('#dismiss-unalloc-tx')?.addEventListener('click', ()=> banner.remove());
                    } else {
                        // update text
                        const textDiv = existingBanner.querySelector('div');
                        if(textDiv) textDiv.textContent = `You have $${remaining.toLocaleString(undefined,{minimumFractionDigits:2, maximumFractionDigits:2})} of your base budget unallocated.`;
                    }
                } else {
                    if(existingBanner) existingBanner.remove();
                }
            }catch(e){ /* noop */ }
        }

        // wire input/change events so the banner appears before submit
        amountEl?.addEventListener('input', updateUnallocatedWarning);
        categoryEl?.addEventListener('change', updateUnallocatedWarning);
        document.getElementById('transaction-type')?.addEventListener('change', updateUnallocatedWarning);
        // initial check
        updateUnallocatedWarning();

        // also update the warning immediately when attempting to submit so user sees latest state

        form.addEventListener('submit', async (e)=>{
        // refresh warning right before submit so user sees it (non-blocking)
        try{ await updateUnallocatedWarning(); }catch(e){}
        e.preventDefault();
        const type = document.getElementById('transaction-type').value;
    let categoryId = document.getElementById('transaction-category').value;
        const dayRaw = document.getElementById('transaction-date').value;
    const description = document.getElementById('transaction-desc').value;
    const amountRaw = document.getElementById('transaction-amount').value;
    const amount = amountRaw === '' ? NaN : Number(amountRaw);
    // basic validation
    if(Number.isNaN(amount) || amount <= 0){ window.showModal({ title: 'Invalid amount', html: '<p class="small">Please enter an amount greater than 0.</p>', saveText: 'OK', onSave: ()=>{} }); return; }
    // day-only input: combine with base month/year from app state
    const day = parseInt(dayRaw, 10);
    if(Number.isNaN(day) || day < 1 || day > 31){ window.showModal({ title: 'Invalid date', html: '<p class="small">Please enter a valid day (1-31).</p>', saveText: 'OK', onSave: ()=>{} }); return; }
    const currentStateForDate = await getState();
    const baseMonth = currentStateForDate.meta && currentStateForDate.meta.month ? currentStateForDate.meta.month : (new Date()).toISOString().slice(0,7);
    const dayPadded = String(day).padStart(2, '0');
    const date = `${baseMonth}-${dayPadded}`;
                if(!categoryId || categoryId === '__no_cat__'){
                    // ask user to create a category first
                    await new Promise(resolve => {
                        const html = `<div class="mb-2"><p class="small">No categories yet. Create one now.</p></div>`;
                        window.showModal({ title: 'Create category', html, saveText: 'Create', onSave: async ()=>{
                            // open the add category modal
                            const addHtml = `
                                <div class="mb-3">
                                    <input id="new-cat-name" class="form-control mb-2" placeholder="Category name" />
                                    <div class="d-flex gap-2">
                                        <input id="new-cat-limit" class="form-control flex-grow-1" placeholder="Limit (for expense)" />
                                        <select id="new-cat-type" class="form-select" style="width:10rem"><option value="expense">Expense</option><option value="income">Income</option></select>
                                    </div>
                                </div>`;
                            await new Promise(res2 => {
                                window.showModal({ title: 'Add category', html: addHtml, saveText: 'Add', onSave: async ()=>{
                                    const name = document.getElementById('new-cat-name').value || 'Unnamed';
                                    const type = document.getElementById('new-cat-type').value || 'expense';
                                    let limit;
                                    if(type === 'expense'){
                                        const raw = document.getElementById('new-cat-limit').value;
                                        limit = raw === '' ? 0 : parseFloat(raw);
                                        if(Number.isNaN(limit) || limit < 0){ alert('Limit must be a number ≥ 0.'); return false; }
                                        const st = await getState();
                                        const baseBudget = Number(st.meta.baseBudget || 0);
                                        if(baseBudget > 0 && limit > baseBudget){ alert('Category limit cannot exceed the Base Budget.'); return false; }
                                    } else {
                                        limit = undefined;
                                    }
                                    const newCat = await addCategory({ name, limit, type });
                                    await populateCategories();
                                    categoryId = newCat.id;
                                    // encourage allocation of remaining budget
                                    try{
                                        const s = await getState();
                                        const base = Number(s.meta.baseBudget || 0);
                                        if(base > 0){
                                            const totalAssigned = s.categories.filter(c=>c.type!=='income').reduce((sum,c)=>sum+Number(c.limit||0),0);
                                            const remaining = Math.max(0, base - totalAssigned);
                                            if(remaining > 0){
                                                // Do not show modal here; the transaction form displays an inline warning instead.
                                            }
                                        }
                                    }catch(e){}
                                    res2();
                                }, onCancel: ()=> res2() });
                                // toggle limit in nested modal
                                setTimeout(()=>{
                                    const typeSel = document.getElementById('new-cat-type');
                                    const limitEl = document.getElementById('new-cat-limit');
                                    if(!typeSel || !limitEl) return;
                                    function toggle(){ limitEl.style.display = (typeSel.value === 'income') ? 'none' : 'block'; }
                                    typeSel.addEventListener('change', toggle);
                                    toggle();
                                }, 10);
                            });
                            resolve();
                        }, onCancel: ()=> resolve() });
                    });
                }
                if(!categoryId){ window.showModal({ title: 'Missing category', html: '<p class="small">Please choose or create a category.</p>', saveText: 'OK', onSave: ()=>{} }); return; }
            // Check category limit for expense and budget base overflow
            if(type === 'expense'){
                const state = await getState();
                const cat = state.categories.find(c=>c.id===categoryId);
                const spent = state.transactions.filter(t=>t.categoryId===categoryId && t.type==='expense').reduce((s,t)=>s+Number(t.amount),0);
                const wouldBe = spent + amount;
                // If this would exceed category limit, prompt user for actions
                if(cat && typeof cat.limit === 'number' && wouldBe > cat.limit){
                    const s = await getState();
                    // compute available amounts for other expense categories
                    const otherCats = s.categories
                        .filter(c => c.id !== cat.id && c.type !== 'income')
                        .map(c => {
                            const limit = (typeof c.limit === 'number') ? Number(c.limit) : 0;
                            const spent = s.transactions.filter(t => t.categoryId === c.id && t.type === 'expense').reduce((ss, t) => ss + Number(t.amount), 0);
                            const available = Math.max(0, limit - spent);
                            return { ...c, limit, spent, available };
                        });
                    const optionsHtml = `
                        <div class="mb-2">
                            <p class="small">Category <strong>${cat.name}</strong> limit: $${Number(cat.limit).toLocaleString(undefined,{minimumFractionDigits:2, maximumFractionDigits:2})}. This transaction would make spent $${wouldBe.toLocaleString(undefined,{minimumFractionDigits:2, maximumFractionDigits:2})}.</p>
                            <div>
                                <label class="form-label small">Choose action</label>
                                <select id="transfer-action" class="form-select">
                                    <option value="transfer">Transfer from another category</option>
                                    <option value="increase">Increase base budget</option>
                                    <option value="cancel">Cancel</option>
                                </select>
                            </div>
                            <div id="transfer-extra" class="mt-2"></div>
                        </div>
                    `;

                    let cancelled = false;
                    await new Promise(resolve => {
                        window.showModal({ title: 'Category limit exceeded', html: optionsHtml, saveText: 'Proceed', onSave: async ()=>{
                            const action = document.getElementById('transfer-action').value;
                            if(action === 'cancel'){ cancelled = true; resolve(); return; }
                            if(action === 'increase'){
                                const inc = parseFloat(document.getElementById('transfer-extra-input')?.value) || 0;
                                if(inc > 0){ const st = await getState(); st.meta.baseBudget = (Number(st.meta.baseBudget)||0) + inc; await import('../storage.js').then(m=>m.saveState(st)); }
                            } else if(action === 'transfer'){
                                const sourceId = document.getElementById('transfer-source')?.value;
                                const transferAmt = parseFloat(document.getElementById('transfer-extra-input')?.value) || 0;
                                // validate transfer amount
                                if(!sourceId || transferAmt <= 0){ alert('Please select a source category and provide an amount > 0.'); return false; }
                                const st2 = await getState();
                                const src = st2.categories.find(c=>c.id===sourceId);
                                if(!src){ alert('Selected source category not found.'); return false; }
                                const srcLimit = (typeof src.limit === 'number') ? Number(src.limit) : 0;
                                const srcSpent = st2.transactions.filter(t => t.categoryId === sourceId && t.type === 'expense').reduce((ss, t) => ss + Number(t.amount), 0);
                                const srcAvailable = Math.max(0, srcLimit - srcSpent);
                                if(srcAvailable < transferAmt){ alert('Source category does not have sufficient available funds to transfer.'); return false; }
                                try{ await transferBetweenCategories(sourceId, categoryId, transferAmt); }catch(err){ alert('Transfer failed: '+err.message); return false; }
                            }
                            resolve();
                        }, onCancel: ()=>{ cancelled = true; resolve(); } });

                        // dynamic extra inputs
                        const actionEl = document.getElementById('transfer-action');
                        const extra = document.getElementById('transfer-extra');
                        function renderExtra(){
                            const val = actionEl.value;
                            if(val === 'transfer'){
                                // build options showing available funds; disable options with 0 available
                                const opts = otherCats.map(c => `<option value="${c.id}" ${c.available<=0? 'disabled':''}>${c.name} (available $${c.available.toLocaleString(undefined,{minimumFractionDigits:2, maximumFractionDigits:2})})</option>`).join('');
                                const firstAvailable = otherCats.find(c => c.available > 0);
                                const defaultAmt = firstAvailable ? Math.min(firstAvailable.available, amount) : amount;
                                extra.innerHTML = `<label class="form-label small">Source category</label><select id="transfer-source" class="form-select">${opts}</select><label class="form-label small mt-2">Amount to transfer</label><input id="transfer-extra-input" type="number" class="form-control" value="${defaultAmt}" />`;
                                // auto-select first valid donor if present
                                setTimeout(()=>{
                                    const sel = document.getElementById('transfer-source');
                                    if(!sel) return;
                                    if(firstAvailable){ sel.value = firstAvailable.id; }
                                }, 10);
                            } else if(val === 'increase'){
                                extra.innerHTML = `<label class="form-label small">Increase base by</label><input id="transfer-extra-input" type="number" class="form-control" value="${amount}" />`;
                            } else { extra.innerHTML = '' }
                        }
                        actionEl.addEventListener('change', renderExtra);
                        renderExtra();
                    });

                    if(cancelled) return; // abort the transaction entirely
                }

                // Check if total expenses would exceed budget base
                const state2 = await getState();
                const totalExpense = state2.transactions.filter(t=>t.type==='expense').reduce((s,t)=>s+Number(t.amount),0);
                const baseBudget = Number(state2.meta.baseBudget || 0);
                const wouldExceedBase = (totalExpense + amount) > baseBudget;

                if(baseBudget > 0 && wouldExceedBase){
                    const excess = (totalExpense + amount) - baseBudget;
                    const html = `
                        <div class="mb-2">
                            <p class="small">Total expenses would exceed Budget Base by $${excess.toLocaleString(undefined,{minimumFractionDigits:2, maximumFractionDigits:2})}.</p>
                            <p class="small text-muted">Current Budget Base: $${baseBudget.toLocaleString(undefined,{minimumFractionDigits:2, maximumFractionDigits:2})} | Current Total Expense: $${totalExpense.toLocaleString(undefined,{minimumFractionDigits:2, maximumFractionDigits:2})}</p>
                            <div>
                                <label class="form-label small">Do you want to increase Budget Base or cancel?</label>
                                <select id="base-action" class="form-select">
                                    <option value="increase">Increase base budget</option>
                                    <option value="cancel">Cancel this transaction</option>
                                </select>
                            </div>
                            <div id="base-extra" class="mt-2"></div>
                        </div>
                    `;

                    let cancelledBase = false;
                    await new Promise(resolve => {
                        window.showModal({ title: 'Budget Base would be exceeded', html, saveText: 'Proceed', onSave: async ()=>{
                            const action = document.getElementById('base-action').value;
                            if(action === 'cancel'){ cancelledBase = true; resolve(); return; }
                            if(action === 'increase'){
                                const inc = parseFloat(document.getElementById('base-extra-input')?.value) || 0;
                                if(inc>0){ const st = await getState(); st.meta.baseBudget = (Number(st.meta.baseBudget)||0) + inc; await import('../storage.js').then(m=>m.saveState(st)); }
                            }
                            resolve();
                        }, onCancel: ()=>{ cancelledBase = true; resolve(); } });

                        const actionEl = document.getElementById('base-action');
                        const extra = document.getElementById('base-extra');
                        function renderExtra(){
                            if(actionEl.value === 'increase'){
                                extra.innerHTML = `<label class="form-label small">Increase base by</label><input id="base-extra-input" type="number" class="form-control" value="${excess.toLocaleString(undefined,{minimumFractionDigits:2, maximumFractionDigits:2})}" />`;
                            } else { extra.innerHTML = '' }
                        }
                        actionEl.addEventListener('change', renderExtra);
                        renderExtra();
                    });

                    if(cancelledBase) return; // abort the transaction
                }
            }

            const tx = await addTransaction({ date, amount, categoryId, type, description });
            form.reset();
            await populateCategories();
            await renderTransactions();
}
    );

    const clearBtn = document.getElementById('clear-form');
    if(clearBtn) clearBtn.addEventListener('click', ()=> form.reset());
}

async function renderTransactions(){
    const state = await getState();
    const list = document.getElementById('transactions');
    list.innerHTML = '';
    // Only show transactions that match the base month/year
    let txs = Array.isArray(state.transactions) ? state.transactions.slice() : [];
    if(state.meta && state.meta.month){
        txs = txs.filter(t => typeof t.date === 'string' && t.date.startsWith(state.meta.month + '-'));
    }
    txs.reverse().forEach(t=>{
        const li = document.createElement('li');
        li.className = 'd-flex align-items-center justify-content-between p-2 border-bottom';
        const cat = state.categories.find(c=>c.id===t.categoryId);
        // format date as dd-mm-yyyy using global helper
        const prettyDate = window.formatDate(t.date);
        li.innerHTML = `<div><div class="small">${prettyDate} • ${t.description || ''}</div><div class="small text-muted">${cat?cat.name:'Uncategorized'}</div></div><div class="d-flex align-items-center gap-2"><div class="fw-semibold ${t.type==='income'?'text-success':'text-danger'}">${t.type==='income'?'+':'-'}$${Number(t.amount).toLocaleString(undefined,{minimumFractionDigits:2, maximumFractionDigits:2})}</div><button data-id="${t.id}" class="btn btn-link btn-sm p-0 text-primary edit-btn">Edit</button><button data-id="${t.id}" class="btn btn-link btn-sm p-0 text-danger delete-btn">Delete</button></div>`;
        list.appendChild(li);
    });

    // attach delete handlers
        list.querySelectorAll('.delete-btn').forEach(btn=>{
            btn.addEventListener('click', async ()=>{
                const id = btn.getAttribute('data-id');
                if(confirm('Delete this transaction?')){
                    await deleteTx(id);
                    await renderTransactions();
                }
            });
        });

        list.querySelectorAll('.edit-btn').forEach(btn=>{
            btn.addEventListener('click', async ()=>{
                const id = btn.getAttribute('data-id');
                const state = await getState();
                const t = state.transactions.find(x=>x.id===id);
                if(!t) return;
                            // Edit transaction via modal
                            const dayVal = (t.date && t.date.split('-')[2]) ? parseInt(t.date.split('-')[2],10) : '';
                            const baseMonthLabel = (state.meta && state.meta.month) ? (()=>{ try{ const parts = String(state.meta.month).split('-'); if(parts.length === 2){ const yyyy = Number(parts[0]); const mm = Number(parts[1]); const d = new Date(yyyy, Math.max(0, mm - 1), 1); return d.toLocaleString(undefined,{ month: 'short', year: 'numeric' }); } return state.meta.month; }catch(e){ return state.meta.month; } })() : '';
                            const html = `
                                <div class="mb-3">
                                    <input id="edit-t-amount" class="form-control mb-2" value="${t.amount}" />
                                    <input id="edit-t-desc" class="form-control mb-2" value="${t.description||''}" />
                                    <div class="d-flex gap-2 align-items-center">
                                        <input id="edit-t-day" type="number" min="1" max="31" class="form-control" style="max-width:8rem" value="${dayVal}" />
                                        <div class="small text-muted">Base: <span id="edit-base-month">${baseMonthLabel}</span></div>
                                    </div>
                                </div>
                            `;
                            await new Promise(resolve => {
                                window.showModal({ title: 'Edit transaction', html, saveText: 'Save', onSave: async ()=>{
                                    const newAmtRaw = document.getElementById('edit-t-amount').value;
                                    const newAmt = newAmtRaw === '' ? NaN : parseFloat(newAmtRaw);
                                    const newDesc = document.getElementById('edit-t-desc').value || t.description;
                                    const newDayRaw = document.getElementById('edit-t-day').value;
                                    const newDay = parseInt(newDayRaw, 10);
                                    if(Number.isNaN(newDay) || newDay < 1 || newDay > 31){ alert('Please enter a valid day (1-31).'); return false; }
                                    const stForDate = await getState();
                                    const baseMonthForEdit = stForDate.meta && stForDate.meta.month ? stForDate.meta.month : (new Date()).toISOString().slice(0,7);
                                    const newDate = `${baseMonthForEdit}-${String(newDay).padStart(2,'0')}`;
                                    if(Number.isNaN(newAmt) || newAmt <= 0){ alert('Amount must be a number greater than 0.'); return false; }
                                    if(!newDate){ alert('Please choose a date.'); return false; }

                                    // If this is an expense, validate against category limits and Budget Base
                                    if(t.type === 'expense'){
                                        const st = await getState();
                                        const cat = st.categories.find(c=>c.id===t.categoryId);
                                        const spentExcluding = st.transactions.filter(x=>x.categoryId===t.categoryId && x.type==='expense' && x.id !== id).reduce((s,x)=>s+Number(x.amount),0);
                                        const wouldBe = spentExcluding + newAmt;

                                        // If this would exceed category limit, prompt user to transfer/increase/cancel
                                        if(cat && typeof cat.limit === 'number' && wouldBe > cat.limit){
                                            const otherCats = st.categories
                                                .filter(c => c.id !== cat.id && c.type !== 'income')
                                                .map(c => {
                                                    const limit = (typeof c.limit === 'number') ? Number(c.limit) : 0;
                                                    const spent = st.transactions.filter(t2 => t2.categoryId === c.id && t2.type === 'expense').reduce((ss, t2) => ss + Number(t2.amount), 0);
                                                    const available = Math.max(0, limit - spent);
                                                    return { ...c, limit, spent, available };
                                                });

                                            const optionsHtml = `
                                        <div class="mb-2">
                                            <p class="small">Category <strong>${cat.name}</strong> limit: $${Number(cat.limit).toLocaleString(undefined,{minimumFractionDigits:2, maximumFractionDigits:2})}. This change would make spent $${wouldBe.toLocaleString(undefined,{minimumFractionDigits:2, maximumFractionDigits:2})}.</p>
                                                    <div>
                                                        <label class="form-label small">Choose action</label>
                                                        <select id="transfer-action" class="form-select">
                                                            <option value="transfer">Transfer from another category</option>
                                                            <option value="increase">Increase base budget</option>
                                                            <option value="cancel">Cancel</option>
                                                        </select>
                                                    </div>
                                                    <div id="transfer-extra" class="mt-2"></div>
                                                </div>
                                            `;

                                            let cancelled = false;
                                            await new Promise(res => {
                                                window.showModal({ title: 'Category limit exceeded', html: optionsHtml, saveText: 'Proceed', onSave: async ()=>{
                                                    const action = document.getElementById('transfer-action').value;
                                                    if(action === 'cancel'){ cancelled = true; res(); return; }
                                                    if(action === 'increase'){
                                                        const inc = parseFloat(document.getElementById('transfer-extra-input')?.value) || 0;
                                                        if(inc > 0){ const sst = await getState(); sst.meta.baseBudget = (Number(sst.meta.baseBudget)||0) + inc; await import('../storage.js').then(m=>m.saveState(sst)); }
                                                    } else if(action === 'transfer'){
                                                        const sourceId = document.getElementById('transfer-source')?.value;
                                                        const transferAmt = parseFloat(document.getElementById('transfer-extra-input')?.value) || 0;
                                                        if(!sourceId || transferAmt <= 0){ alert('Please select a source category and provide an amount > 0.'); return false; }
                                                        const src = (await getState()).categories.find(c=>c.id===sourceId);
                                                        if(!src){ alert('Selected source category not found.'); return false; }
                                                        const srcLimit = (typeof src.limit === 'number') ? Number(src.limit) : 0;
                                                        const srcSpent = (await getState()).transactions.filter(t2 => t2.categoryId === sourceId && t2.type === 'expense').reduce((ss, t2) => ss + Number(t2.amount), 0);
                                                        const srcAvailable = Math.max(0, srcLimit - srcSpent);
                                                        if(srcAvailable < transferAmt){ alert('Source category does not have sufficient available funds to transfer.'); return false; }
                                                        try{ await transferBetweenCategories(sourceId, cat.id, transferAmt); }catch(err){ alert('Transfer failed: '+err.message); return false; }
                                                    }
                                                    res();
                                                }, onCancel: ()=>{ cancelled = true; res(); } });

                                                const actionEl = document.getElementById('transfer-action');
                                                const extra = document.getElementById('transfer-extra');
                                                function renderExtra(){
                                                    const val = actionEl.value;
                                                    if(val === 'transfer'){
                                                        const opts = otherCats.map(c => `<option value="${c.id}" ${c.available<=0? 'disabled':''}>${c.name} (available $${c.available.toLocaleString(undefined,{minimumFractionDigits:2, maximumFractionDigits:2})})</option>`).join('');
                                                        const firstAvailable = otherCats.find(c => c.available > 0);
                                                        const defaultAmt = firstAvailable ? Math.min(firstAvailable.available, newAmt) : newAmt;
                                                        extra.innerHTML = `<label class="form-label small">Source category</label><select id="transfer-source" class="form-select">${opts}</select><label class="form-label small mt-2">Amount to transfer</label><input id="transfer-extra-input" type="number" class="form-control" value="${defaultAmt}" />`;
                                                        setTimeout(()=>{
                                                            const sel = document.getElementById('transfer-source');
                                                            if(!sel) return;
                                                            if(firstAvailable){ sel.value = firstAvailable.id; }
                                                        }, 10);
                                                    } else if(val === 'increase'){
                                                        extra.innerHTML = `<label class="form-label small">Increase base by</label><input id="transfer-extra-input" type="number" class="form-control" value="${(wouldBe - cat.limit).toLocaleString(undefined,{minimumFractionDigits:2, maximumFractionDigits:2})}" />`;
                                                    } else { extra.innerHTML = '' }
                                                }
                                                actionEl.addEventListener('change', renderExtra);
                                                renderExtra();
                                            });

                                            if(cancelled) return false; // abort edit
                                        }

                                        // Check if total expenses would exceed budget base (excluding this transaction)
                                        const totalExcluding = st.transactions.filter(tx=>tx.type==='expense' && tx.id !== id).reduce((s,tx)=>s+Number(tx.amount),0);
                                        const baseBudget = Number(st.meta.baseBudget || 0);
                                        if(baseBudget > 0 && (totalExcluding + newAmt) > baseBudget){
                                            const excess = (totalExcluding + newAmt) - baseBudget;
                                            const html = `
                                                <div class="mb-2">
                                                    <p class="small">Total expenses would exceed Budget Base by $${excess.toLocaleString(undefined,{minimumFractionDigits:2, maximumFractionDigits:2})}.</p>
                                                    <p class="small text-muted">Current Budget Base: $${baseBudget.toLocaleString(undefined,{minimumFractionDigits:2, maximumFractionDigits:2})} | Current Total Expense: $${totalExcluding.toLocaleString(undefined,{minimumFractionDigits:2, maximumFractionDigits:2})}</p>
                                                    <div>
                                                        <label class="form-label small">Do you want to increase Budget Base or cancel?</label>
                                                        <select id="base-action" class="form-select">
                                                            <option value="increase">Increase base budget</option>
                                                            <option value="cancel">Cancel this change</option>
                                                        </select>
                                                    </div>
                                                    <div id="base-extra" class="mt-2"></div>
                                                </div>
                                            `;

                                            let cancelledBase = false;
                                            await new Promise(res => {
                                                window.showModal({ title: 'Budget Base would be exceeded', html, saveText: 'Proceed', onSave: async ()=>{
                                                    const action = document.getElementById('base-action').value;
                                                    if(action === 'cancel'){ cancelledBase = true; res(); return; }
                                                    if(action === 'increase'){
                                                        const inc = parseFloat(document.getElementById('base-extra-input')?.value) || 0;
                                                        if(inc>0){ const sst = await getState(); sst.meta.baseBudget = (Number(sst.meta.baseBudget)||0) + inc; await import('../storage.js').then(m=>m.saveState(sst)); }
                                                    }
                                                    res();
                                                }, onCancel: ()=>{ cancelledBase = true; res(); } });

                                                const actionEl = document.getElementById('base-action');
                                                const extra = document.getElementById('base-extra');
                                                function renderExtra(){
                                                    if(actionEl.value === 'increase'){
                                                        extra.innerHTML = `<label class="form-label small">Increase base by</label><input id="base-extra-input" type="number" class="form-control" value="${excess.toFixed(2)}" />`;
                                                    } else { extra.innerHTML = '' }
                                                }
                                                actionEl.addEventListener('change', renderExtra);
                                                renderExtra();
                                            });

                                            if(cancelledBase) return false; // abort edit
                                        }
                                    }

                                    // All validations passed — save the edited transaction
                                    await editTx(id, { amount: newAmt, description: newDesc, date: newDate });
                                    await renderTransactions();
                                    resolve();
                                }, onCancel: ()=> resolve() });
                            });
            });
        });
}