import { getState, saveState } from "../cloud-storage.js";
import { showModal } from "../components/modal.js";
import { showToast } from "../components/toast.js";
import {
	simulateGifInvestment,
	simulateInvestmentSeries,
} from "../features/investment-projections.js";

const UNIT_PRICE = 20;
let investmentHandlersBound = false;
let latestState = null;

export async function initInvestments() {
	if (!investmentHandlersBound) bindInvestmentHandlers();
	latestState = await getState();
	initializeSliders();
	renderInvestments();
}

function bindInvestmentHandlers() {
	document
		.getElementById("edit-investment")
		?.addEventListener("click", openInvestmentEditor);
	document.getElementById("edit-gif")?.addEventListener("click", openGifEditor);
	document
		.getElementById("investment-extra")
		?.addEventListener("input", renderProjections);
	document
		.getElementById("gif-extra")
		?.addEventListener("input", renderProjections);
	document
		.getElementById("edit-portfolio-goal")
		?.addEventListener("click", openGoalEditor);
	document
		.getElementById("investment-extra")
		?.addEventListener("change", persistSliderValues);
	document
		.getElementById("investment-match-savings")
		?.addEventListener("click", matchSavingsContribution);
	document
		.getElementById("gif-extra")
		?.addEventListener("change", persistSliderValues);
	investmentHandlersBound = true;
}

window.initInvestments = initInvestments;

function initializeSliders() {
	const savings = getCurrentSavings(latestState);
	const ttifSlider = document.getElementById("investment-extra");
	const ttifMaximum = Math.max(10000, savings * 2);
	ttifSlider.min = "0";
	ttifSlider.max = String(ttifMaximum);
	ttifSlider.step = "50";
	ttifSlider.value = String(
		latestState.meta.investments.monthlyContribution ?? savings,
	);

	const gifSlider = document.getElementById("gif-extra");
	gifSlider.min = "0";
	gifSlider.max = "5000";
	gifSlider.step = "50";
	gifSlider.value = String(latestState.meta.gif.monthlyContribution);
}

function renderInvestments() {
	renderInvestmentSummary();
	renderProjections();
}

function renderInvestmentSummary() {
	const investments = latestState.meta.investments;
	const gif = latestState.meta.gif;
	const principal = Number(investments.principal || 0);
	const gifPrincipal = Number(gif.principal || 0);
	const currentTotal = principal + gifPrincipal;
	const goal = Number(latestState.meta.portfolioGoal);
	const progress = Math.min(100, (currentTotal / goal) * 100);

	document.getElementById("investment-principal-summary").textContent =
		formatCurrency(principal);
	document.getElementById("gif-current-value-summary").textContent =
		formatCurrency(gifPrincipal);
	document.getElementById("ttif-current-value").textContent =
		formatCurrency(principal);
	document.getElementById("gif-current-value").textContent =
		formatCurrency(gifPrincipal);
	document.getElementById("portfolio-current-value").textContent =
		formatCurrency(currentTotal);
	document.getElementById("portfolio-goal-value").textContent =
		formatCurrency(goal);
	document.getElementById("portfolio-progress-bar").style.width =
		`${progress}%`;
	document
		.querySelector(".investment-summary .progress")
		.setAttribute("aria-valuenow", String(Math.round(progress)));
	document.getElementById("portfolio-progress-percent").textContent =
		`${Math.floor(progress)}%`;
	return { currentTotal, goal };
}

