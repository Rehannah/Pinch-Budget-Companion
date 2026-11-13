import { getState, saveState } from "../cloud-storage.js";
import { showModal } from "../components/modal.js";
import { getDebtCategoryKind } from "../features/debt-categories.js";

let debtHandlersBound = false;

export async function initDebts() {
	const state = await getState();
	renderDebts(state);

	if (!debtHandlersBound) {
		document
			.getElementById("debt-rows")
			?.addEventListener("change", savePreviousOwing);
		document
			.getElementById("debt-rows")
			?.addEventListener("click", deleteDebtPerson);
		document
			.getElementById("debt-add-person")
			?.addEventListener("click", addDebtPerson);
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
					<td data-label="Previously owing"><input class="form-control form-control-sm debt-previous" type="number" step="0.01" data-person="${escapeHtml(person)}" value="${values.previous.toFixed(2)}" aria-label="Previously owing for ${escapeHtml(person)}" /></td>
					<td data-label="Owing this month">$${formatMoney(values.owed)}</td>
					<td data-label="Repaid this month">$${formatMoney(values.repaid)}</td>
					<td data-label="Balance" class="fw-semibold ${balance < 0 ? "text-success" : ""}">$${formatMoney(balance)}</td>
					<td data-label="Actions">
						<button class="btn btn-link btn-sm text-danger p-0 debt-delete-person" type="button" data-person="${escapeHtml(person)}">Delete</button>
					</td>
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

async function deleteDebtPerson(event) {
	const button = event.target.closest(".debt-delete-person");
	if (!button) return;

	const person = button.dataset.person;
	if (
		!window.confirm(
			`Delete ${person} and all of their debt entries from the transaction history?`,
		)
	)
		return;

	const state = await getState();
	const balances = { ...(state.meta?.debtPreviousBalances || {}) };
	delete balances[person];
	state.meta.debtPreviousBalances = balances;
	const categoryNames = new Map(
		(state.categories || []).map((category) => [category.id, category.name]),
	);
	state.transactions = (state.transactions || []).filter((transaction) => {
		if (!getDebtCategoryKind(categoryNames.get(transaction.categoryId))) {
			return true;
		}
		return (
			getTransactionPerson(transaction)?.toLowerCase() !== person.toLowerCase()
		);
	});
	if (!(await saveState(state))) {
		alert("Could not delete the person and their debt entries.");
		return;
	}
	renderDebts(state);
}

async function addDebtPerson() {
	showModal({
		title: "Add person to debts",
		html: `
			<div class="mb-3">
				<label for="debt-person-name" class="form-label">Person's name</label>
				<input id="debt-person-name" type="text" class="form-control" maxlength="80" autocomplete="name" required />
			</div>
			<div class="mb-2">
				<label for="debt-person-opening" class="form-label">Opening amount (TT$)</label>
				<input id="debt-person-opening" type="number" class="form-control" min="0" step="0.01" value="0.00" required />
			</div>
		`,
		saveText: "Add person",
		onSave: saveNewDebtPerson,
	});
}

async function saveNewDebtPerson() {
	const normalizedPerson = document
		.getElementById("debt-person-name")
		?.value.trim();
	const openingText = document.getElementById("debt-person-opening")?.value;
	const openingAmount = Number(openingText);
	if (!normalizedPerson) {
		alert("Enter a person's name.");
		return false;
	}
	if (
		openingText === "" ||
		!Number.isFinite(openingAmount) ||
		openingAmount < 0
	) {
		alert("Enter a non-negative opening amount.");
		return false;
	}

	const state = await getState();
	const balances = { ...(state.meta?.debtPreviousBalances || {}) };
	const existingPerson = Object.keys(balances).find(
		(name) => name.toLowerCase() === normalizedPerson.toLowerCase(),
	);
	if (existingPerson) {
		alert("That person already has an opening balance.");
		return false;
	}
	balances[normalizedPerson] = openingAmount;
	state.meta.debtPreviousBalances = balances;
	if (!(await saveState(state))) {
		alert("Could not add the person.");
		return false;
	}
	renderDebts(state);
	return true;
}

function getTransactionPerson(transaction) {
	const match = String(transaction.description || "").match(
		/\[([^\]]+)\]|\{([^}]+)\}/,
	);
	return (match?.[1] || match?.[2] || "").trim();
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
