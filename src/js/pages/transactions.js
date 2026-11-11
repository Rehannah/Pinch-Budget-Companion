import {
	getState,
	addTransaction,
	addCategory,
	editTransaction,
	deleteTransaction,
	saveState,
} from "../cloud-storage.js";
import { showModal } from "../components/modal.js";
import { showToast } from "../components/toast.js";
import { formatDate } from "../utils/date.js";
import { getDebtCategoryKind } from "../features/debt-categories.js";

let transactionsHandlersBound = false;

export async function initTransactions() {
	await ensureDayPicker();
	await populateCategories();
	await updateBaseMonthLabel();
	await populateDayPicker();
	await renderTransactions();
	updateBankPoolControl();

	if (!transactionsHandlersBound) {
		bindTransactionHandlers();
		transactionsHandlersBound = true;
	}
}

async function ensureDayPicker() {
	const existing = document.getElementById("transaction-date");
	if (!existing) return;
	if (existing.tagName.toLowerCase() === "select") return;

	const select = document.createElement("select");
	select.id = existing.id;
	select.className = existing.className;
	select.style.cssText = existing.style.cssText;
	select.required = true;
	select.innerHTML = "";
	existing.replaceWith(select);
}

window.initTransactions = initTransactions;

function bindTransactionHandlers() {
	document
		.getElementById("transaction-type")
		?.addEventListener("change", async () => {
			await populateCategories();
			updateBankPoolControl();
		});

	document
		.getElementById("transaction-category")
		?.addEventListener("change", handleCategorySelectorChange);

	document
		.getElementById("transaction-form")
		?.addEventListener("submit", handleTransactionSubmit);

	document.getElementById("clear-form")?.addEventListener("click", () => {
		document.getElementById("transaction-form")?.reset();
		updateBankPoolControl();
	});

	document
		.getElementById("transaction-bank-pool")
		?.addEventListener("change", updateBankPoolControl);

	document
		.getElementById("transactions")
		?.addEventListener("click", handleTransactionListClick);
}

function updateBankPoolControl() {
	const type = document.getElementById("transaction-type")?.value || "expense";
	const wrapper = document.getElementById("transaction-bank-pool-wrapper");
	const checkbox = document.getElementById("transaction-bank-pool");
	if (!wrapper || !checkbox) return;

	const isExpense = type === "expense";
	wrapper.classList.toggle("d-none", !isExpense);
	checkbox.disabled = !isExpense;
	if (!isExpense) checkbox.checked = false;
}

async function updateBaseMonthLabel() {
	try {
		const state = await getState();
		const el = document.getElementById("transaction-base-month");
		if (!el) return;

		if (state.meta?.month) {
			try {
				const [year, month] = String(state.meta.month).split("-");
				const d = new Date(Number(year), Math.max(0, Number(month) - 1), 1);
				el.textContent = d.toLocaleString(undefined, {
					month: "short",
					year: "numeric",
				});
				await populateDayPicker();
			} catch {
				el.textContent = state.meta.month;
			}
		} else {
			el.textContent = "";
		}
	} catch {
		// noop
	}
}

async function populateDayPicker() {
	const select = document.getElementById("transaction-date");
	if (!select) return;

	const state = await getState();
	const baseMonth = state.meta?.month || new Date().toISOString().slice(0, 7);
	const [year, month] = String(baseMonth).split("-");
	const monthIndex = Math.max(0, Number(month) - 1);
	const daysInMonth = new Date(Number(year), monthIndex + 1, 0).getDate();

	select.innerHTML = "";
	for (let day = 1; day <= daysInMonth; day++) {
		const option = document.createElement("option");
		option.value = String(day).padStart(2, "0");
		option.textContent = day;
		select.appendChild(option);
	}
}

async function populateCategories() {
	const state = await getState();
	const select = document.getElementById("transaction-category");
	const typeEl = document.getElementById("transaction-type");
	if (!select) return;

	select.innerHTML = "";

	const transactionType = typeEl?.value || "expense";
	const filteredCategories = state.categories.filter(
		(category) => category.type === transactionType,
	);

	if (filteredCategories.length === 0) {
		const opt = document.createElement("option");
		opt.value = "__no_cat__";
		opt.textContent = "No categories — add one";
		select.appendChild(opt);
	} else {
		filteredCategories.forEach((category) => {
			const opt = document.createElement("option");
			opt.value = category.id;
			opt.textContent = category.name;
			select.appendChild(opt);
		});
	}

	const addOption = document.createElement("option");
	addOption.value = "__add_new__";
	addOption.textContent = "+ Add new category";
	select.appendChild(addOption);
}

