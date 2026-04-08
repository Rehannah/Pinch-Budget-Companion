import {
	getState,
	addCategory,
	updateCategory,
	saveState,
	removeCategory,
} from "../cloud-storage.js";
import { showModal } from "../components/modal.js";

let dashboardHandlersBound = false;

export async function initDashboard() {
	const state = await getState();
	renderDashboard(state);

	if (!dashboardHandlersBound) {
		bindDashboardHandlers();
		dashboardHandlersBound = true;
	}
}

window.initDashboard = initDashboard;

function bindDashboardHandlers() {
	document
		.getElementById("add-category-btn")
		?.addEventListener("click", showAddCategoryModal);

	document.getElementById("edit-base")?.addEventListener("click", async () => {
		const state = await getState();
		await showEditBaseModal(state);
	});

	document.getElementById("edit-month")?.addEventListener("click", async () => {
		const state = await getState();
		await showEditMonthModal(state);
	});

	document
		.getElementById("category-list")
		?.addEventListener("click", handleCategoryListClick);

	document.addEventListener("click", handleIncomeCategoryClick);
}

async function handleIncomeCategoryClick(event) {
	const button = event.target.closest(
		"#income-category-list button[data-action]",
	);
	if (!button) return;

	const id = button.getAttribute("data-id");
	const action = button.getAttribute("data-action");

	await handleCategoryAction({ id, action });
}

async function handleCategoryListClick(event) {
	const button = event.target.closest("button[data-action]");
	if (!button) return;

	const id = button.getAttribute("data-id");
	const action = button.getAttribute("data-action");

	await handleCategoryAction({ id, action });
}

async function handleCategoryAction({ id, action }) {
	if (action === "delete") {
		if (confirm("Delete this category? This will not remove transactions.")) {
			await removeCategory(id);
			await initDashboard();
		}
		return;
	}

	if (action === "edit") {
		const state = await getState();
		const category = state.categories.find((c) => c.id === id);
		if (!category) return;

		await showEditCategoryModal(category);
	}
}

async function showEditBaseModal(state) {
	const html = `
        <div class="mb-3">
            <label class="form-label small">Base Budget</label>
            <input
                id="modal-base"
                type="number"
                step="1.00"
                class="form-control"
                value="${Number(state.meta.baseBudget || 0).toFixed(2)}"
            />
        </div>
    `;

	showModal({
		title: "Edit Budget Base",
		html,
		saveText: "Save",
		onSave: async () => {
			const newBase = parseFloat(document.getElementById("modal-base").value);

			if (Number.isNaN(newBase) || newBase < 0) {
				alert("Budget must be a number ≥ 0.");
				return false;
			}

			const totalAssigned = state.categories
				.filter((c) => c.type !== "income")
				.reduce((sum, c) => sum + Number(c.limit || 0), 0);

			if (newBase < totalAssigned) {
				const confirmed = await confirmBaseBelowAssigned(
					totalAssigned,
					newBase,
				);
				if (!confirmed) return false;
			}

			const nextState = {
				...state,
				meta: {
					...state.meta,
					baseBudget: newBase,
				},
			};

			await saveState(nextState);
			await initDashboard();

			try {
				await window.initTransactions?.();
			} catch (e) {
				console.warn("initTransactions failed after base edit", e);
			}
		},
	});
}

function confirmBaseBelowAssigned(totalAssigned, newBase) {
	return new Promise((resolve) => {
		const diff = totalAssigned - newBase;
		const html = `
            <p class="small">
                The sum of your expense category limits is
                <strong>$${totalAssigned.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>,
                which exceeds the new base by
                <strong>$${diff.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>.
                You should adjust category limits or transaction data. Save anyway?
            </p>
        `;

		showModal({
			title: "Base smaller than assigned limits",
			html,
			saveText: "Save anyway",
			onSave: () => {
				resolve(true);
				return true;
			},
			onCancel: () => {
				document
					.getElementById("category-list")
					?.scrollIntoView({ behavior: "smooth" });
				resolve(false);
			},
		});
	});
}

