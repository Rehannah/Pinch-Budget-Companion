// Cloud Storage module using Firestore
import { db, auth } from '../firebase-config.js';
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  serverTimestamp
} from 'firebase/firestore';

const DEFAULT_STATE = {
  meta: {
    month: null,
    baseBudget: 0
  },
  categories: [],
  transactions: []
};

// Get user's data document path
function getUserDataPath() {
  const user = auth.currentUser;
  if (!user) throw new Error('User not authenticated');
  return doc(db, 'users', user.uid, 'userData', 'appState');
}

// Initialize user's data in Firestore
export async function initCloudStorage() {
  try {
    const docRef = getUserDataPath();
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      console.log('[Cloud Storage] Creating new user data');
      await setDoc(docRef, {
        ...DEFAULT_STATE,
        lastUpdated: serverTimestamp()
      });
      return DEFAULT_STATE;
    }
    
    console.log('[Cloud Storage] User data loaded');
    const data = docSnap.data();
    // Remove server timestamp from returned object
    const { lastUpdated, ...state } = data;
    return state || DEFAULT_STATE;
  } catch (error) {
    console.error('[Cloud Storage] Init error:', error);
    throw error;
  }
}

// Get current app state
export async function getState() {
  try {
    const docRef = getUserDataPath();
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      return DEFAULT_STATE;
    }
    
    const data = docSnap.data();
    const { lastUpdated, ...state } = data;
    return state || DEFAULT_STATE;
  } catch (error) {
    console.error('[Cloud Storage] Get state error:', error);
    return DEFAULT_STATE;
  }
}

// Save entire state to Firestore
export async function saveState(state) {
  try {
    const docRef = getUserDataPath();
    await updateDoc(docRef, {
      ...state,
      lastUpdated: serverTimestamp()
    });
    
    // Dispatch custom event for UI updates
    try {
      window.dispatchEvent(new CustomEvent('appStateChanged', { detail: state }));
    } catch (e) {
      /* noop */
    }
    
    return true;
  } catch (error) {
    console.error('[Cloud Storage] Save state error:', error);
    return false;
  }
}

// Month/Budget management
export async function resetForNewMonth({ month, baseBudget, categories } = {}) {
  const state = await getState();
  const newState = {
    meta: {
      ...state.meta,
      month: month || null,
      baseBudget: Number(baseBudget || 0)
    },
    categories:
      typeof categories === 'undefined'
        ? state.categories
        : Array.isArray(categories)
        ? categories.map((c, i) => ({
            id: `c${Date.now()}_${i}`,
            name: c.name,
            limit: c.type === 'income' ? undefined : Number(c.limit || 0),
            type: c.type || 'expense'
          }))
        : state.categories,
    transactions: []
  };
  await saveState(newState);
  return newState;
}

// Category helpers
export async function addCategory({ name, limit = 0, type = 'expense' } = {}) {
  const state = await getState();
  const id = `c${Date.now()}`;
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

export async function updateCategory(id, { name, limit, type } = {}) {
  const state = await getState();
  const cat = state.categories.find((c) => c.id === id);
  if (!cat) return null;
  
  if (typeof name !== 'undefined') cat.name = String(name);
  if (typeof type !== 'undefined') {
    const normalized = type === 'income' ? 'income' : 'expense';
    cat.type = normalized;
    if (normalized === 'income') {
      delete cat.limit;
    } else {
      if (typeof limit === 'undefined' && typeof cat.limit === 'undefined') cat.limit = 0;
    }
  }
  if (typeof limit !== 'undefined') {
    if (cat.type !== 'income') cat.limit = Number(isNaN(Number(limit)) ? cat.limit : Number(limit));
  }
  
  await saveState(state);
  return cat;
}

export async function removeCategory(id) {
  const state = await getState();
  state.categories = state.categories.filter((c) => c.id !== id);
  await saveState(state);
  return state;
}

// Transactions
export async function addTransaction(tx) {
  const state = await getState();
  const t = Object.assign({ id: `t${Date.now()}` }, tx);
  state.transactions.push(t);
  await saveState(state);
  return t;
}

export async function editTransaction(id, patch) {
  const state = await getState();
  const idx = state.transactions.findIndex((t) => t.id === id);
  if (idx === -1) return null;
  state.transactions[idx] = { ...state.transactions[idx], ...patch };
  await saveState(state);
  return state.transactions[idx];
}

export async function deleteTransaction(id) {
  const state = await getState();
  state.transactions = state.transactions.filter((t) => t.id !== id);
  await saveState(state);
  return state;
}

// Transfers between categories
export async function transferBetweenCategories(fromCategoryId, toCategoryId, amount) {
  const state = await getState();
  const from = state.categories.find((c) => c.id === fromCategoryId);
  const to = state.categories.find((c) => c.id === toCategoryId);
  amount = Number(amount);
  
  if (!from || !to) throw new Error('Invalid category');
  if (from.type === 'income' || to.type === 'income')
    throw new Error('Transfers only supported between expense categories');
  if (typeof from.limit !== 'number' || typeof to.limit !== 'number')
    throw new Error('Invalid category limits for transfer');
  
  const spentInFrom = state.transactions
    .filter((t) => t.categoryId === fromCategoryId && t.type === 'expense')
    .reduce((s, t) => s + Number(t.amount), 0);
  const available = Number(from.limit) - spentInFrom;
  
  if (available < amount) throw new Error('Insufficient available funds in source category');
  
  from.limit = Number(from.limit) - amount;
  to.limit = Number(to.limit) + amount;
  
  await saveState(state);
  return { from, to };
}

// Clear all user data
export async function clearAllData() {
  try {
    const docRef = getUserDataPath();
    const newData = {
      ...DEFAULT_STATE,
      lastUpdated: serverTimestamp()
    };
    await setDoc(docRef, newData);
    console.log('[Cloud Storage] All data cleared');
    return true;
  } catch (error) {
    console.error('[Cloud Storage] Clear error:', error);
    return false;
  }
}

// Export/Import helpers
export async function exportData() {
  const state = await getState();
  return JSON.stringify(state, null, 2);
}

export async function importData(jsonString) {
  try {
    const data = JSON.parse(jsonString);
    if (
      !data ||
      typeof data !== 'object' ||
      !data.meta ||
      !Array.isArray(data.categories) ||
      !Array.isArray(data.transactions)
    ) {
      throw new Error('Invalid data format');
    }
    await saveState(data);
    return true;
  } catch (error) {
    console.error('[Cloud Storage] Import error:', error);
    return false;
  }
}
