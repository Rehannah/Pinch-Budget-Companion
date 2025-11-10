import { getState, addCategory } from '../storage.js';

// Dashboard page initializer — exposes global initDashboard for app.js to call.
window.initDashboard = async function() {
    const state = await getState();
    renderDashboard(state);
    attachHandlers();
}

function attachHandlers(){
    const addBtn = document.getElementById('add-category-btn');
    const quickAdd = document.getElementById('quick-add');

    if(addBtn){
                addBtn.addEventListener('click', () => showAddCategoryModal());
    }
    if(quickAdd){
        quickAdd.addEventListener('click', () => alert('Quick add: choose a JSON file in Settings to import categories.'));
    }
}

async function showAddCategoryModal(){
    // use global showModal from app.js
    const html = `
        <div class="space-y-2">
            <input id="modal-cat-name" class="w-full p-2 border rounded" placeholder="Category name" />
            <div class="flex gap-2">
                <input id="modal-cat-limit" class="flex-1 p-2 border rounded" placeholder="Limit (for expense)" />
                <select id="modal-cat-type" class="p-2 border rounded w-40"><option value="expense">Expense</option><option value="income">Income</option></select>
            </div>
        </div>
    `;
    window.showModal({ title: 'Add category', html, onSave: async ()=>{
        const name = document.getElementById('modal-cat-name').value || 'Unnamed';
        const limit = parseFloat(document.getElementById('modal-cat-limit').value) || 0;
        const type = document.getElementById('modal-cat-type').value || 'expense';
        await addCategory({ name, limit, type });
        const s = await getState(); renderDashboard(s);
    }});
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
        <div class="card text-center p-3">
            <div class="text-sm text-gray-500">Income</div>
            <div class="text-lg font-semibold text-success">$${totalIncome.toFixed(2)}</div>
        </div>
        <div class="card text-center p-3">
            <div class="text-sm text-gray-500">Expenses</div>
            <div class="text-lg font-semibold text-danger">$${totalExpense.toFixed(2)}</div>
        </div>
        <div class="card text-center p-3">
            <div class="text-sm text-gray-500">Remaining</div>
            <div class="text-lg font-semibold">$${saved.toFixed(2)}</div>
        </div>
    `;

    // progress bar
    const bar = document.getElementById('spend-bar');
    if(bar) bar.style.width = `${Math.min(100, spentPercent)}%`;
    const percent = document.getElementById('spend-percent');
    if(percent) percent.textContent = `${spentPercent}% spent`;

    // categories
        // Split categories into income and expense
        const expenseList = document.getElementById('category-list');
        expenseList.innerHTML = '';
        const incomeListContainer = document.createElement('div');
        incomeListContainer.id = 'income-category-list';
        incomeListContainer.className = 'mt-3';

        // render income categories separately
        const incomeCats = state.categories.filter(c => c.type === 'income');
        const expenseCats = state.categories.filter(c => c.type !== 'income');

        // show income categories
        if(incomeCats.length){
            const header = document.createElement('h4'); header.className = 'text-sm font-medium'; header.textContent = 'Income categories (earned)';
            incomeListContainer.appendChild(header);
            incomeCats.forEach(cat => {
                const earned = state.transactions.filter(t=>t.categoryId===cat.id && t.type==='income').reduce((s,t)=>s+Number(t.amount),0);
                const item = document.createElement('div');
                item.className = 'flex items-center justify-between py-2 border-b';
                item.innerHTML = `<div>${cat.name}<div class="text-xs text-gray-500">Earned</div></div><div class="font-semibold text-success">$${earned.toFixed(2)}</div>`;
                incomeListContainer.appendChild(item);
            });
            expenseList.parentElement.insertBefore(incomeListContainer, expenseList);
        }

        // show expense categories with bars
        expenseCats.forEach(cat => {
            const spent = state.transactions.filter(t=>t.categoryId===cat.id && t.type==='expense').reduce((s,t)=>s+Number(t.amount),0);
            const pct = cat.limit > 0 ? Math.min(100, Math.round((spent / cat.limit) * 100)) : 0;
            const li = document.createElement('li');
            li.className = 'py-3';
            li.innerHTML = `
                <div class="flex justify-between items-center">
                    <div class="font-medium">${cat.name}</div>
                    <div class="text-sm">$${spent.toFixed(2)} / $${Number(cat.limit).toFixed(2)}</div>
                </div>
                <div class="w-full bg-gray-200 dark:bg-gray-700 rounded h-3 mt-2 overflow-hidden">
                    <div class="h-3 bg-danger" style="width:${pct}%"></div>
                </div>
            `;
            expenseList.appendChild(li);
        });

            // attach edit/delete handlers for categories
        categoryList.querySelectorAll('button[data-action]').forEach(btn=>{
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
                                <div class="space-y-2">
                                    <input id="edit-cat-name" class="w-full p-2 border rounded" value="${cat.name}" />
                                    <div class="flex gap-2">
                                        <input id="edit-cat-limit" class="flex-1 p-2 border rounded" value="${cat.limit}" />
                                        <select id="edit-cat-type" class="p-2 border rounded w-40"><option value="expense">Expense</option><option value="income">Income</option></select>
                                    </div>
                                </div>
                            `;
                            window.showModal({ title: 'Edit category', html, onSave: async ()=>{
                                const newName = document.getElementById('edit-cat-name').value || cat.name;
                                const newLimit = parseFloat(document.getElementById('edit-cat-limit').value) || 0;
                                const newType = document.getElementById('edit-cat-type').value || 'expense';
                                const { updateCategoryLimit } = await import('../storage.js');
                                await updateCategoryLimit(id, newLimit);
                                const st = await getState();
                                const c = st.categories.find(x=>x.id===id);
                                if(c){ c.name = newName; c.type = newType; }
                                await import('../storage.js').then(m=>m.saveState(st));
                                const s2 = await getState(); renderDashboard(s2);
                            }});
                            // pre-select type
                            setTimeout(()=>{ document.getElementById('edit-cat-type').value = cat.type || 'expense'; }, 10);
                }
            });
        });

    // recent transactions
    const recent = document.getElementById('recent-transactions');
    recent.innerHTML = '';
    state.transactions.slice(-5).reverse().forEach(t=>{
        const li = document.createElement('li');
        li.className = 'flex items-center justify-between';
        const cat = state.categories.find(c=>c.id===t.categoryId);
        const prettyDate = window.formatDate(t.date);
        li.innerHTML = `<div>${prettyDate} • ${t.description || ''} <span class="text-xs text-gray-500">${cat ? cat.name : ''}</span></div><div class="font-semibold ${t.type==='income'?'text-success':'text-danger'}">${t.type==='income'?'+':'-'}$${Number(t.amount).toFixed(2)}</div>`;
        recent.appendChild(li);
    });
}