async function handleCategorySelectorChange(event) {
	const select = event.currentTarget;
	if (select.value !== "__add_new__") return;

	const type = document.getElementById("transaction-type")?.value || "expense";
	const newCategory = await openCategoryCreateModal(type);
	await populateCategories();

	if (newCategory) {
		select.value = newCategory.id;
	} else {
		const firstRealOption = Array.from(select.options).find(
			(option) => option.value !== "__add_new__",
		);
		select.value = firstRealOption?.value || "__no_cat__";
	}
}

async function openCategoryCreateModal(defaultType = "expense") {
	return new Promise((resolve) => {
		const html = `
            <div class="mb-3">
                <input id="new-cat-name" class="form-control mb-2" placeholder="Category name" />
                <div class="d-flex gap-2">
                    <input id="new-cat-limit" class="form-control flex-grow-1" placeholder="Limit (for expense)" />
                    <select id="new-cat-type" class="form-select" style="width:10rem">
                        <option value="expense">Expense</option>
                        <option value="income">Income</option>
                    </select>
                </div>
            </div>
        `;

		showModal({
			title: "Add category",
			html,
			saveText: "Add",
			onSave: async () => {
				const typeEl = document.getElementById("new-cat-type");
				if (typeEl) typeEl.value = defaultType;

				const payload = await readCategoryForm({
					nameId: "new-cat-name",
					limitId: "new-cat-limit",
					typeId: "new-cat-type",
				});

				if (!payload) return false;

				const category = await addCategory(payload);
				resolve(category);
			},
			onCancel: () => resolve(null),
		});

		const typeEl = document.getElementById("new-cat-type");
		if (typeEl) typeEl.value = defaultType;
		wireCategoryTypeToggle("new-cat-type", "new-cat-limit");
	});
}

async function readCategoryForm({ nameId, limitId, typeId }) {
	const name = document.getElementById(nameId)?.value?.trim() || "";
	const type = document.getElementById(typeId)?.value || "expense";

	if (!name) {
		alert("Category name is required.");
		return null;
	}

	if (type === "expense") {
		const raw = document.getElementById(limitId)?.value ?? "";
		const limit = raw === "" ? 0 : parseFloat(raw);

		if (Number.isNaN(limit) || limit < 0) {
			alert("Limit must be a number ≥ 0.");
			return null;
		}

		return { name, type, limit };
	}

	return { name, type };
}

function wireCategoryTypeToggle(typeId, limitId) {
	setTimeout(() => {
		const typeEl = document.getElementById(typeId);
		const limitEl = document.getElementById(limitId);
		if (!typeEl || !limitEl) return;

		function toggle() {
			limitEl.style.display = typeEl.value === "income" ? "none" : "block";
		}

		typeEl.addEventListener("change", toggle);
		toggle();
	}, 0);
}

async function handleTransactionSubmit(event) {
	event.preventDefault();

	const tx = await readTransactionForm();
	if (!tx) return;

	let categoryId = tx.categoryId;

	if (!categoryId || categoryId === "__no_cat__") {
		const createdCategory = await openCategoryCreateModal(tx.type);
		await populateCategories();
		if (!createdCategory) return;

		categoryId = createdCategory.id;
	}

	if (!categoryId || categoryId === "__add_new__") {
		alert("Please choose or create a category.");
		return;
	}

	tx.categoryId = categoryId;
	const state = await getState();
	if (!validateDebtPerson(tx, state)) return;
	const categoryWarning = getCategoryLimitWarning(tx, state);

	if (tx.type === "expense" && !tx.bankPool) {
		const okBase = await handleBaseBudgetOverflowIfNeeded(tx);
		if (!okBase) return;
	}

	try {
		await addTransaction(tx);
	} catch (error) {
		showToast(`Transaction was not saved: ${error.message || error}`, {
			timeout: 8000,
		});
		return;
	}
	if (categoryWarning) showToast(categoryWarning, { timeout: 5000 });

	document.getElementById("transaction-form")?.reset();
	await populateCategories();
	updateBankPoolControl();
	await renderTransactions();
}