async function showEditMonthModal(state) {
	const currentMonth =
		state.meta?.month && String(state.meta.month).includes("-")
			? (() => {
					const [year, month] = String(state.meta.month).split("-");
					return `${month}-${year}`;
				})()
			: "";

	const html = `
        <div class="mb-3">
            <label class="form-label small">Month (MM-YYYY)</label>
            <input
                id="modal-month"
                type="text"
                class="form-control"
                placeholder="e.g. 01-2025"
                value="${currentMonth}"
            />
        </div>
    `;

	showModal({
		title: "Edit Month",
		html,
		saveText: "Save",
		onSave: async () => {
			const raw = document.getElementById("modal-month").value.trim();
			const monthRegex = /^(0[1-9]|1[0-2])-(\d{4})$/;
			const match = raw.match(monthRegex);

			if (!raw || !match) {
				alert("Month must be in MM-YYYY format (e.g. 01-2025).");
				return false;
			}

			const [, month, year] = match;
			const newMonth = `${year}-${month}`;

			const nextTransactions = Array.isArray(state.transactions)
				? state.transactions.map((tx) => {
						const parts = String(tx.date || "").split("-");
						const day = parts.length >= 3 ? parts[2] : "01";
						return {
							...tx,
							date: `${newMonth}-${String(day).padStart(2, "0")}`,
						};
					})
				: [];

			const nextState = {
				...state,
				meta: {
					...state.meta,
					month: newMonth,
				},
				transactions: nextTransactions,
			};

			await saveState(nextState);
			await initDashboard();
		},
	});
}

async function showAddCategoryModal() {
	const html = `
        <div class="mb-3">
            <input id="modal-cat-name" class="form-control mb-2" placeholder="Category name" />
            <div class="d-flex gap-2">
                <input id="modal-cat-limit" class="form-control flex-grow-1" placeholder="Limit" />
                <select id="modal-cat-type" class="form-select" style="width:10rem">
                    <option value="expense">Expense</option>
                    <option value="income">Income</option>
                </select>
            </div>
        </div>
    `;

	showModal({
		title: "Add category",
		html,
		onSave: async () => {
			const category = await readCategoryForm({
				nameId: "modal-cat-name",
				limitId: "modal-cat-limit",
				typeId: "modal-cat-type",
			});

			if (!category) return false;

			await addCategory(category);
			await initDashboard();
		},
	});

	wireCategoryTypeToggle("modal-cat-type", "modal-cat-limit");
}

async function showEditCategoryModal(category) {
	const html = `
        <div class="mb-3">
            <input
                id="edit-cat-name"
                class="form-control mb-2"
                value="${escapeHtml(category.name)}"
            />
            <div class="d-flex gap-2">
                <input
                    id="edit-cat-limit"
                    class="form-control flex-grow-1"
                    value="${category.limit == null ? "" : category.limit}"
                />
                <select id="edit-cat-type" class="form-select" style="width:10rem">
                    <option value="expense">Expense</option>
                    <option value="income">Income</option>
                </select>
            </div>
        </div>
    `;

	showModal({
		title: "Edit category",
		html,
		onSave: async () => {
			const updates = await readCategoryForm({
				nameId: "edit-cat-name",
				limitId: "edit-cat-limit",
				typeId: "edit-cat-type",
			});

			if (!updates) return false;

			await updateCategory(category.id, updates);
			await initDashboard();
		},
	});

	const typeEl = document.getElementById("edit-cat-type");
	if (typeEl) typeEl.value = category.type || "expense";
	wireCategoryTypeToggle("edit-cat-type", "edit-cat-limit");
}

