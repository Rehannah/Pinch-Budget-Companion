import {
	getState,
	resetForNewMonth,
	exportData,
	importData,
} from "../cloud-storage.js";
import { showModal } from "../components/modal.js";
import { showToast } from "../components/toast.js";

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
			Transactions for the month are cleared. Categories and limits are optional to carry forward. Investment settings and debt opening balances are retained.
        </div>
    `;

	showModal({
		title: "Restart for new month",
		html,
		saveText: "Restart",
		onSave: async () => {
			const form = readRestartForm();
			if (!form) return false;

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
	};
}

async function handleMonthlyRestart({ month, baseBudget, keepCategories }) {
	const state = await getState();
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