async function readTransactionForm() {
	const type = document.getElementById("transaction-type")?.value || "expense";
	const categoryId =
		document.getElementById("transaction-category")?.value || "";
	const dayRaw = document.getElementById("transaction-date")?.value || "";
	const description = document.getElementById("transaction-desc")?.value || "";
	const amountRaw = document.getElementById("transaction-amount")?.value || "";
	const amount = Number(amountRaw);
	const bankPool =
		type === "expense" &&
		!!document.getElementById("transaction-bank-pool")?.checked;

	if (Number.isNaN(amount) || amount <= 0) {
		alert("Please enter an amount greater than 0.");
		return null;
	}

	if (!dayRaw) {
		alert("Please choose a day for this transaction.");
		return null;
	}

	const day = parseInt(dayRaw, 10);
	if (Number.isNaN(day) || day < 1 || day > 31) {
		alert("Please choose a valid day.");
		return null;
	}

	const state = await getState();
	const baseMonth = state.meta?.month || new Date().toISOString().slice(0, 7);

	const date = `${baseMonth}-${String(day).padStart(2, "0")}`;

	return {
		type,
		categoryId,
		date,
		description,
		amount,
		bankPool,
	};
}

function validateDebtPerson(transaction, state) {
	const category = state.categories.find(
		(item) => item.id === transaction.categoryId,
	);
	if (!getDebtCategoryKind(category?.name)) return true;

	if (!/\[[^\]]+\]|\{[^}]+\}/.test(transaction.description || "")) {
		alert(
			"Add the person's name in square brackets in the description, for example [Sam].",
		);
		return false;
	}
	return true;
}

function getCategoryLimitWarning(transaction, state) {
	if (
		transaction.type !== "expense" ||
		transaction.bankPool ||
		!isInCurrentMonth(transaction, state)
	) {
		return "";
	}

	const category = state.categories.find(
		(item) => item.id === transaction.categoryId,
	);
	if (!category || !Number.isFinite(Number(category.limit))) return "";

	const spent = (state.transactions || [])
		.filter(
			(item) =>
				item.id !== transaction.id &&
				item.categoryId === category.id &&
				item.type === "expense" &&
				!item.bankPool &&
				isInCurrentMonth(item, state),
		)
		.reduce((sum, item) => sum + Number(item.amount || 0), 0);
	const overage =
		spent + Number(transaction.amount || 0) - Number(category.limit);
	if (overage <= 0) return "";

	const overPercent =
		Number(category.limit) > 0
			? ` (${Math.round((overage / Number(category.limit)) * 100)}% over)`
			: "";
	return `${category.name} will be $${overage.toFixed(2)} over its soft limit${overPercent}; transaction saved.`;
}

