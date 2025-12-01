import { getState, addTransaction, addCategory, editTransaction as editTx, deleteTransaction as deleteTx, transferBetweenCategories } from '../storage.js';

window.initTransactions = async function(){
    await populateCategories();
    attachForm();
    await renderTransactions();
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
                            <div class="mb-3">
                                <input id="new-cat-name" class="form-control mb-2" placeholder="Category name" />
                                <div class="d-flex gap-2">
                                    <input id="new-cat-limit" class="form-control flex-grow-1" placeholder="Limit (for expense)" />
                                    <select id="new-cat-type" class="form-select" style="width:10rem"><option value="expense">Expense</option><option value="income">Income</option></select>
                                </div>
                            </div>
                        `;
                        await new Promise(resolve => {
                            window.showModal({ title: 'Add category', html, saveText: 'Add', onSave: async ()=>{
                                const name = (document.getElementById('new-cat-name').value || '').trim();
                                const limitRaw = document.getElementById('new-cat-limit').value;
                                const limit = limitRaw === '' ? NaN : parseFloat(limitRaw);
                                const type = document.getElementById('new-cat-type').value || 'expense';
                                // validation: name required, limit must be number >= 0 for expense
                                if(!name){ alert('Category name is required.'); return false; }
                                if(type === 'expense' && (Number.isNaN(limit) || limit < 0)){ alert('Limit must be a number ≥ 0.'); return false; }
                                const newCat = await addCategory({ name, limit: Number(isNaN(limit)?0:limit), type });
                                await populateCategories();
                                sel.value = newCat.id;
                                resolve();
                            }, onCancel: ()=> resolve() });
                        });
        }
    });
}

function attachForm(){
    const form = document.getElementById('transaction-form');
    if(!form) return;
        form.addEventListener('submit', async (e)=>{
        e.preventDefault();
        const type = document.getElementById('transaction-type').value;
    let categoryId = document.getElementById('transaction-category').value;
        const date = document.getElementById('transaction-date').value;
    const description = document.getElementById('transaction-desc').value;
    const amountRaw = document.getElementById('transaction-amount').value;
    const amount = amountRaw === '' ? NaN : Number(amountRaw);
    // basic validation
    if(Number.isNaN(amount) || amount <= 0){ window.showModal({ title: 'Invalid amount', html: '<p class="small">Please enter an amount greater than 0.</p>', saveText: 'OK', onSave: ()=>{} }); return; }
    if(!date){ window.showModal({ title: 'Invalid date', html: '<p class="small">Please choose a date for the transaction.</p>', saveText: 'OK', onSave: ()=>{} }); return; }
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
                                    const limit = parseFloat(document.getElementById('new-cat-limit').value) || 0;
                                    const type = document.getElementById('new-cat-type').value || 'expense';
                                    const newCat = await addCategory({ name, limit, type });
                                    await populateCategories();
                                    categoryId = newCat.id;
                                    res2();
                                }, onCancel: ()=> res2() });
                            });
                            resolve();
                        }, onCancel: ()=> resolve() });
                    });
                }
                if(!categoryId){ window.showModal({ title: 'Missing category', html: '<p class="small">Please choose or create a category.</p>', saveText: 'OK', onSave: ()=>{} }); return; }
            // Check category limit for expense
            if(type==='expense'){
                const state = await getState();
                const cat = state.categories.find(c=>c.id===categoryId);
                const spent = state.transactions.filter(t=>t.categoryId===categoryId && t.type==='expense').reduce((s,t)=>s+Number(t.amount),0);
                const wouldBe = spent + amount;
                        if(cat && typeof cat.limit === 'number' && wouldBe > cat.limit){
                            // show a modal to allow transfer or increase
                            const s = await getState();
                            const otherCats = s.categories.filter(c=>c.id !== cat.id && c.type!=='income');
                            const optionsHtml = `
                                <div class="mb-2">
                                    <p class="small">Category <strong>${cat.name}</strong> limit: $${cat.limit}. This transaction would make spent $${wouldBe.toFixed(2)}.</p>
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
                            await new Promise(resolve => {
                                window.showModal({ title: 'Category limit exceeded', html: optionsHtml, saveText: 'Proceed', onSave: async ()=>{
                                    const action = document.getElementById('transfer-action').value;
                                    if(action === 'cancel'){ resolve(); return; }
                                    if(action === 'increase'){
                                        const inc = parseFloat(document.getElementById('transfer-extra-input')?.value) || 0;
                                        if(inc>0){ const st = await getState(); st.meta.baseBudget = (Number(st.meta.baseBudget)||0) + inc; await import('../storage.js').then(m=>m.saveState(st)); }
                                    } else if(action === 'transfer'){
                                        const sourceId = document.getElementById('transfer-source').value;
                                        const transferAmt = parseFloat(document.getElementById('transfer-extra-input').value) || 0;
                                        try{ await transferBetweenCategories(sourceId, categoryId, transferAmt); }catch(err){ alert('Transfer failed: '+err.message); }
                                    }
                                    resolve();
                                }, onCancel: ()=> resolve() });

                                // dynamic extra inputs
                                const actionEl = document.getElementById('transfer-action');
                                const extra = document.getElementById('transfer-extra');
                                function renderExtra(){
                                    const val = actionEl.value;
                                    if(val === 'transfer'){
                                        extra.innerHTML = `<label class="form-label small">Source category</label><select id="transfer-source" class="form-select">${otherCats.map(c=>`<option value="${c.id}">${c.name} (limit ${c.limit})</option>`).join('')}</select><label class="form-label small mt-2">Amount to transfer</label><input id="transfer-extra-input" type="number" class="form-control" value="${Math.min(cat.limit, amount)}" />`;
                                    } else if(val === 'increase'){
                                        extra.innerHTML = `<label class="form-label small">Increase base by</label><input id="transfer-extra-input" type="number" class="form-control" value="${amount}" />`;
                                    } else { extra.innerHTML = '' }
                                }
                                actionEl.addEventListener('change', renderExtra);
                                renderExtra();
                            });
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
                            <p class="small">Total expenses would exceed Budget Base by $${excess.toFixed(2)}.</p>
                            <p class="small text-muted">Current Budget Base: $${baseBudget.toFixed(2)} | Current Total Expense: $${totalExpense.toFixed(2)}</p>
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
                    await new Promise(resolve => {
                        window.showModal({ title: 'Budget Base would be exceeded', html, saveText: 'Proceed', onSave: async ()=>{
                            const action = document.getElementById('base-action').value;
                            if(action === 'cancel'){ resolve(); return; }
                            if(action === 'increase'){
                                const inc = parseFloat(document.getElementById('base-extra-input')?.value) || 0;
                                if(inc>0){ const st = await getState(); st.meta.baseBudget = (Number(st.meta.baseBudget)||0) + inc; await import('../storage.js').then(m=>m.saveState(st)); }
                            }
                            resolve();
                        }, onCancel: ()=> resolve() });
                        
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
    state.transactions.slice().reverse().forEach(t=>{
        const li = document.createElement('li');
        li.className = 'd-flex align-items-center justify-content-between p-2 border-bottom';
        const cat = state.categories.find(c=>c.id===t.categoryId);
        // format date as dd-mm-yyyy using global helper
        const prettyDate = window.formatDate(t.date);
        li.innerHTML = `<div><div class="small">${prettyDate} • ${t.description || ''}</div><div class="small text-muted">${cat?cat.name:'Uncategorized'}</div></div><div class="d-flex align-items-center gap-2"><div class="fw-semibold ${t.type==='income'?'text-success':'text-danger'}">${t.type==='income'?'+':'-'}$${Number(t.amount).toFixed(2)}</div><button data-id="${t.id}" class="btn btn-link btn-sm p-0 text-primary edit-btn">Edit</button><button data-id="${t.id}" class="btn btn-link btn-sm p-0 text-danger delete-btn">Delete</button></div>`;
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
                            const html = `
                                <div class="mb-3">
                                    <input id="edit-t-amount" class="form-control mb-2" value="${t.amount}" />
                                    <input id="edit-t-desc" class="form-control mb-2" value="${t.description||''}" />
                                    <input id="edit-t-date" type="date" class="form-control" value="${t.date||''}" />
                                </div>
                            `;
                            await new Promise(resolve => {
                                window.showModal({ title: 'Edit transaction', html, saveText: 'Save', onSave: async ()=>{
                                    const newAmtRaw = document.getElementById('edit-t-amount').value;
                                    const newAmt = newAmtRaw === '' ? NaN : parseFloat(newAmtRaw);
                                    const newDesc = document.getElementById('edit-t-desc').value || t.description;
                                    const newDate = document.getElementById('edit-t-date').value || t.date;
                                    if(Number.isNaN(newAmt) || newAmt <= 0){ alert('Amount must be a number greater than 0.'); return false; }
                                    if(!newDate){ alert('Please choose a date.'); return false; }
                                    await editTx(id, { amount: newAmt, description: newDesc, date: newDate });
                                    await renderTransactions();
                                    resolve();
                                }, onCancel: ()=> resolve() });
                            });
            });
        });
}