// Storage module built on LocalForage.
// Provides a simple state model for: metadata, categories, transactions, and helpers for import/export.

const storage = localforage.createInstance({ name: 'pinch-budget' });

const DEFAULT_STATE = {
    meta: {
        month: null, // e.g. '2025-11'
        baseBudget: 0,
        saveLocation: 'local',
        autoSaveToFile: false,
        darkMode: false
    },
    // Start with no categories or transactions by default.
    // Categories and transactions are populated by user actions or via import.
    categories: [],
    transactions: []
};

async function initStorage() {
    const state = await storage.getItem('appState');
    if (!state) {
        await storage.setItem('appState', DEFAULT_STATE);
        return DEFAULT_STATE;
    }
    return state;
}

async function getState() {
    return (await storage.getItem('appState')) || DEFAULT_STATE;
}

async function saveState(state) {
    const res = await storage.setItem('appState', state);
    // Notify listeners (useful for UI autosave/export hooks)
    try { window.dispatchEvent(new CustomEvent('appStateChanged', { detail: state })); } catch (e) { /* noop */ }
    return res;
}

async function setSaveLocation(kind = 'local'){
    // kind: 'local' | 'download'
    const state = await getState();
    state.meta.saveLocation = kind;
    await saveState(state);
    return state.meta;
}

async function setAutoSaveToFile(enabled = false){
    const state = await getState();
    state.meta.autoSaveToFile = !!enabled;
    await saveState(state);
    return state.meta;
}

async function resetForNewMonth({ month, baseBudget, categories } = {}) {
    // categories optional array of {name, limit}
    const newState = {
        meta: { month: month || null, baseBudget: baseBudget || 0, saveLocation: 'local', autoSaveToFile: false, darkMode: false },
        categories: (categories || []).map((c, i) => ({ id: `c${Date.now()}_${i}`, name: c.name, limit: Number(c.limit || 0), type: c.type || 'expense' })),
        transactions: []
    };
    await saveState(newState);
    return newState;
}

// Category helpers
async function addCategory({ name, limit = 0, type = 'expense' } = {}) {
    const state = await getState();
    const id = `c${Date.now()}`;
    const category = { id, name: String(name || 'Unnamed'), limit: Number(isNaN(Number(limit)) ? 0 : Number(limit)), type: type === 'income' ? 'income' : 'expense' };
    state.categories.push(category);
    await saveState(state);
    return category;
}

async function updateCategory(id, { name, limit, type } = {}){
    const state = await getState();
    const cat = state.categories.find(c => c.id === id);
    if(!cat) return null;
    if(typeof name !== 'undefined') cat.name = String(name);
    if(typeof limit !== 'undefined') cat.limit = Number(isNaN(Number(limit)) ? cat.limit : Number(limit));
    if(typeof type !== 'undefined') cat.type = type === 'income' ? 'income' : 'expense';
    await saveState(state);
    return cat;
}

async function removeCategory(id) {
    const state = await getState();
    state.categories = state.categories.filter(c => c.id !== id);
    // optionally, migrate or delete related transactions — currently we leave transactions as-is
    await saveState(state);
    return state;
}

async function updateCategoryLimit(id, newLimit) {
    const state = await getState();
    const cat = state.categories.find(c => c.id === id);
    if (cat) cat.limit = Number(newLimit);
    await saveState(state);
    return cat;
}

// Transactions
async function addTransaction(tx) {
    const state = await getState();
    const t = Object.assign({ id: `t${Date.now()}` }, tx);
    state.transactions.push(t);
    await saveState(state);
    return t;
}

async function editTransaction(id, patch) {
    const state = await getState();
    const idx = state.transactions.findIndex(t => t.id === id);
    if (idx === -1) return null;
    state.transactions[idx] = { ...state.transactions[idx], ...patch };
    await saveState(state);
    return state.transactions[idx];
}

async function deleteTransaction(id) {
    const state = await getState();
    state.transactions = state.transactions.filter(t => t.id !== id);
    await saveState(state);
    return state;
}

// Transfer between categories (user-driven when category maxed out)
// Moves amount from source category limit to target category limit.
async function transferBetweenCategories(fromCategoryId, toCategoryId, amount) {
    const state = await getState();
    const from = state.categories.find(c => c.id === fromCategoryId);
    const to = state.categories.find(c => c.id === toCategoryId);
    amount = Number(amount);
    if (!from || !to) throw new Error('Invalid category');
    if (from.limit < amount) throw new Error('Insufficient funds in source category');
    from.limit -= amount;
    to.limit += amount;
    await saveState(state);
    return { from, to };
}

// Export / Import
async function exportJSON() {
    const state = await getState();
    return JSON.stringify(state, null, 2);
}

async function exportCSV() {
    const state = await getState();
    // Very small CSV exporter: transactions only. Columns: date,amount,type,category,description
    const header = ['date','amount','type','category','description'];
    const lines = [header.join(',')];
    function fmt(d){
        if(!d) return '';
        const dt = new Date(d);
        if(!isNaN(dt)){
            const dd = String(dt.getDate()).padStart(2,'0');
            const mm = String(dt.getMonth()+1).padStart(2,'0');
            const yyyy = dt.getFullYear();
            return `${dd}-${mm}-${yyyy}`;
        }
        // fallback if already yyyy-mm-dd
        const parts = String(d).split('-');
        if(parts.length>=3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
        return d;
    }
    for (const t of state.transactions) {
        const cat = state.categories.find(c => c.id === t.categoryId);
        const row = [fmt(t.date), t.amount, t.type, (cat && cat.name) || '', `"${(t.description||'').replace(/"/g,'""')}"`];
        lines.push(row.join(','));
    }
    return lines.join('\n');
}

async function importJSON(json) {
    const parsed = typeof json === 'string' ? JSON.parse(json) : json;
    // Basic validation could go here
    await saveState(parsed);
    return parsed;
}

async function clearAllData() {
    await storage.clear();
}

export {
    initStorage,
    getState,
    saveState,
    resetForNewMonth,
    addCategory,
    removeCategory,
    updateCategoryLimit,
    updateCategory,
    addTransaction,
    editTransaction,
    deleteTransaction,
    transferBetweenCategories,
    exportJSON,
    exportCSV,
    importJSON,
    clearAllData,
    setSaveLocation,
    setAutoSaveToFile
};