async function handleBaseBudgetOverflowIfNeeded(tx) {
	const state = await getState();
	const totalExpense = state.transactions
		.filter(
			(transaction) =>
				transaction.type === "expense" &&
				!transaction.bankPool &&
				isInCurrentMonth(transaction, state),
		)
		.reduce((sum, transaction) => sum + Number(transaction.amount), 0);

	const baseBudget = Number(state.meta.baseBudget || 0);
	if (totalExpense + tx.amount <= baseBudget) {
		return true;
	}

	const excess = totalExpense + tx.amount - baseBudget;

	return await new Promise((resolve) => {
		const html = `
            <div class="mb-2">
                <p class="small">
                    Total expenses would exceed Budget Base by
                    $${excess.toLocaleString(undefined, {
											minimumFractionDigits: 2,
											maximumFractionDigits: 2,
										})}.
                </p>
                <p class="small text-muted">
                    Current Budget Base:
                    $${baseBudget.toLocaleString(undefined, {
											minimumFractionDigits: 2,
											maximumFractionDigits: 2,
										})}
                    | Current Total Expense:
                    $${totalExpense.toLocaleString(undefined, {
											minimumFractionDigits: 2,
											maximumFractionDigits: 2,
										})}
                </p>

                <label class="form-label small">Do you want to increase Budget Base or cancel?</label>
                <select id="base-action" class="form-select">
                    <option value="increase">Increase base budget</option>
                    <option value="cancel">Cancel this transaction</option>
                </select>

                <div id="base-extra" class="mt-2"></div>
            </div>
        `;

		showModal({
			title: "Budget Base would be exceeded",
			html,
			saveText: "Proceed",
			onSave: async () => {
				const action = document.getElementById("base-action")?.value;

				if (action === "cancel") {
					resolve(false);
					return true;
				}

				const increaseBy = parseFloat(
					document.getElementById("base-extra-input")?.value || "0",
				);

				if (!Number.isFinite(increaseBy) || increaseBy + 0.009 < excess) {
					alert(`Increase the Budget Base by at least $${excess.toFixed(2)}.`);
					return false;
				}

				const nextState = await getState();
				nextState.meta.baseBudget =
					Number(nextState.meta.baseBudget || 0) + increaseBy;
				if (!(await saveState(nextState))) {
					alert("Could not save the Budget Base increase. Try again.");
					return false;
				}

				resolve(true);
				return true;
			},
			onCancel: () => resolve(false),
		});

		setTimeout(() => {
			const actionEl = document.getElementById("base-action");
			const extra = document.getElementById("base-extra");
			if (!actionEl || !extra) return;

			function renderExtra() {
				if (actionEl.value === "increase") {
					extra.innerHTML = `
                        <label class="form-label small">Increase base by</label>
                        <input id="base-extra-input" type="number" class="form-control" value="${excess.toFixed(2)}" />
                    `;
				} else {
					extra.innerHTML = "";
				}
			}

			actionEl.addEventListener("change", renderExtra);
			renderExtra();
		}, 0);
	});
}

function isInCurrentMonth(transaction, state) {
	return (
		!state.meta?.month ||
		String(transaction.date || "").startsWith(`${state.meta.month}-`)
	);
}

async function renderTransactions() {
	const state = await getState();
	const list = document.getElementById("transactions");
	if (!list) return;

	list.innerHTML = "";

	let transactions = Array.isArray(state.transactions)
		? state.transactions.slice()
		: [];

	if (state.meta?.month) {
		transactions = transactions.filter(
			(transaction) =>
				typeof transaction.date === "string" &&
				transaction.date.startsWith(state.meta.month + "-"),
		);
	}

	transactions.sort((a, b) => (b.date || "").localeCompare(a.date || ""));

	transactions.forEach((transaction) => {
		const category = state.categories.find(
			(c) => c.id === transaction.categoryId,
		);
		const li = document.createElement("li");
		li.className =
			"d-flex align-items-center justify-content-between p-2 border-bottom";

		li.innerHTML = `
            <div>
                <div class="small">
                    ${formatDate(transaction.date)} • ${escapeHtml(transaction.description || "")}
                </div>
                <div class="small text-muted">
                    ${escapeHtml(category ? category.name : "Uncategorized")}
					${transaction.bankPool ? " · Bank pool" : ""}
                </div>
            </div>
            <div class="d-flex align-items-center gap-2">
                <div class="fw-semibold ${transaction.type === "income" ? "text-success" : "text-danger"}">
                    ${transaction.type === "income" ? "+" : "-"}$${Number(
											transaction.amount,
										).toLocaleString(undefined, {
											minimumFractionDigits: 2,
											maximumFractionDigits: 2,
										})}
                </div>
                <button data-id="${transaction.id}" class="btn btn-link btn-sm p-0 text-primary edit-btn">Edit</button>
                <button data-id="${transaction.id}" class="btn btn-link btn-sm p-0 text-danger delete-btn">Delete</button>
            </div>
        `;

		list.appendChild(li);
	});
}

async function handleTransactionListClick(event) {
	const deleteBtn = event.target.closest(".delete-btn");
	if (deleteBtn) {
		const id = deleteBtn.getAttribute("data-id");
		if (confirm("Delete this transaction?")) {
			try {
				await deleteTransaction(id);
			} catch (error) {
				showToast(`Transaction was not deleted: ${error.message || error}`, {
					timeout: 8000,
				});
				return;
			}
			await renderTransactions();
		}
		return;
	}

	const editBtn = event.target.closest(".edit-btn");
	if (editBtn) {
		const id = editBtn.getAttribute("data-id");
		await openEditTransactionModal(id);
	}
}

