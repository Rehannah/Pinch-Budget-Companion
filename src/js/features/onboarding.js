import { getState, resetForNewMonth } from "../cloud-storage.js";
import { showToast } from "../components/toast.js";

export async function showOnboarding(isRestarting = false) {
	if (document.getElementById("onboard-modal")) return;

	const state = await getState();
	const hasExistingCategories =
		isRestarting && state && state.categories && state.categories.length > 0;

	const modal = document.createElement("div");
	modal.id = "onboard-modal";
	modal.className =
		"position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-4";
	modal.style.backgroundColor = "rgba(0,0,0,0.5)";
	modal.innerHTML = `
		<div class="bg-white rounded shadow p-4" style="max-width:28rem; width:100%">
			<h3 class="h5 fw-semibold">${isRestarting ? "Restart" : "Welcome"} — Setup your month</h3>
			<div class="mt-3">
				<label class="form-label small">Month</label>
				<input id="onboard-month" type="text" class="form-control" placeholder="e.g. 01-2025" />
				<label class="form-label small mt-2">Base budget</label>
				<input id="onboard-base" type="number" step="0.01" class="form-control" placeholder="0.00" />

				${
					hasExistingCategories
						? `
				<div class="form-check mt-2 mb-2">
					<input class="form-check-input" type="checkbox" id="onboard-keep-cats" checked />
					<label class="form-check-label small" for="onboard-keep-cats">Keep existing categories</label>
				</div>
				`
						: ""
				}

				<div class="mt-3">
					<div class="d-flex align-items-center justify-content-between">
						<label class="form-label small">Categories</label>
						<button id="onboard-add-cat" class="btn btn-link small text-primary">+ Add</button>
					</div>
					<div id="onboard-cat-list" class="mt-2" style="max-height:10rem; overflow:auto"></div>
				</div>

				<div class="d-flex gap-2 justify-content-end mt-3">
					<button id="onboard-skip" class="btn btn-secondary">Skip</button>
					<button id="onboard-save" class="btn btn-primary">Start</button>
				</div>
			</div>
		</div>
	`;

	document.body.appendChild(modal);

	function addCatRow(name = "", limit = "", type = "expense") {
		const row = document.createElement("div");
		row.className = "d-flex gap-2 align-items-center mb-2";
		row.innerHTML = `
			<input class="form-control flex-grow-1" placeholder="Category name" value="${name}" />
			<input class="form-control" style="width:6rem" placeholder="Limit" value="${limit}" />
			<select class="form-select" style="width:8rem">
				<option value="expense" ${type === "expense" ? "selected" : ""}>Expense</option>
				<option value="income" ${type === "income" ? "selected" : ""}>Income</option>
			</select>
			<button class="btn btn-link text-danger p-0">Remove</button>
		`;

		const parts = row.querySelectorAll("input,select");
		const limitInput = parts[1];
		const typeSelect = parts[2];

		function toggleLimit() {
			if (typeSelect.value === "income") {
				limitInput.style.display = "none";
				limitInput.disabled = true;
				limitInput.value = "";
			} else {
				limitInput.style.display = "block";
				limitInput.disabled = false;
			}
		}

		typeSelect.addEventListener("change", toggleLimit);
		toggleLimit();
		row.querySelector("button").addEventListener("click", () => row.remove());

		return row;
	}

	function updateCategoryDisplay(showExisting) {
		const list = document.getElementById("onboard-cat-list");
		list.innerHTML = "";

		if (showExisting && state.categories.length > 0) {
			state.categories.forEach((cat) => {
				const label = document.createElement("div");
				label.className = "small p-2 bg-light rounded mb-2";

				if (cat.type === "expense") {
					label.textContent = `${cat.name} - $${Number(cat.limit).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${cat.type})`;
				} else {
					label.textContent = `${cat.name} (${cat.type})`;
				}

				list.appendChild(label);
			});
		}
	}

	const keepCheckbox = document.getElementById("onboard-keep-cats");
	const categoryList = document.getElementById("onboard-cat-list");
	const addBtn = document.getElementById("onboard-add-cat");
	const skipBtn = document.getElementById("onboard-skip");
	const saveBtn = document.getElementById("onboard-save");

	if (keepCheckbox?.checked) {
		updateCategoryDisplay(true);
	}

	keepCheckbox?.addEventListener("change", () => {
		updateCategoryDisplay(keepCheckbox.checked);
	});

	addBtn.addEventListener("click", () => {
		if (keepCheckbox?.checked) {
			keepCheckbox.checked = false;
			updateCategoryDisplay(false);
		}
		categoryList.appendChild(addCatRow());
	});

	skipBtn.addEventListener("click", () => modal.remove());

	saveBtn.addEventListener("click", async () => {
		const rawMonth = document.getElementById("onboard-month").value.trim();
		const baseBudget = parseFloat(
			document.getElementById("onboard-base").value,
		);

		const monthRegex = /^(0[1-9]|1[0-2])-(\d{4})$/;
		const m = rawMonth.match(monthRegex);

		if (!rawMonth || !m) {
			alert("Please enter a month in MM-YYYY format (e.g. 01-2025).");
			return;
		}

		const month = `${m[2]}-${m[1]}`;
		if (Number.isNaN(baseBudget) || baseBudget < 0) {
			alert("Base budget must be a number ≥ 0.");
			return;
		}

		let categories = [];
		const keepExisting = keepCheckbox && keepCheckbox.checked;

		if (keepExisting) {
			categories = state.categories || [];
		} else {
			const rows = Array.from(categoryList.children).filter((r) =>
				r.classList.contains("d-flex"),
			);

			for (const r of rows) {
				const [nameInput, limitInput, typeSelect] =
					r.querySelectorAll("input,select");
				const name = (nameInput.value || "").trim();
				const type = typeSelect.value || "expense";

				if (!name) {
					alert("Category names cannot be empty.");
					return;
				}

				if (type === "expense") {
					const limit = Number(limitInput.value);
					if (Number.isNaN(limit) || limit < 0) {
						alert("Category limits must be numbers ≥ 0.");
						return;
					}
					categories.push({ name, limit, type });
				} else {
					categories.push({ name, type });
				}
			}
		}

		await resetForNewMonth({ month, baseBudget, categories });
		showToast("Saved successfully");
		modal.remove();

		window.initDashboard?.();
		window.initTransactions?.();
		window.initSettings?.();
	});
}
