export function simulateInvestment(
	principal,
	annualRatePercent,
	monthlyContribution,
	days,
) {
	const startingPrincipal = Math.max(0, Number(principal) || 0);
	const annualRate = Math.max(0, Number(annualRatePercent) || 0);
	const contribution = Math.max(0, Number(monthlyContribution) || 0);
	const projectionDays = Math.max(0, Math.floor(Number(days) || 0));
	const dailyRate = Math.pow(1 + annualRate / 100, 1 / 365) - 1;

	let balance = startingPrincipal;
	let quarterOpeningBalance = startingPrincipal;
	let quarterContributions = 0;
	let totalContributions = 0;
	let totalEarnings = 0;
	let reinvestedPayouts = 0;
	let nextQuarterPayout = 0;

	for (let day = 1; day <= projectionDays; day += 1) {
		if (day % 30 === 0) {
			balance += contribution;
			quarterContributions += contribution;
			totalContributions += contribution;
		}

		const dailyEarnings = balance * dailyRate;
		balance += dailyEarnings;
		totalEarnings += dailyEarnings;

		if (day % 90 === 0) {
			const payout = Math.max(
				0,
				balance - quarterOpeningBalance - quarterContributions,
			);
			if (day === 90) nextQuarterPayout = payout;
			reinvestedPayouts += payout;
			quarterOpeningBalance = balance;
			quarterContributions = 0;
		}
	}

	return {
		balance,
		contributions: totalContributions,
		investedPrincipal:
			startingPrincipal + totalContributions + reinvestedPayouts,
		earnings: totalEarnings,
		reinvestedPayouts,
		nextQuarterPayout,
	};
}

export function simulateInvestmentSeries(
	principal,
	annualRatePercent,
	monthlyContribution,
	months = 12,
) {
	const startingPrincipal = Math.max(0, Number(principal) || 0);
	const annualRate = Math.max(0, Number(annualRatePercent) || 0);
	const contribution = Math.max(0, Number(monthlyContribution) || 0);
	const monthCount = Math.max(0, Math.floor(Number(months) || 0));
	const dailyRate = Math.pow(1 + annualRate / 100, 1 / 365) - 1;
	const finalDay =
		monthCount <= 12
			? monthCount === 12
				? 365
				: monthCount * 30
			: 365 + (monthCount - 12) * 30;
	const captureDays = new Map();
	for (let month = 1; month <= monthCount; month += 1) {
		captureDays.set(month <= 11 ? month * 30 : 365 + (month - 12) * 30, month);
	}

	let balance = startingPrincipal;
	let quarterOpeningBalance = startingPrincipal;
	let quarterContributions = 0;
	let totalContributions = 0;
	let totalEarnings = 0;
	let reinvestedPayouts = 0;
	let nextQuarterPayout = 0;
	const monthlyBalances = [startingPrincipal];

	for (let day = 1; day <= finalDay; day += 1) {
		if (day % 30 === 0) {
			balance += contribution;
			quarterContributions += contribution;
			totalContributions += contribution;
		}

		const dailyEarnings = balance * dailyRate;
		balance += dailyEarnings;
		totalEarnings += dailyEarnings;

		if (day % 90 === 0) {
			const payout = Math.max(
				0,
				balance - quarterOpeningBalance - quarterContributions,
			);
			if (day === 90) nextQuarterPayout = payout;
			reinvestedPayouts += payout;
			quarterOpeningBalance = balance;
			quarterContributions = 0;
		}

		const month = captureDays.get(day);
		if (month) monthlyBalances[month] = balance;
	}

	return {
		balance,
		contributions: totalContributions,
		investedPrincipal:
			startingPrincipal + totalContributions + reinvestedPayouts,
		earnings: totalEarnings,
		reinvestedPayouts,
		nextQuarterPayout,
		monthlyBalances,
	};
}

export function simulateGifInvestment(
	principal,
	distributionYieldPercent,
	monthlyContribution,
	months = 12,
) {
	const startingPrincipal = Math.max(0, Number(principal) || 0);
	const annualYield = Math.max(0, Number(distributionYieldPercent) || 0);
	const contribution = Math.max(0, Number(monthlyContribution) || 0);
	const monthCount = Math.max(0, Math.floor(Number(months) || 0));
	const semiAnnualRate = annualYield / 200;
	let balance = startingPrincipal;
	let distributions = 0;
	let nextPayout = 0;
	const monthlyBalances = [startingPrincipal];

	for (let month = 1; month <= monthCount; month += 1) {
		if (month % 6 === 0) {
			const payout = balance * semiAnnualRate;
			balance += payout;
			distributions += payout;
			if (month === 6) nextPayout = payout;
		}

		balance += contribution;
		monthlyBalances[month] = balance;
	}

	const contributions = contribution * monthCount;
	return {
		contributions,
		distributions,
		earnings: distributions,
		growth: 0,
		nextPayout,
		projectedValue: balance,
		monthlyBalances,
	};
}
