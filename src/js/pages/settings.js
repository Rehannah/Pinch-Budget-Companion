import {
	getState,
	resetForNewMonth,
	clearAllData,
	exportData,
	importData,
} from "../cloud-storage.js";
import { showModal } from "../components/modal.js";
import { showToast } from "../components/toast.js";
import { clearServiceWorkersAndCaches } from "../utils/browser-storage.js";

let settingsHandlersBound = false;

export async function initSettings() {
	if (!settingsHandlersBound) {
		bindSettingsHandlers();
		settingsHandlersBound = true;
	}
}

window.initSettings = initSettings;

function bindSettingsHandlers() {
	document
		.getElementById("restart-app")
		?.addEventListener("click", openRestartModal);

	document
		.getElementById("export-data")
		?.addEventListener("click", handleExportData);

	document
		.getElementById("import-data")
		?.addEventListener("click", handleImportData);
}

async function openRestartModal() {
	const html = `
        <div class="mb-3">
            <label class="form-label small">New month</label>
            <input id="restart-month" type="month" class="form-control" />
        </div>

        <div class="mb-3">
            <label class="form-label small">Base budget</label>
            <input
                id="restart-base"
                type="number"
                step="0.01"
                class="form-control"
                placeholder="0.00"
            />
        </div>

        <div class="form-check mb-2">
            <input id="restart-keep-cats" class="form-check-input" type="checkbox" />
            <label class="form-check-label" for="restart-keep-cats">
                Keep existing categories for next month
            </label>
        </div>

        <div class="small text-muted mb-3">
            If you do not keep categories, all categories and transactions will be cleared and the app will start fresh.
        </div>
    `;

	showModal({
		title: "Restart for new month",
		html,
		saveText: "Restart",
		onSave: async () => {
			const form = readRestartForm();
			if (!form) return false;

			if (form.clearAll) {
				return await handleFullReset();
			}

			return await handleMonthlyRestart(form);
		},
	});
}

function readRestartForm() {
	const month = document.getElementById("restart-month")?.value || null;
	const baseBudget = parseFloat(
		document.getElementById("restart-base")?.value || "0",
	);
	const keepCategories =
		!!document.getElementById("restart-keep-cats")?.checked;
	const clearAll = !!document.getElementById("restart-clear-all")?.checked;

	if (!month) {
		alert("Please choose a month to continue.");
		return null;
	}

	if (Number.isNaN(baseBudget) || baseBudget < 0) {
		alert("Base budget must be a number ≥ 0.");
		return null;
	}

	return {
		month,
		baseBudget,
		keepCategories,
		clearAll,
	};
}

async function handleFullReset() {
	const confirmed = confirm(
		"This will delete ALL app data (including month, base, categories, and transactions). Are you sure?",
	);

	if (!confirmed) return false;

	await clearAllData();
	await clearServiceWorkersAndCaches();

	showToast("All app data cleared. Starting fresh.");

	setTimeout(() => {
		window.location.href = "dashboard.html";
	}, 500);

	return true;
}

async function handleMonthlyRestart({ month, baseBudget, keepCategories }) {
	const state = await getState();

	const categoriesToKeep = keepCategories
		? state.categories.map((category) => {
				const baseCategory = {
					name: category.name,
					type: category.type,
				};

				if (category.type !== "income") {
					baseCategory.limit = category.limit;
				}

				return baseCategory;
			})
		: [];

	const expenseCategories = categoriesToKeep.filter(
		(category) => category.type !== "income",
	);

	const totalAssigned = expenseCategories.reduce(
		(sum, category) => sum + Number(category.limit || 0),
		0,
	);

	if (totalAssigned > baseBudget) {
		alert(
			"One or more category limits exceed the Base Budget. Please adjust limits before restarting.",
		);
		return false;
	}

	const remaining = Math.max(0, baseBudget - totalAssigned);
	if (remaining > 0 && expenseCategories.length > 0) {
		await showUnallocatedBudgetInfo(remaining);
	}

	const categoriesToPass = keepCategories
		? state.categories.map((category) => {
				const copy = {
					name: category.name,
					type: category.type,
				};

				if (category.type !== "income") {
					copy.limit = category.limit;
				}

				return copy;
			})
		: [];

	await resetForNewMonth({
		month,
		baseBudget,
		categories: categoriesToPass,
	});

	showToast("Restart complete — new month set.");

	setTimeout(() => {
		window.location.href = "dashboard.html";
	}, 400);

	return true;
}

function showUnallocatedBudgetInfo(remaining) {
	return new Promise((resolve) => {
		const html = `
            <div class="mb-2">
                <p class="small">
                    You have $${remaining.toLocaleString(undefined, {
											minimumFractionDigits: 2,
											maximumFractionDigits: 2,
										})} unallocated from your base budget.
                    You can manually allocate this later from Settings or the Dashboard.
                </p>
            </div>
        `;

		showModal({
			title: "Unallocated budget",
			html,
			saveText: "OK",
			onSave: () => {
				resolve(true);
				return true;
			},
			onCancel: () => {
				resolve(true);
				return true;
			},
		});
	});
}

async function handleExportData() {
	const data = await exportData();
	const blob = new Blob([data], { type: "application/json" });
	const url = URL.createObjectURL(blob);

	const anchor = document.createElement("a");
	anchor.href = url;
	anchor.download = "pinch-budget-data.json";
	anchor.click();

	URL.revokeObjectURL(url);
	showToast("Data exported successfully.");
}

function handleImportData() {
	const input = document.createElement("input");
	input.type = "file";
	input.accept = ".json";

	input.addEventListener("change", async (event) => {
		const file = event.target.files?.[0];
		if (!file) return;

		const reader = new FileReader();
		reader.onload = async (loadEvent) => {
			const json = loadEvent.target?.result;
			const success = await importData(json);

			if (success) {
				showToast("Data imported successfully. Refreshing...");
				setTimeout(() => window.location.reload(), 1000);
			} else {
				alert("Failed to import data. Please check the file format.");
			}
		};

		reader.readAsText(file);
	});

	input.click();
}
