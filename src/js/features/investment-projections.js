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