function openInvestmentEditor() {
	const investments = latestState?.meta?.investments || {};
	const modal = showModal({
		title: "Edit investment details",
		html: `
			<div class="mb-3">
				<label for="edit-investment-principal" class="form-label">Current principal (TT$)</label>
				<input id="edit-investment-principal" type="number" min="0" step="0.01" class="form-control" value="${Number(investments.principal || 0)}" required />
			</div>
			<div class="mb-3">
				<label for="edit-investment-rate" class="form-label">Annual rate (%)</label>
				<input id="edit-investment-rate" type="number" min="0" step="0.01" class="form-control" value="${Number(investments.annualRatePercent ?? 3.49)}" required />
			</div>
			<div class="mb-2">
				<label for="edit-investment-units" class="form-label">Units held at TT$20</label>
				<input id="edit-investment-units" type="text" class="form-control" value="${formatUnits(Number(investments.principal || 0) / UNIT_PRICE)}" readonly />
			</div>
		`,
		saveText: "Save details",
		onSave: saveInvestmentDetails,
	});
	modal
		.querySelector("#edit-investment-principal")
		?.addEventListener("input", (event) => {
			modal.querySelector("#edit-investment-units").value = formatUnits(
				Number(event.target.value || 0) / UNIT_PRICE,
			);
		});
}

function openGifEditor() {
	const gif = latestState?.meta?.gif || {};
	showModal({
		title: "Edit GIF details",
		html: `
			<div class="mb-3">
				<label for="edit-gif-value" class="form-label">Current principal (TT$)</label>
				<input id="edit-gif-value" type="number" min="0" step="0.01" class="form-control" value="${Number(gif.principal || 0)}" required />
			</div>
			<div class="mb-3">
				<label for="edit-gif-yield" class="form-label">Distribution yield (%) per year</label>
				<input id="edit-gif-yield" type="number" min="0" max="100" step="0.01" class="form-control" value="${Number(gif.distributionYieldPercent ?? 2.5)}" required />
			</div>
		`,
		saveText: "Save details",
		onSave: saveGifDetails,
	});
}

async function saveGifDetails() {
	const principal = Number(document.getElementById("edit-gif-value")?.value);
	const distributionYieldPercent = Number(
		document.getElementById("edit-gif-yield")?.value,
	);
	if (
		!Number.isFinite(principal) ||
		principal < 0 ||
		!Number.isFinite(distributionYieldPercent) ||
		distributionYieldPercent < 0 ||
		distributionYieldPercent > 100
	) {
		alert("Enter a non-negative principal and a yield from 0% to 100%.");
		return false;
	}

	const state = await getState();
	state.meta.gif = { ...state.meta.gif, principal, distributionYieldPercent };
	if (!(await saveState(state))) {
		alert("Could not save GIF details.");
		return false;
	}

	latestState = state;
	renderInvestments();
	showToast("GIF details saved.");
	return true;
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
	state.meta.investments = {
		...state.meta.investments,
		principal,
		annualRatePercent,
	};
	if (!(await saveState(state))) {
		alert("Could not save investment details.");
		return false;
	}

	latestState = state;
	renderInvestments();
	showToast("Investment details saved.");
	return true;
}

function getCurrentSavings(state) {
	const expenses = (state.transactions || [])
		.filter(
			(transaction) =>
				transaction.type === "expense" &&
				!transaction.bankPool &&
				(!state.meta?.month ||
					String(transaction.date || "").startsWith(`${state.meta.month}-`)),
		)
		.reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);
	return Math.max(0, Number(state.meta?.baseBudget || 0) - expenses);
}

function getProjections(months = 12) {
	const state = latestState;
	const ttifSlider = document.getElementById("investment-extra");
	const gifSlider = document.getElementById("gif-extra");
	const savings = getCurrentSavings(state);
	const ttifContribution = Number(ttifSlider.value);
	const gifContribution = Number(gifSlider.value);
	const ttif = simulateInvestmentSeries(
		state.meta.investments.principal,
		state.meta.investments.annualRatePercent,
		ttifContribution,
		months,
	);
	const gif = simulateGifInvestment(
		state.meta.gif.principal,
		state.meta.gif.distributionYieldPercent,
		gifContribution,
		months,
	);
	const combinedSeries = ttif.monthlyBalances.map(
		(balance, month) => balance + gif.monthlyBalances[month],
	);
	return {
		savings,
		ttif: {
			...ttif,
			contribution: ttifContribution,
			yearValue: ttif.monthlyBalances[12] ?? ttif.balance,
		},
		gif: {
			...gif,
			contribution: gifContribution,
			yearValue: gif.monthlyBalances[12] ?? gif.projectedValue,
		},
		combinedSeries,
	};
}

