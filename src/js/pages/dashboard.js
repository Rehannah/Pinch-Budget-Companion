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
            <input id="modal-base" type="number" step="0.01" class="form-control" value="${Number(state.meta.baseBudget || 0).toFixed(2)}" />
        </div>
    `;
    window.showModal({ title: 'Edit Budget Base', html, saveText: 'Save', onSave: async ()=>{
        const newBase = parseFloat(document.getElementById('modal-base').value);
        if(Number.isNaN(newBase) || newBase < 0){ alert('Budget must be a number ≥ 0.'); return false; }
        const { saveState } = await import('../storage.js');
        state.meta.baseBudget = newBase;
        await saveState(state);
        const s = await getState();
        renderDashboard(s);
    }});
}

async function showEditMonthModal(state){
    const html = `
        <div class="mb-3">
            <label class="form-label small">Month (YYYY-MM)</label>
            <input id="modal-month" type="text" class="form-control" placeholder="e.g. 2025-11" value="${state.meta.month || ''}" />
        </div>
    `;
    window.showModal({ title: 'Edit Month', html, saveText: 'Save', onSave: async ()=>{
        const newMonth = document.getElementById('modal-month').value.trim();
        const monthRegex = /^\d{4}-\d{2}$/;
        if(!newMonth || !monthRegex.test(newMonth)){ alert('Month must be in YYYY-MM format.'); return false; }
        const { saveState } = await import('../storage.js');
        state.meta.month = newMonth;
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
            } else {
                limit = undefined;
            }
            await addCategory({ name, limit, type });
            const s = await getState(); renderDashboard(s);
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
                const d = new Date(state.meta.month + '-01');
                monthLabel = d.toLocaleString(undefined, { month: 'long', year: 'numeric' });
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
            const header = document.createElement('h4'); header.className = 'small fw-semibold'; header.textContent = 'Income';
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
                    const expenseHeader = document.createElement('h4');
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
                                } else {
                                    newLimit = undefined;
                                }
                                await updateCategory(id, { name: newName, limit: newLimit, type: newType });
                                const s2 = await getState(); renderDashboard(s2);
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