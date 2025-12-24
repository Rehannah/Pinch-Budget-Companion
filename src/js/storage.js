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
    // Reset for new month: set month/baseBudget and clear transactions; optionally replace categories.
    // Note: pass `categories: []` explicitly if you want to clear categories. If `categories` is
    // omitted (undefined), existing categories are preserved.
    const state = await getState();
    const newState = {
        meta: {
            ...state.meta,
            month: month || null,
            baseBudget: Number(baseBudget || 0)
        },
        categories: (typeof categories === 'undefined')
            ? state.categories // preserve existing categories when not provided
            : // when categories is provided (even an empty array), use it as authoritative
            (Array.isArray(categories) ? categories.map((c, i) => ({
                id: `c${Date.now()}_${i}`,
                name: c.name,
                // income categories do not have a limit
                limit: (c.type === 'income' ? undefined : (typeof c.limit !== 'undefined' ? Number(c.limit) : 0)),
                type: c.type || 'expense'
            })) : state.categories),
        transactions: []
    };
    await saveState(newState);
    return newState;
}

async function clearTransactionsOnly() {
    // Clear only transactions; preserve categories, month, and budget for restart flow
    const state = await getState();
    state.transactions = [];
    await saveState(state);
    return state;
}

// Category helpers
async function addCategory({ name, limit = 0, type = 'expense' } = {}) {
    const state = await getState();
    const id = `c${Date.now()}`;
    // For income categories, we omit the limit (no notion of limit).
    const category = {
        id,
        name: String(name || 'Unnamed'),
        limit: type === 'income' ? undefined : Number(isNaN(Number(limit)) ? 0 : Number(limit)),
        type: type === 'income' ? 'income' : 'expense'
    };
    state.categories.push(category);
    await saveState(state);
    return category;
}

async function updateCategory(id, { name, limit, type } = {}){
    const state = await getState();
    const cat = state.categories.find(c => c.id === id);
    if(!cat) return null;
    if(typeof name !== 'undefined') cat.name = String(name);
    // If type is changed to income, remove the limit entirely.
    if(typeof type !== 'undefined'){
        const normalized = type === 'income' ? 'income' : 'expense';
        cat.type = normalized;
        if(normalized === 'income'){
            delete cat.limit;
        } else {
            // ensure a numeric limit exists for expense categories
            if(typeof limit === 'undefined' && typeof cat.limit === 'undefined') cat.limit = 0;
        }
    }
    if(typeof limit !== 'undefined'){
        // only set limit for expense categories
        if(cat.type !== 'income') cat.limit = Number(isNaN(Number(limit)) ? cat.limit : Number(limit));
    }
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
    if (cat && cat.type !== 'income') cat.limit = Number(newLimit);
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
// Moves amount from source category limit to destination category limit.
async function transferBetweenCategories(fromCategoryId, toCategoryId, amount) {
    const state = await getState();
    const from = state.categories.find(c => c.id === fromCategoryId);
    const to = state.categories.find(c => c.id === toCategoryId);
    amount = Number(amount);
    if (!from || !to) throw new Error('Invalid category');
    // only allow transfers between expense categories that have numeric limits
    if (from.type === 'income' || to.type === 'income') throw new Error('Transfers only supported between expense categories');
    if (typeof from.limit !== 'number' || typeof to.limit !== 'number') throw new Error('Invalid category limits for transfer');
    // compute how much of the `from` category is already spent
    const spentInFrom = state.transactions.filter(t => t.categoryId === fromCategoryId && t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
    const available = Number(from.limit) - spentInFrom;
    if (available < amount) throw new Error('Insufficient available funds in source category');
    from.limit = Number(from.limit) - amount;
    to.limit = Number(to.limit) + amount;
    await saveState(state);
    return { from, to };
}

async function clearAllData() {
    await storage.clear();
}

export {
    initStorage,
    getState,
    saveState,
    resetForNewMonth,
    clearTransactionsOnly,
    addCategory,
    removeCategory,
    updateCategoryLimit,
    updateCategory,
    addTransaction,
    editTransaction,
    deleteTransaction,
    transferBetweenCategories,
    clearAllData,
    setSaveLocation,
    setAutoSaveToFile
};