async function openEditTransactionModal(id) {
	const state = await getState();
	const transaction = state.transactions.find((item) => item.id === id);
	if (!transaction) return;

	const dayValue =
		transaction.date && transaction.date.split("-")[2]
			? parseInt(transaction.date.split("-")[2], 10)
			: "";

	const baseMonthLabel = state.meta?.month
		? (() => {
				try {
					const [year, month] = String(state.meta.month).split("-");
					const date = new Date(
						Number(year),
						Math.max(0, Number(month) - 1),
						1,
					);
					return date.toLocaleString(undefined, {
						month: "short",
						year: "numeric",
					});
				} catch {
					return state.meta.month;
				}
			})()
		: "";

	const html = `
        <div class="mb-3">
            <label class="form-label small">Amount</label>
            <input id="edit-t-amount" class="form-control mb-3" value="${transaction.amount}" />

            <label class="form-label small">Description</label>
            <input id="edit-t-desc" class="form-control mb-3" value="${escapeHtml(transaction.description || "")}" />

            <div class="row g-2 mb-3">
                <div class="col-4">
                    <label class="form-label small">Type</label>
                    <select id="edit-t-type" class="form-select">
                        <option value="expense" ${transaction.type === "expense" ? "selected" : ""}>Expense</option>
                        <option value="income" ${transaction.type === "income" ? "selected" : ""}>Income</option>
                    </select>
                </div>
                <div class="col-8">
                    <label class="form-label small">Category</label>
                    <select id="edit-t-category" class="form-select"></select>
                </div>
            </div>

			<div id="edit-t-bank-pool-wrapper" class="form-check mb-3 ${transaction.type === "income" ? "d-none" : ""}">
				<input id="edit-t-bank-pool" class="form-check-input" type="checkbox" ${transaction.bankPool ? "checked" : ""} />
				<label class="form-check-label small" for="edit-t-bank-pool">Bank pool expense</label>
			</div>

            <label class="form-label small">Day</label>
            <div class="d-flex gap-2 align-items-center">
                <input id="edit-t-day" type="number" min="1" max="31" class="form-control" style="max-width:8rem" value="${dayValue}" />
                <div class="small text-muted">Base: <span id="edit-base-month">${baseMonthLabel}</span></div>
            </div>
        </div>
    `;

	showModal({
		title: "Edit transaction",
		html,
		saveText: "Save",
		onSave: async () => {
			const payload = await readEditTransactionForm(transaction.id);
			if (!payload) return false;

			const currentState = await getState();
			if (!validateDebtPerson(payload, currentState)) return false;
			const categoryWarning = getCategoryLimitWarning(payload, currentState);

			if (payload.type === "expense" && !payload.bankPool) {
				const baseOk = await handleBaseOverflowForEdit(payload);
				if (!baseOk) return false;
			}

			try {
				await editTransaction(transaction.id, payload);
			} catch (error) {
				showToast(`Transaction was not saved: ${error.message || error}`, {
					timeout: 8000,
				});
				return false;
			}
			if (categoryWarning) showToast(categoryWarning, { timeout: 5000 });
			await renderTransactions();
			await window.initDashboard?.();
		},
	});

	setTimeout(async () => {
		const typeSelect = document.getElementById("edit-t-type");
		const categorySelect = document.getElementById("edit-t-category");

		async function fillCategoryOptions() {
			const currentState = await getState();
			const selectedType = typeSelect.value;
			const categories = currentState.categories.filter(
				(category) => category.type === selectedType,
			);

			categorySelect.innerHTML = "";
			categories.forEach((category) => {
				const option = document.createElement("option");
				option.value = category.id;
				option.textContent = category.name;
				if (category.id === transaction.categoryId) option.selected = true;
				categorySelect.appendChild(option);
			});
		}

		function updateEditBankPoolControl() {
			const wrapper = document.getElementById("edit-t-bank-pool-wrapper");
			const checkbox = document.getElementById("edit-t-bank-pool");
			const isExpense = typeSelect?.value === "expense";
			wrapper?.classList.toggle("d-none", !isExpense);
			if (checkbox) {
				checkbox.disabled = !isExpense;
				if (!isExpense) checkbox.checked = false;
			}
		}

		typeSelect?.addEventListener("change", async () => {
			await fillCategoryOptions();
			updateEditBankPoolControl();
		});
		await fillCategoryOptions();
		updateEditBankPoolControl();
	}, 0);
}

