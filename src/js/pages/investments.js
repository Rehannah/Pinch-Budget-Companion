import { getState, saveState } from "../cloud-storage.js";
import { showModal } from "../components/modal.js";
import { showToast } from "../components/toast.js";
import { simulateInvestment } from "../features/investment-projections.js";

const UNIT_PRICE = 20;
let investmentHandlersBound = false;
let latestState = null;

export async function initInvestments() {
	latestState = await getState();
	renderInvestmentSummary();
	renderProjections();

	if (!investmentHandlersBound) {
		document
			.getElementById("edit-investment")
			?.addEventListener("click", openInvestmentEditor);
		document
			.getElementById("investment-extra")
			?.addEventListener("input", renderProjections);
		investmentHandlersBound = true;
	}
}

window.initInvestments = initInvestments;

function renderInvestmentSummary() {
	const investments = latestState?.meta?.investments || {};
	const principal = Number(investments.principal || 0);
	const annualRatePercent = Number(investments.annualRatePercent ?? 3.49);

	document.getElementById("investment-principal-summary").textContent =
		`TT$${formatMoney(principal)}`;
	document.getElementById("investment-rate-summary").textContent =
		`${annualRatePercent.toFixed(2)}%`;
	document.getElementById("investment-units-summary").textContent = formatUnits(
		principal / UNIT_PRICE,
	);
}

function openInvestmentEditor() {
	const investments = latestState?.meta?.investments || {};
	showModal({
		title: "Edit investment details",
		html: `
			<div class="mb-3">
				<label for="edit-investment-principal" class="form-label small">Current principal (TT$)</label>
				<input id="edit-investment-principal" type="number" min="0" step="0.01" class="form-control" value="${Number(investments.principal || 0)}" required />
			</div>
			<div class="mb-3">
				<label for="edit-investment-rate" class="form-label small">Annual rate (%)</label>
				<input id="edit-investment-rate" type="number" min="0" step="0.01" class="form-control" value="${Number(investments.annualRatePercent ?? 3.49)}" required />
			</div>
			<p class="small text-muted mb-0">TTIF unit price is fixed at TT$20. Units held are calculated automatically.</p>
		`,
		saveText: "Save details",
		onSave: saveInvestmentDetails,
	});
}

async function saveInvestmentDetails() {
	const principal = Number(
		document.getElementById("edit-investment-principal")?.value,
	);
	const annualRatePercent = Number(
		document.getElementById("edit-investment-rate")?.value,
	);

	if (
		!Number.isFinite(principal) ||
		principal < 0 ||
		!Number.isFinite(annualRatePercent) ||
		annualRatePercent < 0
	) {
		alert("Enter a non-negative principal and annual rate.");
		return false;
	}

	const state = await getState();
	state.meta.investments = { principal, annualRatePercent };
	if (!(await saveState(state))) {
		alert("Could not save investment details.");
		return false;
	}

	latestState = state;
	renderInvestmentSummary();
	renderProjections();
	showToast("Investment details saved.");
	return true;
}

function renderProjections() {
	if (!latestState) return;
	const state = latestState;
	const investments = state.meta?.investments || {};
	const principal = Number(investments.principal || 0);
	const annualRatePercent = Number(investments.annualRatePercent ?? 3.49);
	const baseBudget = Number(state.meta?.baseBudget || 0);
	const countedExpenses = (state.transactions || [])
		.filter(
			(transaction) =>
				transaction.type === "expense" &&
				!transaction.bankPool &&
				(!state.meta?.month ||
					String(transaction.date || "").startsWith(`${state.meta.month}-`)),
		)
		.reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);
	const budgetSavings = baseBudget - countedExpenses;
	const hypotheticalIncrease = Number(
		document.getElementById("investment-extra")?.value || 0,
	);
	const potentialContribution = Math.max(
		0,
		budgetSavings + hypotheticalIncrease,
	);

	document.getElementById("investment-extra").max = String(
		Math.max(1000, baseBudget),
	);
	document.getElementById("investment-surplus-label").textContent =
		`Current Savings: TT$${formatMoney(budgetSavings)}`;
	document.getElementById("investment-extra-label").textContent =
		`Hypothetical increase: TT$${formatMoney(hypotheticalIncrease)}`;
	document.getElementById("investment-contribution-total").textContent =
		`TT$${formatMoney(potentialContribution)}`;

	const quarter = simulateInvestment(
		principal,
		annualRatePercent,
		potentialContribution,
		90,
	);
	const year = simulateInvestment(
		principal,
		annualRatePercent,
		potentialContribution,
		365,
	);
	document.getElementById("investment-quarter-payout").textContent =
		`TT$${formatMoney(quarter.nextQuarterPayout)}`;
	document.getElementById("investment-year-principal").textContent =
		`TT$${formatMoney(year.investedPrincipal)}`;
	document.getElementById("investment-year-earnings").textContent =
		`TT$${formatMoney(year.earnings)}`;
	document.getElementById("investment-year-value").textContent =
		`Projected one-year value: TT$${formatMoney(year.balance)}`;
	document.getElementById("investment-monthly-income").textContent =
		`TT$${formatMoney(year.earnings / 12)}`;
}

function formatMoney(value) {
	return Number(value || 0).toLocaleString(undefined, {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	});
}

function formatUnits(value) {
	return Number(value || 0).toLocaleString(undefined, {
		minimumFractionDigits: 3,
		maximumFractionDigits: 3,
	});
}
