import {
	getState,
	addTransaction,
	addCategory,
	editTransaction,
	deleteTransaction,
	transferBetweenCategories,
	saveState,
} from "../cloud-storage.js";
import { showModal } from "../components/modal.js";
import { formatDate } from "../utils/date.js";

let transactionsHandlersBound = false;

export async function initTransactions() {
	await populateCategories();
	await updateBaseMonthLabel();
	await renderTransactions();
	updateUnallocatedWarning();

	if (!transactionsHandlersBound) {
		bindTransactionHandlers();
		transactionsHandlersBound = true;
	}
}

window.initTransactions = initTransactions;

function bindTransactionHandlers() {
	document
		.getElementById("transaction-type")
		?.addEventListener("change", async () => {
			await populateCategories();
			await updateUnallocatedWarning();
		});

	document
		.getElementById("transaction-category")
		?.addEventListener("change", handleCategorySelectorChange);

	document
		.getElementById("transaction-amount")
		?.addEventListener("input", updateUnallocatedWarning);

	document
		.getElementById("transaction-form")
		?.addEventListener("submit", handleTransactionSubmit);

	document.getElementById("clear-form")?.addEventListener("click", () => {
		document.getElementById("transaction-form")?.reset();
		updateUnallocatedWarning();
	});

	document
		.getElementById("transactions")
		?.addEventListener("click", handleTransactionListClick);
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

		const state = await getState();
		const baseBudget = Number(state.meta.baseBudget || 0);
		if (baseBudget > 0 && limit > baseBudget) {
			alert("Category limit cannot exceed the Base Budget.");
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
	await updateUnallocatedWarning();

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

	if (tx.type === "expense") {
		const okCategory = await handleExpenseCategoryLimitIfNeeded(tx);
		if (!okCategory) return;

		const okBase = await handleBaseBudgetOverflowIfNeeded(tx);
		if (!okBase) return;
	}

	await addTransaction(tx);

	document.getElementById("transaction-form")?.reset();
	await populateCategories();
	await renderTransactions();
	await updateUnallocatedWarning();
}

async function readTransactionForm() {
	const type = document.getElementById("transaction-type")?.value || "expense";
	const categoryId =
		document.getElementById("transaction-category")?.value || "";
	const dayRaw = document.getElementById("transaction-date")?.value || "";
	const description = document.getElementById("transaction-desc")?.value || "";
	const amountRaw = document.getElementById("transaction-amount")?.value || "";
	const amount = Number(amountRaw);

	if (Number.isNaN(amount) || amount <= 0) {
		alert("Please enter an amount greater than 0.");
		return null;
	}

	const day = parseInt(dayRaw, 10);
	if (Number.isNaN(day) || day < 1 || day > 31) {
		alert("Please enter a valid day (1-31).");
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
	};
}

async function handleExpenseCategoryLimitIfNeeded(tx) {
	const state = await getState();
	const category = state.categories.find((c) => c.id === tx.categoryId);
	if (!category || typeof category.limit !== "number") return true;

	const spent = state.transactions
		.filter(
			(transaction) =>
				transaction.categoryId === tx.categoryId &&
				transaction.type === "expense",
		)
		.reduce((sum, transaction) => sum + Number(transaction.amount), 0);

	const wouldBe = spent + tx.amount;
	if (wouldBe <= category.limit) return true;

	const otherCategories = state.categories
		.filter((c) => c.id !== category.id && c.type !== "income")
		.map((c) => {
			const limit = Number(c.limit || 0);
			const spentInCategory = state.transactions
				.filter(
					(transaction) =>
						transaction.categoryId === c.id && transaction.type === "expense",
				)
				.reduce((sum, transaction) => sum + Number(transaction.amount), 0);

			return {
				...c,
				available: Math.max(0, limit - spentInCategory),
			};
		});

	return await showCategoryExceededModal({
		category,
		wouldBe,
		amount: tx.amount,
		otherCategories,
	});
}

function showCategoryExceededModal({
	category,
	wouldBe,
	amount,
	otherCategories,
}) {
	return new Promise((resolve) => {
		const html = `
            <div class="mb-2">
                <p class="small">
                    Category <strong>${escapeHtml(category.name)}</strong> limit:
                    $${Number(category.limit).toLocaleString(undefined, {
											minimumFractionDigits: 2,
											maximumFractionDigits: 2,
										})}.
                    This transaction would make spent
                    $${wouldBe.toLocaleString(undefined, {
											minimumFractionDigits: 2,
											maximumFractionDigits: 2,
										})}.
                </p>

                <label class="form-label small">Choose action</label>
                <select id="transfer-action" class="form-select">
                    <option value="transfer">Transfer from another category</option>
                    <option value="increase">Increase base budget</option>
                    <option value="cancel">Cancel</option>
                </select>

                <div id="transfer-extra" class="mt-2"></div>
            </div>
        `;

		showModal({
			title: "Category limit exceeded",
			html,
			saveText: "Proceed",
			onSave: async () => {
				const action = document.getElementById("transfer-action")?.value;

				if (action === "cancel") {
					resolve(false);
					return true;
				}

				if (action === "increase") {
					const increaseBy = parseFloat(
						document.getElementById("transfer-extra-input")?.value || "0",
					);
					if (increaseBy > 0) {
						const state = await getState();
						state.meta.baseBudget =
							Number(state.meta.baseBudget || 0) + increaseBy;
						await saveState(state);
					}
					resolve(true);
					return true;
				}

				if (action === "transfer") {
					const sourceId = document.getElementById("transfer-source")?.value;
					const transferAmount = parseFloat(
						document.getElementById("transfer-extra-input")?.value || "0",
					);

					if (!sourceId || transferAmount <= 0) {
						alert("Please select a source category and provide an amount > 0.");
						return false;
					}

					try {
						await transferBetweenCategories(
							sourceId,
							category.id,
							transferAmount,
						);
						resolve(true);
						return true;
					} catch (error) {
						alert("Transfer failed: " + error.message);
						return false;
					}
				}

				resolve(false);
				return true;
			},
			onCancel: () => resolve(false),
		});

		setTimeout(() => {
			const actionEl = document.getElementById("transfer-action");
			const extra = document.getElementById("transfer-extra");
			if (!actionEl || !extra) return;

			function renderExtra() {
				if (actionEl.value === "transfer") {
					const options = otherCategories
						.map(
							(c) =>
								`<option value="${c.id}" ${c.available <= 0 ? "disabled" : ""}>${escapeHtml(c.name)} (available $${c.available.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})</option>`,
						)
						.join("");

					const firstAvailable = otherCategories.find((c) => c.available > 0);
					const defaultAmount = firstAvailable
						? Math.min(firstAvailable.available, amount)
						: amount;

					extra.innerHTML = `
                        <label class="form-label small">Source category</label>
                        <select id="transfer-source" class="form-select">${options}</select>
                        <label class="form-label small mt-2">Amount to transfer</label>
                        <input id="transfer-extra-input" type="number" class="form-control" value="${defaultAmount}" />
                    `;

					if (firstAvailable) {
						document.getElementById("transfer-source").value =
							firstAvailable.id;
					}
				} else if (actionEl.value === "increase") {
					extra.innerHTML = `
                        <label class="form-label small">Increase base by</label>
                        <input id="transfer-extra-input" type="number" class="form-control" value="${amount}" />
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

async function handleBaseBudgetOverflowIfNeeded(tx) {
	const state = await getState();
	const totalExpense = state.transactions
		.filter((transaction) => transaction.type === "expense")
		.reduce((sum, transaction) => sum + Number(transaction.amount), 0);

	const baseBudget = Number(state.meta.baseBudget || 0);
	if (!(baseBudget > 0 && totalExpense + tx.amount > baseBudget)) {
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

				if (increaseBy > 0) {
					const nextState = await getState();
					nextState.meta.baseBudget =
						Number(nextState.meta.baseBudget || 0) + increaseBy;
					await saveState(nextState);
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

async function updateUnallocatedWarning() {
	try {
		const state = await getState();
		const base = Number(state.meta.baseBudget || 0);
		const expenseCategories = state.categories.filter(
			(c) => c.type !== "income",
		);
		const totalAssigned = expenseCategories.reduce(
			(sum, category) => sum + Number(category.limit || 0),
			0,
		);
		const remaining = Math.max(0, base - totalAssigned);

		const type =
			document.getElementById("transaction-type")?.value || "expense";
		const existingBanner = document.getElementById(
			"unallocated-banner-transactions",
		);

		if (base > 0 && remaining > 0 && type === "expense") {
			if (!existingBanner) {
				const container = document.querySelector(".container");
				const banner = document.createElement("div");
				banner.id = "unallocated-banner-transactions";
				banner.className =
					"alert alert-warning d-flex justify-content-between align-items-center";
				banner.innerHTML = `
                    <div class="small">
                        You have $${remaining.toLocaleString(undefined, {
													minimumFractionDigits: 2,
													maximumFractionDigits: 2,
												})} of your base budget unallocated.
                    </div>
                    <div>
                        <button id="dismiss-unalloc-tx" class="btn btn-sm btn-secondary">Dismiss</button>
                    </div>
                `;

				const firstSection = container?.querySelector("section");
				if (firstSection?.parentNode) {
					firstSection.parentNode.insertBefore(banner, firstSection);
				} else if (container) {
					container.insertBefore(banner, container.firstChild);
				}

				banner
					.querySelector("#dismiss-unalloc-tx")
					?.addEventListener("click", () => banner.remove());
			} else {
				const textDiv = existingBanner.querySelector("div");
				if (textDiv) {
					textDiv.textContent = `You have $${remaining.toLocaleString(
						undefined,
						{
							minimumFractionDigits: 2,
							maximumFractionDigits: 2,
						},
					)} of your base budget unallocated.`;
				}
			}
		} else {
			existingBanner?.remove();
		}
	} catch {
		// noop
	}
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
			await deleteTransaction(id);
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

			if (payload.type === "expense") {
				const categoryOk = await handleExpenseLimitForEdit(payload);
				if (!categoryOk) return false;

				const baseOk = await handleBaseOverflowForEdit(payload);
				if (!baseOk) return false;
			}

			await editTransaction(transaction.id, payload);
			await renderTransactions();
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

		typeSelect?.addEventListener("change", fillCategoryOptions);
		await fillCategoryOptions();
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
	};
}

async function handleExpenseLimitForEdit(payload) {
	const state = await getState();
	const category = state.categories.find((c) => c.id === payload.categoryId);
	if (!category || typeof category.limit !== "number") return true;

	const spentExcluding = state.transactions
		.filter(
			(transaction) =>
				transaction.categoryId === payload.categoryId &&
				transaction.type === "expense" &&
				transaction.id !== payload.id,
		)
		.reduce((sum, transaction) => sum + Number(transaction.amount), 0);

	const wouldBe = spentExcluding + payload.amount;
	if (wouldBe <= category.limit) return true;

	const otherCategories = state.categories
		.filter((c) => c.id !== category.id && c.type !== "income")
		.map((c) => {
			const limit = Number(c.limit || 0);
			const spent = state.transactions
				.filter(
					(transaction) =>
						transaction.categoryId === c.id && transaction.type === "expense",
				)
				.reduce((sum, transaction) => sum + Number(transaction.amount), 0);

			return {
				...c,
				available: Math.max(0, limit - spent),
			};
		});

	return await showCategoryExceededModal({
		category,
		wouldBe,
		amount: payload.amount,
		otherCategories,
	});
}

async function handleBaseOverflowForEdit(payload) {
	const state = await getState();
	const totalExpenseExcludingEdited = state.transactions
		.filter(
			(transaction) =>
				transaction.type === "expense" && transaction.id !== payload.id,
		)
		.reduce((sum, transaction) => sum + Number(transaction.amount), 0);

	const baseBudget = Number(state.meta.baseBudget || 0);
	if (
		!(
			baseBudget > 0 &&
			totalExpenseExcludingEdited + payload.amount > baseBudget
		)
	) {
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

				if (increaseBy > 0) {
					const nextState = await getState();
					nextState.meta.baseBudget =
						Number(nextState.meta.baseBudget || 0) + increaseBy;
					await saveState(nextState);
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
