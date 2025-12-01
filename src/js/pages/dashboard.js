import { getState, addCategory, updateCategory } from '../storage.js';

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
        <div class="mb-3">
            <input id="modal-cat-name" class="form-control mb-2" placeholder="Category name" />
            <div class="d-flex gap-2">
                <input id="modal-cat-limit" class="form-control flex-grow-1" placeholder="Limit (for expense)" />
                <select id="modal-cat-type" class="form-select" style="width:10rem"><option value="expense">Expense</option><option value="income">Income</option></select>
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
            const header = document.createElement('h4'); header.className = 'small fw-semibold'; header.textContent = 'Income categories (earned)';
            incomeListContainer.appendChild(header);
            incomeCats.forEach(cat => {
                const earned = state.transactions.filter(t=>t.categoryId===cat.id && t.type==='income').reduce((s,t)=>s+Number(t.amount),0);
                const item = document.createElement('div');
                item.className = 'd-flex align-items-center justify-content-between py-2 border-bottom';
                item.innerHTML = `<div>${cat.name}<div class="small text-muted">Earned</div></div><div class="fw-semibold text-success">$${earned.toFixed(2)}</div>`;
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
                <div class="d-flex justify-content-between align-items-center">
                    <div class="fw-medium">${cat.name}</div>
                    <div class="small">$${spent.toFixed(2)} / $${Number(cat.limit).toFixed(2)}</div>
                </div>
                <div class="w-100 bg-light rounded h-3 mt-2 overflow-hidden">
                    <div class="h-3 bg-danger" style="width:${pct}%"></div>
                </div>
            `;
            // add edit/delete buttons for each category
            const actions = document.createElement('div');
            actions.className = 'd-flex align-items-center gap-2';
            actions.innerHTML = `<button data-action="edit" data-id="${cat.id}" class="btn btn-link btn-sm text-primary p-0">Edit</button><button data-action="delete" data-id="${cat.id}" class="btn btn-link btn-sm text-danger p-0">Delete</button>`;
            // find the top-level flex container we created in innerHTML to append actions
            const topFlex = li.querySelector('.d-flex.justify-content-between') || li.querySelector('.d-flex');
            if(topFlex) topFlex.appendChild(actions);
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
                                        <input id="edit-cat-limit" class="form-control flex-grow-1" value="${cat.limit}" />
                                        <select id="edit-cat-type" class="form-select" style="width:10rem"><option value="expense">Expense</option><option value="income">Income</option></select>
                                    </div>
                                </div>
                            `;
                            window.showModal({ title: 'Edit category', html, onSave: async ()=>{
                                const newName = document.getElementById('edit-cat-name').value || cat.name;
                                const newLimit = parseFloat(document.getElementById('edit-cat-limit').value);
                                const newType = document.getElementById('edit-cat-type').value || 'expense';
                                await updateCategory(id, { name: newName, limit: Number(isNaN(newLimit)?cat.limit:newLimit), type: newType });
                                const s2 = await getState(); renderDashboard(s2);
                            }});
                            // pre-select type
                            setTimeout(()=>{ document.getElementById('edit-cat-type').value = cat.type || 'expense'; }, 10);
                }
            });
        });

}