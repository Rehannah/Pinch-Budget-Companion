import { getState, updateCategory } from "../cloud-storage.js";

export async function showBudgetWarningBanner() {
	try {
		const state = await getState();
		if (!state) return;

		const base = Number(state.meta?.baseBudget || 0);
		const totalAssigned = (state.categories || [])
			.filter((c) => c.type !== "income")
			.reduce((s, c) => s + Number(c.limit || 0), 0);

		const existing = document.getElementById("budget-mismatch-banner");

		if (base > 0 && totalAssigned > base) {
			if (existing) existing.remove();

			const diff = totalAssigned - base;
			const banner = document.createElement("div");
			banner.id = "budget-mismatch-banner";
			banner.className =
				"alert alert-danger d-flex justify-content-between align-items-center";
			banner.style.position = "sticky";
			banner.style.top = "0";
			banner.style.zIndex = 1050;
			banner.innerHTML = `<div class="small">Warning: your expense category limits total <strong>$${totalAssigned.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>, which exceeds your Base Budget <strong>$${base.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong> by <strong>$${diff.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>. Adjust limits or transactions.</div><div><button id="dismiss-budget-mismatch" class="btn btn-sm btn-secondary me-2">Dismiss</button></div>`;

			const headerEl = document.getElementById("app-header");
			if (headerEl && headerEl.parentNode) {
				headerEl.parentNode.insertBefore(banner, headerEl.nextSibling);
			} else {
				document.body.insertBefore(banner, document.body.firstChild);
			}

			banner
				.querySelector("#dismiss-budget-mismatch")
				?.addEventListener("click", () => banner.remove());
		} else if (existing) {
			existing.remove();
		}
	} catch (e) {
		console.warn("showBudgetWarningBanner error", e);
	}
}

export async function showUnallocatedBanner() {
	try {
		const state = await getState();
		if (!state) return;

		const base = Number(state.meta?.baseBudget || 0);
		const totalAssigned = (state.categories || [])
			.filter((c) => c.type !== "income")
			.reduce((s, c) => s + Number(c.limit || 0), 0);

		const remaining = Math.max(0, base - totalAssigned);
		const existing = document.getElementById("unallocated-banner");

		if (base > 0 && remaining > 0) {
			if (existing) existing.remove();

			const banner = document.createElement("div");
			banner.id = "unallocated-banner";
			banner.className =
				"alert alert-warning d-flex justify-content-between align-items-center";
			banner.innerHTML = `<div class="small">You have $${remaining.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} of your base budget unallocated.</div><div><button id="redistribute-btn" class="btn btn-sm btn-outline-primary me-2">Redistribute</button><button id="dismiss-unalloc" class="btn btn-sm btn-secondary">Dismiss</button></div>`;

			const container = document.querySelector(".container");
			const firstSection = container?.querySelector("section");

			if (firstSection && firstSection.parentNode) {
				firstSection.parentNode.insertBefore(banner, firstSection.nextSibling);
			} else if (container) {
				container.insertBefore(banner, container.firstChild);
			} else {
				document.body.insertBefore(banner, document.body.firstChild);
			}

			banner
				.querySelector("#dismiss-unalloc")
				?.addEventListener("click", () => banner.remove());

			banner
				.querySelector("#redistribute-btn")
				?.addEventListener("click", () => {
					console.info("Redistribute action clicked");
				});
		} else if (existing) {
			existing.remove();
		}
	} catch (e) {
		console.warn("showUnallocatedBanner error", e);
	}
}