function renderProjections() {
	if (!latestState) return;
	const projections = getProjections(120);
	const yearProjections = getProjections(12);
	const principal = Number(latestState.meta.investments.principal || 0);
	const gifPrincipal = Number(latestState.meta.gif.principal || 0);
	const currentTotal = principal + gifPrincipal;
	const ttifContribution = projections.ttif.contribution;
	const adjustment = ttifContribution - projections.savings;
	const adjustmentElement = document.getElementById("investment-extra-label");

	document.getElementById("investment-surplus-label").textContent =
		`Savings: ${formatCurrency(projections.savings)}`;
	document.getElementById("investment-contribution-total").textContent =
		formatCurrency(ttifContribution);
	adjustmentElement.textContent = `${adjustment > 0 ? "+" : adjustment < 0 ? "−" : ""}${formatCurrency(Math.abs(adjustment))}`;
	adjustmentElement.classList.toggle("text-success", adjustment > 0);
	adjustmentElement.classList.toggle("text-danger", adjustment < 0);
	adjustmentElement.classList.toggle("text-secondary", adjustment === 0);
	document.getElementById("gif-contribution-label").textContent =
		formatCurrency(projections.gif.contribution);
	document.getElementById("investment-quarter-payout").textContent =
		formatCurrency(projections.ttif.nextQuarterPayout);
	document.getElementById("investment-year-earnings").textContent =
		formatCurrency(projections.ttif.earnings);
	document.getElementById("investment-year-value").textContent = formatCurrency(
		yearProjections.ttif.yearValue,
	);
	document.getElementById("gif-next-payout").textContent = formatCurrency(
		projections.gif.nextPayout,
	);
	document.getElementById("gif-year-earnings").textContent = formatCurrency(
		projections.gif.earnings,
	);
	document.getElementById("gif-year-value").textContent = formatCurrency(
		yearProjections.gif.yearValue,
	);

	const totalValue = currentTotal;
	const goal = Number(latestState.meta.portfolioGoal);
	const progress = Math.min(100, (totalValue / goal) * 100);
	document.getElementById("portfolio-progress-bar").style.width =
		`${progress}%`;
	document
		.querySelector(".investment-summary .progress")
		.setAttribute("aria-valuenow", String(Math.round(progress)));
	document.getElementById("portfolio-progress-percent").textContent =
		`${Math.floor(progress)}%`;
	document.getElementById("portfolio-months-to-goal").textContent =
		getMonthsToGoal(projections.combinedSeries, goal, totalValue);
	document.getElementById("portfolio-monthly-contribution").textContent =
		formatCurrency(ttifContribution + projections.gif.contribution);
	document.getElementById("combined-year-value").textContent = formatCurrency(
		yearProjections.ttif.yearValue + yearProjections.gif.yearValue,
	);
	renderChart(
		projections.ttif.monthlyBalances.slice(0, 13),
		projections.gif.monthlyBalances.slice(0, 13),
		goal,
	);
}

function getMonthsToGoal(series, goal, currentValue) {
	if (currentValue >= goal) return "Goal reached";
	const month = series.findIndex((value, index) => index > 0 && value >= goal);
	return month > 0 ? `~${month} months to goal` : "10+ years";
}

