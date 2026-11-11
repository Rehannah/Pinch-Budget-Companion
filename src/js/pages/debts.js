import { getState, saveState } from "../cloud-storage.js";
import { getDebtCategoryKind } from "../features/debt-categories.js";

let debtHandlersBound = false;

export async function initDebts() {
	const state = await getState();
	renderDebts(state);

	if (!debtHandlersBound) {
		document
			.getElementById("debt-rows")
			?.addEventListener("change", savePreviousOwing);
		debtHandlersBound = true;
	}
}

window.initDebts = initDebts;

function renderDebts(state) {
	const rowsElement = document.getElementById("debt-rows");
	if (!rowsElement) return;

	const balances = state.meta?.debtPreviousBalances || {};
	const people = new Map(
		Object.entries(balances).map(([person, previous]) => [
			person,
			{
				previous: Number(previous) || 0,
				owed: 0,
				repaid: 0,
			},
		]),
	);
	const categoryNames = new Map(
		(state.categories || []).map((category) => [
			category.id,
			String(category.name || "")
				.trim()
				.toLowerCase(),
		]),
	);

	for (const transaction of state.transactions || []) {
		if (
			state.meta?.month &&
			!String(transaction.date || "").startsWith(`${state.meta.month}-`)
		) {
			continue;
		}

		const categoryKind = getDebtCategoryKind(
			categoryNames.get(transaction.categoryId),
		);
		if (!categoryKind) continue;

		const personMatch = String(transaction.description || "").match(
			/\[([^\]]+)\]|\{([^}]+)\}/,
		);
		const person = (personMatch?.[1] || personMatch?.[2] || "").trim();
		if (!person) continue;

		if (!people.has(person))
			people.set(person, { previous: 0, owed: 0, repaid: 0 });
		const row = people.get(person);
		if (categoryKind === "owed") row.owed += Number(transaction.amount || 0);
		else row.repaid += Number(transaction.amount || 0);
	}

	const sortedPeople = Array.from(people.entries()).sort(([a], [b]) =>
		a.localeCompare(b),
	);
	rowsElement.innerHTML = sortedPeople
		.map(([person, values]) => {
			const balance = values.previous + values.owed - values.repaid;
			return `
			<tr>
				<th scope="row">${escapeHtml(person)}</th>
				<td><input class="form-control form-control-sm debt-previous" type="number" step="0.01" data-person="${escapeHtml(person)}" value="${values.previous.toFixed(2)}" aria-label="Previously owing for ${escapeHtml(person)}" /></td>
				<td>$${formatMoney(values.owed)}</td>
				<td>$${formatMoney(values.repaid)}</td>
				<td class="fw-semibold ${balance < 0 ? "text-success" : ""}">$${formatMoney(balance)}</td>
			</tr>
		`;
		})
		.join("");

	document
		.getElementById("debt-empty")
		?.classList.toggle("d-none", sortedPeople.length > 0);
	const monthLabel = document.getElementById("debt-month");
	if (monthLabel)
		monthLabel.textContent = state.meta?.month || "No budget month set";
}

async function savePreviousOwing(event) {
	const input = event.target.closest(".debt-previous");
	if (!input) return;

	const amount = Number(input.value);
	if (!Number.isFinite(amount)) {
		alert("Previously owing must be a valid number.");
		return;
	}

	const person = input.dataset.person;
	const state = await getState();
	state.meta.debtPreviousBalances = {
		...(state.meta.debtPreviousBalances || {}),
		[person]: amount,
	};
	if (!(await saveState(state)))
		alert("Could not save the previous debt balance.");
}

function formatMoney(value) {
	return Number(value || 0).toLocaleString(undefined, {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
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