async function readEditTransactionForm(transactionId) {
	const amount = parseFloat(
		document.getElementById("edit-t-amount")?.value || "",
	);
	const description = document.getElementById("edit-t-desc")?.value || "";
	const type = document.getElementById("edit-t-type")?.value || "expense";
	const categoryId = document.getElementById("edit-t-category")?.value || "";
	const day = parseInt(document.getElementById("edit-t-day")?.value || "", 10);
	const bankPool =
		type === "expense" &&
		!!document.getElementById("edit-t-bank-pool")?.checked;

	if (Number.isNaN(amount) || amount <= 0) {
		alert("Amount must be a number greater than 0.");
		return null;
	}

	if (Number.isNaN(day) || day < 1 || day > 31) {
		alert("Please enter a valid day (1-31).");
		return null;
	}

	const state = await getState();
	const baseMonth = state.meta?.month || new Date().toISOString().slice(0, 7);
	const date = `${baseMonth}-${String(day).padStart(2, "0")}`;

	return {
		id: transactionId,
		amount,
		description,
		date,
		type,
		categoryId,
		bankPool,
	};
}

async function handleBaseOverflowForEdit(payload) {
	const state = await getState();
	const totalExpenseExcludingEdited = state.transactions
		.filter(
			(transaction) =>
				transaction.type === "expense" &&
				!transaction.bankPool &&
				transaction.id !== payload.id &&
				isInCurrentMonth(transaction, state),
		)
		.reduce((sum, transaction) => sum + Number(transaction.amount), 0);

	const baseBudget = Number(state.meta.baseBudget || 0);
	if (totalExpenseExcludingEdited + payload.amount <= baseBudget) {
		return true;
	}

	const excess = totalExpenseExcludingEdited + payload.amount - baseBudget;

	return await new Promise((resolve) => {
		const html = `
            <div class="mb-2">
                <p class="small">
                    Total expenses would exceed Budget Base by
                    $${excess.toLocaleString(undefined, {
											minimumFractionDigits: 2,
											maximumFractionDigits: 2,
										})}.
                </p>
                <p class="small text-muted">
                    Current Budget Base:
                    $${baseBudget.toLocaleString(undefined, {
											minimumFractionDigits: 2,
											maximumFractionDigits: 2,
										})}
                    | Current Total Expense:
                    $${totalExpenseExcludingEdited.toLocaleString(undefined, {
											minimumFractionDigits: 2,
											maximumFractionDigits: 2,
										})}
                </p>

                <label class="form-label small">Do you want to increase Budget Base or cancel?</label>
                <select id="base-action" class="form-select">
                    <option value="increase">Increase base budget</option>
                    <option value="cancel">Cancel this change</option>
                </select>

                <div id="base-extra" class="mt-2"></div>
            </div>
        `;

		showModal({
			title: "Budget Base would be exceeded",
			html,
			saveText: "Proceed",
			onSave: async () => {
				const action = document.getElementById("base-action")?.value;

				if (action === "cancel") {
					resolve(false);
					return true;
				}

				const increaseBy = parseFloat(
					document.getElementById("base-extra-input")?.value || "0",
				);

				if (!Number.isFinite(increaseBy) || increaseBy + 0.009 < excess) {
					alert(`Increase the Budget Base by at least $${excess.toFixed(2)}.`);
					return false;
				}

				const nextState = await getState();
				nextState.meta.baseBudget =
					Number(nextState.meta.baseBudget || 0) + increaseBy;
				if (!(await saveState(nextState))) {
					alert("Could not save the Budget Base increase. Try again.");
					return false;
				}

				resolve(true);
				return true;
			},
			onCancel: () => resolve(false),
		});

		setTimeout(() => {
			const actionEl = document.getElementById("base-action");
			const extra = document.getElementById("base-extra");
			if (!actionEl || !extra) return;

			function renderExtra() {
				if (actionEl.value === "increase") {
					extra.innerHTML = `
                        <label class="form-label small">Increase base by</label>
                        <input id="base-extra-input" type="number" class="form-control" value="${excess.toFixed(2)}" />
                    `;
				} else {
					extra.innerHTML = "";
				}
			}

			actionEl.addEventListener("change", renderExtra);
			renderExtra();
		}, 0);
	});
}

function escapeHtml(value) {
	return String(value)
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#39;");
}