async function readCategoryForm({ nameId, limitId, typeId }) {
	const name = document.getElementById(nameId)?.value?.trim() || "Unnamed";
	const type = document.getElementById(typeId)?.value || "expense";

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

function renderDashboard(state) {
	renderMonthAndBase(state);
	renderSummaryCards(state);
	renderSpendProgress(state);
	renderUnallocatedBanner(state);
	renderCategories(state);
}

function renderMonthAndBase(state) {
	let monthLabel = "Unnamed month";

	if (state.meta?.month) {
		try {
			const parts = String(state.meta.month).split("-");
			if (parts.length === 2) {
				const year = Number(parts[0]);
				const month = Number(parts[1]);
				const date = new Date(year, Math.max(0, month - 1), 1);
				monthLabel = date.toLocaleString(undefined, {
					month: "long",
					year: "numeric",
				});
			} else {
				monthLabel = state.meta.month;
			}
		} catch {
			monthLabel = state.meta.month;
		}
	}

	document.getElementById("month-label").textContent = monthLabel;
	document.getElementById("budget-base").textContent = `Base Budget: $${Number(
		state.meta.baseBudget || 0,
	).toLocaleString(undefined, {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	})}`;
}

function renderSummaryCards(state) {
	const totalIncome = state.transactions
		.filter((t) => t.type === "income")
		.reduce((sum, t) => sum + Number(t.amount), 0);

	const totalExpense = state.transactions
		.filter((t) => t.type === "expense")
		.reduce((sum, t) => sum + Number(t.amount), 0);

	const baseBudget = Number(state.meta.baseBudget || 0);
	const remaining = Math.max(0, baseBudget - totalExpense);

	document.getElementById("summary-cards").innerHTML = `
        <div class="col">
            <div class="card text-center p-3">
                <div class="small text-muted">Income</div>
                <div class="h5 fw-semibold text-success">$${totalIncome.toLocaleString(
									undefined,
									{
										minimumFractionDigits: 2,
										maximumFractionDigits: 2,
									},
								)}</div>
            </div>
        </div>
        <div class="col">
            <div class="card text-center p-3">
                <div class="small text-muted">Expenses</div>
                <div class="h5 fw-semibold text-danger">$${totalExpense.toLocaleString(
									undefined,
									{
										minimumFractionDigits: 2,
										maximumFractionDigits: 2,
									},
								)}</div>
            </div>
        </div>
        <div class="col">
            <div class="card text-center p-3">
                <div class="small text-muted">Remaining</div>
                <div class="h5 fw-semibold">$${remaining.toLocaleString(
									undefined,
									{
										minimumFractionDigits: 2,
										maximumFractionDigits: 2,
									},
								)}</div>
            </div>
        </div>
    `;
}

function renderSpendProgress(state) {
	const totalExpense = state.transactions
		.filter((t) => t.type === "expense")
		.reduce((sum, t) => sum + Number(t.amount), 0);

	const baseBudget = Number(state.meta.baseBudget || 0);
	const spentPercent =
		baseBudget > 0
			? Math.min(100, Math.round((totalExpense / baseBudget) * 100))
			: 0;

	const spendBar = document.getElementById("spend-bar");
	const spendPercentLabel = document.getElementById("spend-percent");

	if (spendBar) spendBar.style.width = `${spentPercent}%`;
	if (spendPercentLabel)
		spendPercentLabel.textContent = `${spentPercent}% spent`;
}

function renderUnallocatedBanner(state) {
	const container = document.querySelector(".container");
	if (!container) return;

	document.getElementById("unallocated-banner")?.remove();

	const base = Number(state.meta.baseBudget || 0);
	const totalAssigned = state.categories
		.filter((c) => c.type !== "income")
		.reduce((sum, c) => sum + Number(c.limit || 0), 0);

	const remaining = Math.max(0, base - totalAssigned);
	if (!(base > 0 && remaining > 0)) return;

	const banner = document.createElement("div");
	banner.id = "unallocated-banner";
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
            <button id="redistribute-btn" class="btn btn-sm btn-outline-primary me-2">Redistribute</button>
            <button id="dismiss-unalloc" class="btn btn-sm btn-secondary">Dismiss</button>
        </div>
    `;

	const firstSection = container.querySelector("section");
	if (firstSection?.parentNode) {
		firstSection.parentNode.insertBefore(banner, firstSection.nextSibling);
	}

	banner
		.querySelector("#dismiss-unalloc")
		?.addEventListener("click", () => banner.remove());

	banner.querySelector("#redistribute-btn")?.addEventListener("click", () => {
		const expenseCategories = state.categories.filter(
			(c) => c.type !== "income",
		);
		showRedistributeModal(remaining, expenseCategories);
	});
}

function renderCategories(state) {
	const categoryList = document.getElementById("category-list");
	if (!categoryList) return;

	categoryList.innerHTML = "";
	document.getElementById("income-category-list")?.remove();
	removeExpenseHeader();

	const incomeCategories = state.categories.filter((c) => c.type === "income");
	const expenseCategories = state.categories.filter((c) => c.type !== "income");

	if (incomeCategories.length) {
		renderIncomeCategories(incomeCategories, state);
	}

	if (expenseCategories.length && incomeCategories.length) {
		insertExpenseHeader(categoryList);
	}

	renderExpenseCategories(expenseCategories, state, categoryList);
}

function renderIncomeCategories(categories, state) {
	const categoryList = document.getElementById("category-list");
	if (!categoryList?.parentElement) return;

	const container = document.createElement("div");
	container.id = "income-category-list";
	container.className = "mt-3 mb-4";

	const header = document.createElement("h3");
	header.className = "small fw-semibold";
	header.textContent = "Income";
	container.appendChild(header);

	const list = document.createElement("div");
	list.className = "mt-3 w-100";

	categories.forEach((category) => {
		const earned = state.transactions
			.filter((t) => t.categoryId === category.id && t.type === "income")
			.reduce((sum, t) => sum + Number(t.amount), 0);

		const row = document.createElement("div");
		row.className =
			"d-flex justify-content-between align-items-center py-2 border-bottom";
		row.innerHTML = `
            <div>
                <div class="fw-medium">${escapeHtml(category.name)}</div>
                <div class="small text-muted">
                    Earned: $${earned.toLocaleString(undefined, {
											minimumFractionDigits: 2,
											maximumFractionDigits: 2,
										})}
                </div>
            </div>
            <div class="d-flex gap-2">
                <button data-action="edit" data-id="${category.id}" class="btn btn-link btn-sm text-primary p-0">Edit</button>
                <button data-action="delete" data-id="${category.id}" class="btn btn-link btn-sm text-danger p-0">Delete</button>
            </div>
        `;
		list.appendChild(row);
	});

	container.appendChild(list);
	categoryList.parentElement.insertBefore(container, categoryList);
}

function renderExpenseCategories(categories, state, categoryList) {
	categories.forEach((category) => {
		const spent = state.transactions
			.filter((t) => t.categoryId === category.id && t.type === "expense")
			.reduce((sum, t) => sum + Number(t.amount), 0);

		const limit =
			typeof category.limit === "number" ? Number(category.limit) : 0;
		const remaining = Math.max(0, limit - spent);
		const percent =
			limit > 0 ? Math.min(100, Math.round((spent / limit) * 100)) : 0;

		const li = document.createElement("li");
		li.className = "py-3";
		li.innerHTML = `
            <div class="d-flex justify-content-between align-items-center">
                <div>
                    <div class="fw-medium">${escapeHtml(category.name)}</div>
                    <div class="small text-muted">
                        Spent: $${spent.toLocaleString(undefined, {
													minimumFractionDigits: 2,
													maximumFractionDigits: 2,
												})}
                        | Remaining: $${remaining.toLocaleString(undefined, {
													minimumFractionDigits: 2,
													maximumFractionDigits: 2,
												})}
                    </div>
                </div>
                <div class="small">
                    <div class="fw-semibold">
                        $${limit.toLocaleString(undefined, {
													minimumFractionDigits: 2,
													maximumFractionDigits: 2,
												})} limit
                    </div>
                </div>
            </div>
            <div class="w-100 bg-light rounded mt-2 overflow-hidden" style="height:0.5rem;">
                <div class="h-100 ${percent > 100 ? "bg-danger" : "bg-warning"}" style="width:${Math.min(100, percent)}%"></div>
            </div>
            <div class="d-flex align-items-center gap-2 mt-2">
                <button data-action="edit" data-id="${category.id}" class="btn btn-link btn-sm text-primary p-0">Edit</button>
                <button data-action="delete" data-id="${category.id}" class="btn btn-link btn-sm text-danger p-0">Delete</button>
            </div>
        `;
		categoryList.appendChild(li);
	});
}

function insertExpenseHeader(categoryList) {
	const header = document.createElement("h3");
	header.id = "expense-category-header";
	header.className = "small fw-semibold mt-4";
	header.textContent = "Expenses";
	categoryList.parentElement?.insertBefore(header, categoryList);
}

function removeExpenseHeader() {
	document.getElementById("expense-category-header")?.remove();
}

async function showRedistributeModal(remaining, expenseCategories) {
	if (!expenseCategories?.length) return;

	const rows = expenseCategories
		.map(
			(category) => `
                <div class="d-flex gap-2 align-items-center mb-2">
                    <div class="flex-grow-1">
                        ${escapeHtml(category.name)}
                        <div class="small text-muted">
                            current: $${Number(
															category.limit || 0,
														).toLocaleString(undefined, {
															minimumFractionDigits: 2,
															maximumFractionDigits: 2,
														})}
                        </div>
                    </div>
                    <div style="width:10rem">
                        <input
                            type="number"
                            min="0"
                            step="0.01"
                            class="form-control alloc-input"
                            data-cat-id="${category.id}"
                            value="0"
                        />
                    </div>
                </div>
            `,
		)
		.join("");

	const html = `
        <div class="mb-2">
            <p class="small">
                Distribute the
                <strong>$${remaining.toLocaleString(undefined, {
									minimumFractionDigits: 2,
									maximumFractionDigits: 2,
								})}</strong>
                remaining across your expense categories. Values must sum to the remaining amount.
            </p>
            ${rows}
            <div class="d-flex gap-2 mt-2">
                <button id="even-dist" class="btn btn-sm btn-outline-secondary">Evenly distribute</button>
                <div class="flex-grow-1"></div>
                <div class="small text-muted">Remaining must be fully allocated to save.</div>
            </div>
        </div>
    `;

	showModal({
		title: "Redistribute unallocated budget",
		html,
		saveText: "Save",
		onSave: async () => {
			const inputs = Array.from(document.querySelectorAll(".alloc-input"));
			let sum = 0;

			const assignments = inputs.map((input) => {
				const value = parseFloat(input.value) || 0;
				sum += value;
				return { id: input.getAttribute("data-cat-id"), value };
			});

			if (Math.abs(sum - remaining) > 0.01) {
				alert(
					`Allocated sum $${sum.toLocaleString(undefined, {
						minimumFractionDigits: 2,
						maximumFractionDigits: 2,
					})} does not equal remaining $${remaining.toLocaleString(undefined, {
						minimumFractionDigits: 2,
						maximumFractionDigits: 2,
					})}.`,
				);
				return false;
			}

			for (const assignment of assignments) {
				const category = expenseCategories.find((c) => c.id === assignment.id);
				if (!category) continue;

				const newLimit =
					Number(category.limit || 0) + Number(assignment.value || 0);
				await updateCategory(category.id, { limit: newLimit });
			}

			await initDashboard();
		},
	});

	setTimeout(() => {
		document.getElementById("even-dist")?.addEventListener("click", () => {
			const perCategory = Number(
				(remaining / expenseCategories.length).toFixed(2),
			);
			document.querySelectorAll(".alloc-input").forEach((input) => {
				input.value = perCategory;
			});
		});
	}, 0);
}

function escapeHtml(value) {
	return String(value)
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#39;");
}
