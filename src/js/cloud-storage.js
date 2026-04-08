import { db, auth } from "./firebase-config.js";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";

const DEFAULT_STATE = Object.freeze({
	meta: {
		month: null,
		baseBudget: 0,
	},
	categories: [],
	transactions: [],
});

function cloneDefaultState() {
	return {
		meta: { ...DEFAULT_STATE.meta },
		categories: [],
		transactions: [],
	};
}

function makeId(prefix) {
	return `${prefix}${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function getUserDataPath() {
	const user = auth.currentUser;
	if (!user) throw new Error("User not authenticated");
	return doc(db, "users", user.uid, "userData", "appState");
}

function emitAppEvent(name, detail) {
	try {
		window.dispatchEvent(new CustomEvent(name, { detail }));
	} catch {
		// noop
	}
}

function normalizeCategory(category = {}, fallbackIndex = 0) {
	const type = category.type === "income" ? "income" : "expense";

	const normalized = {
		id: category.id || makeId(`c${fallbackIndex}_`),
		name: String(category.name || "Unnamed"),
		type,
	};

	if (type !== "income") {
		normalized.limit = Number.isFinite(Number(category.limit))
			? Number(category.limit)
			: 0;
	}

	return normalized;
}

function normalizeTransaction(transaction = {}, fallbackIndex = 0) {
	return {
		id: transaction.id || makeId(`t${fallbackIndex}_`),
		date: transaction.date || "",
		amount: Number.isFinite(Number(transaction.amount))
			? Number(transaction.amount)
			: 0,
		categoryId: transaction.categoryId || "",
		type: transaction.type === "income" ? "income" : "expense",
		description: String(transaction.description || ""),
	};
}

function sanitizeState(state = {}) {
	const safeState = cloneDefaultState();

	safeState.meta = {
		month: state.meta?.month || null,
		baseBudget: Number.isFinite(Number(state.meta?.baseBudget))
			? Number(state.meta.baseBudget)
			: 0,
	};

	safeState.categories = Array.isArray(state.categories)
		? state.categories.map(normalizeCategory)
		: [];

	safeState.transactions = Array.isArray(state.transactions)
		? state.transactions.map(normalizeTransaction)
		: [];

	return safeState;
}

async function readStateDoc() {
	const docRef = getUserDataPath();
	const docSnap = await getDoc(docRef);

	if (!docSnap.exists()) {
		return null;
	}

	const data = docSnap.data();
	const { updatedAt, ...state } = data;
	return sanitizeState(state);
}

async function writeStateDoc(state) {
	const cleanedState = sanitizeState(state);
	const docRef = getUserDataPath();

	await setDoc(docRef, {
		...cleanedState,
		updatedAt: serverTimestamp(),
	});

	return cleanedState;
}

export async function initCloudStorage() {
	try {
		const existing = await readStateDoc();
		if (existing) {
			console.log("[Cloud Storage] User data loaded");
			return existing;
		}

		console.log("[Cloud Storage] Creating new user data");
		const initialState = cloneDefaultState();
		await writeStateDoc(initialState);
		return initialState;
	} catch (error) {
		console.error("[Cloud Storage] Init error:", error);
		throw error;
	}
}

export async function getState() {
	try {
		const state = await readStateDoc();
		return state || cloneDefaultState();
	} catch (error) {
		console.error("[Cloud Storage] Get state error:", error);
		return cloneDefaultState();
	}
}

export async function saveState(state) {
	try {
		emitAppEvent("appSaving");

		const cleanedState = await writeStateDoc(state);

		emitAppEvent("appStateChanged", cleanedState);
		emitAppEvent("appSaved");

		return true;
	} catch (error) {
		console.error("[Cloud Storage] Save state error:", error);
		emitAppEvent("appSaveFailed", { error });
		return false;
	}
}

export async function resetForNewMonth({ month, baseBudget, categories } = {}) {
	const current = await getState();

	const nextState = {
		meta: {
			...current.meta,
			month: month || null,
			baseBudget: Number(baseBudget || 0),
		},
		categories:
			typeof categories === "undefined"
				? current.categories
				: Array.isArray(categories)
					? categories.map((category, index) =>
							normalizeCategory(
								{ ...category, id: makeId(`c${index}_`) },
								index,
							),
						)
					: current.categories,
		transactions: [],
	};

	await saveState(nextState);
	return sanitizeState(nextState);
}

export async function addCategory({ name, limit = 0, type = "expense" } = {}) {
	const state = await getState();

	const category = normalizeCategory({
		id: makeId("c"),
		name,
		limit,
		type,
	});

	state.categories.push(category);
	await saveState(state);

	return category;
}

export async function updateCategory(id, updates = {}) {
	const state = await getState();
	const existing = state.categories.find((category) => category.id === id);
	if (!existing) return null;

	const merged = {
		...existing,
		...updates,
		id: existing.id,
	};

	const normalized = normalizeCategory(merged);
	const index = state.categories.findIndex((category) => category.id === id);
	state.categories[index] = normalized;

	await saveState(state);
	return normalized;
}

export async function removeCategory(id) {
	const state = await getState();
	state.categories = state.categories.filter((category) => category.id !== id);
	await saveState(state);
	return state;
}

export async function addTransaction(transaction) {
	const state = await getState();

	const nextTransaction = normalizeTransaction({
		id: makeId("t"),
		...transaction,
	});

	state.transactions.push(nextTransaction);
	await saveState(state);

	return nextTransaction;
}

export async function editTransaction(id, patch) {
	const state = await getState();
	const index = state.transactions.findIndex(
		(transaction) => transaction.id === id,
	);
	if (index === -1) return null;

	state.transactions[index] = normalizeTransaction({
		...state.transactions[index],
		...patch,
		id,
	});

	await saveState(state);
	return state.transactions[index];
}

export async function deleteTransaction(id) {
	const state = await getState();
	state.transactions = state.transactions.filter(
		(transaction) => transaction.id !== id,
	);
	await saveState(state);
	return state;
}

export async function transferBetweenCategories(
	fromCategoryId,
	toCategoryId,
	amount,
) {
	const state = await getState();

	const from = state.categories.find(
		(category) => category.id === fromCategoryId,
	);
	const to = state.categories.find((category) => category.id === toCategoryId);
	const numericAmount = Number(amount);

	if (!from || !to) throw new Error("Invalid category");
	if (from.type === "income" || to.type === "income") {
		throw new Error("Transfers only supported between expense categories");
	}
	if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
		throw new Error("Invalid transfer amount");
	}

	const spentInFrom = state.transactions
		.filter(
			(transaction) =>
				transaction.categoryId === fromCategoryId &&
				transaction.type === "expense",
		)
		.reduce((sum, transaction) => sum + Number(transaction.amount), 0);

	const available = Number(from.limit || 0) - spentInFrom;
	if (available < numericAmount) {
		throw new Error("Insufficient available funds in source category");
	}

	from.limit = Number(from.limit || 0) - numericAmount;
	to.limit = Number(to.limit || 0) + numericAmount;

	await saveState(state);
	return { from, to };
}

export async function clearAllData() {
	try {
		await writeStateDoc(cloneDefaultState());
		console.log("[Cloud Storage] All data cleared");
		return true;
	} catch (error) {
		console.error("[Cloud Storage] Clear error:", error);
		return false;
	}
}

export async function exportData() {
	const state = await getState();
	return JSON.stringify(state, null, 2);
}

export async function importData(jsonString) {
	try {
		const parsed = JSON.parse(jsonString);
		const cleaned = sanitizeState(parsed);
		await saveState(cleaned);
		return true;
	} catch (error) {
		console.error("[Cloud Storage] Import error:", error);
		return false;
	}
}