function renderChart(ttifSeries, gifSeries, goal) {
	const svgContent = document.getElementById("investment-chart-content");
	const width = 720;
	const height = 240;
	const left = 76;
	const right = 18;
	const top = 14;
	const bottom = 32;
	const chartWidth = width - left - right;
	const chartHeight = height - top - bottom;
	const totals = ttifSeries.map((value, month) => value + gifSeries[month]);
	const maxValue = Math.max(goal, ...totals, 1) * 1.08;
	const x = (month) => left + (month / 12) * chartWidth;
	const y = (value) => top + chartHeight - (value / maxValue) * chartHeight;
	const areaPath = (values) =>
		`M ${x(0)} ${y(0)} L ${values.map((value, month) => `${x(month)} ${y(value)}`).join(" L ")} L ${x(12)} ${y(0)} Z`;
	const stackedGifPath = `M ${ttifSeries.map((value, month) => `${x(month)} ${y(value)}`).join(" L ")} L ${totals
		.slice()
		.reverse()
		.map((value, offset) => `${x(12 - offset)} ${y(value)}`)
		.join(" L ")} Z`;
	const grid = [0, 0.5, 1]
		.map((fraction) => {
			const value = maxValue * fraction;
			return `<line x1="${left}" y1="${y(value)}" x2="${width - right}" y2="${y(value)}" class="chart-grid"/><text x="${left - 8}" y="${y(value) + 4}" text-anchor="end" class="chart-axis-label">${escapeHtml(formatCurrency(value))}</text>`;
		})
		.join("");
	const monthLabels = [0, 3, 6, 9, 12]
		.map(
			(month) =>
				`<text x="${x(month)}" y="${height - 8}" text-anchor="middle" class="chart-axis-label">${month}</text>`,
		)
		.join("");
	const goalLine = `<line x1="${left}" y1="${y(goal)}" x2="${width - right}" y2="${y(goal)}" class="chart-goal-line"/>`;
	const ttifArea = `<path d="${areaPath(ttifSeries)}" class="chart-ttif-area" fill="rgba(99, 102, 241, 0.2)" stroke="#6366f1" stroke-width="2"/>`;
	const gifArea = `<path d="${stackedGifPath}" class="chart-gif-area" fill="rgba(16, 145, 112, 0.2)" stroke="#109170" stroke-width="2"/>`;
	const xAxis = `<line x1="${left}" y1="${y(0)}" x2="${width - right}" y2="${y(0)}" class="chart-axis"/>`;
	svgContent.innerHTML = `${grid}${ttifArea}${gifArea}${goalLine}${xAxis}${monthLabels}`;
	document
		.getElementById("investment-chart")
		.setAttribute(
			"aria-label",
			`Stacked TTIF and GIF monthly projection with a goal of ${formatCurrency(goal)}`,
		);
}

async function persistSliderValues() {
	const state = await getState();
	state.meta.investments.monthlyContribution = Number(
		document.getElementById("investment-extra").value,
	);
	state.meta.gif.monthlyContribution = Number(
		document.getElementById("gif-extra").value,
	);
	if (!(await saveState(state))) {
		showToast("Could not save investment slider values.");
		return;
	}
	latestState = state;
}

async function matchSavingsContribution() {
	const savings = getCurrentSavings(latestState);
	document.getElementById("investment-extra").value = String(savings);
	renderProjections();
	await persistSliderValues();
}

function openGoalEditor() {
	showModal({
		title: "Edit portfolio goal",
		html: `<label for="edit-portfolio-goal-value" class="form-label">Goal (TT$)</label><input id="edit-portfolio-goal-value" class="form-control" type="number" min="0.01" step="0.01" value="${Number(latestState.meta.portfolioGoal)}" required />`,
		saveText: "Save goal",
		onSave: savePortfolioGoal,
	});
}

async function savePortfolioGoal() {
	const goal = Number(
		document.getElementById("edit-portfolio-goal-value")?.value,
	);
	if (!Number.isFinite(goal) || goal <= 0) {
		alert("Enter a goal greater than zero.");
		return false;
	}
	const state = await getState();
	state.meta.portfolioGoal = goal;
	if (!(await saveState(state))) {
		alert("Could not save the portfolio goal.");
		return false;
	}
	latestState = state;
	renderInvestments();
	return true;
}

function formatMoney(value) {
	return Number(value || 0).toLocaleString(undefined, {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	});
}

function formatCurrency(value) {
	return `TT$${formatMoney(value)}`;
}

function escapeHtml(value) {
	return String(value)
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#39;");
}

function formatUnits(value) {
	return Number(value || 0).toLocaleString(undefined, {
		minimumFractionDigits: 3,
		maximumFractionDigits: 3,
	});
}
