import { describe, expect, it } from "vitest";
import {
	simulateGifInvestment,
	simulateInvestment,
	simulateInvestmentSeries,
} from "../features/investment-projections.js";

describe("investment projections", () => {
	it("adds a contribution every 30 days without changing saved principal", () => {
		const result = simulateInvestment(1000, 0, 50, 365);

		expect(result.contributions).toBe(600);
		expect(result.earnings).toBeCloseTo(0, 8);
		expect(result.investedPrincipal).toBeCloseTo(1600, 8);
		expect(result.balance).toBeCloseTo(1600, 8);
	});

	it("reports and reinvests the first 90-day payout", () => {
		const quarter = simulateInvestment(1000, 3.49, 50, 90);
		const year = simulateInvestment(1000, 3.49, 50, 365);

		expect(quarter.nextQuarterPayout).toBeGreaterThan(0);
		expect(year.nextQuarterPayout).toBeCloseTo(quarter.nextQuarterPayout, 8);
		expect(quarter.investedPrincipal).toBeCloseTo(
			1150 + quarter.nextQuarterPayout,
			8,
		);
		expect(year.investedPrincipal).toBeGreaterThan(1000 + year.contributions);
		expect(year.balance).toBeCloseTo(
			year.investedPrincipal + year.earnings - year.reinvestedPayouts,
			8,
		);
		expect(year.earnings).toBeGreaterThan(quarter.nextQuarterPayout);
	});

	it("matches both TTIF example projections and exposes matching month 12", () => {
		const expected = [
			[3621, 1195.48, 5487.38, 185939.38],
			[4996, 1207.53, 5755.49, 202707.49],
		];

		for (const [contribution, payout, earnings, value] of expected) {
			const year = simulateInvestment(137000, 3.49, contribution, 365);
			const series = simulateInvestmentSeries(137000, 3.49, contribution, 12);
			expect(year.nextQuarterPayout).toBeCloseTo(payout, 2);
			expect(year.earnings).toBeCloseTo(earnings, 2);
			expect(year.balance).toBeCloseTo(value, 2);
			expect(series.monthlyBalances[12]).toBeCloseTo(year.balance, 8);
		}
	});

	it.each([
		[500, 73.72, 185.87, 9583.64],
		[0, 42.47, 85.48, 3483.25],
	])(
		"matches GIF projection with monthly contribution %s",
		(contribution, nextPayout, earnings, value) => {
			const result = simulateGifInvestment(3397.77, 2.5, contribution, 12);
			expect(Math.abs(result.nextPayout - nextPayout)).toBeLessThan(0.01);
			expect(Math.abs(result.earnings - earnings)).toBeLessThan(0.01);
			expect(Math.abs(result.projectedValue - value)).toBeLessThan(0.01);
			expect(result.monthlyBalances).toHaveLength(13);
			expect(result.monthlyBalances[12]).toBe(result.projectedValue);
		},
	);

	it("extends the GIF semiannual schedule beyond one year", () => {
		const result = simulateGifInvestment(1000, 2.5, 50, 24);
		expect(result.monthlyBalances).toHaveLength(25);
		expect(result.monthlyBalances[24]).toBe(result.projectedValue);
		expect(result.projectedValue).toBeGreaterThan(1000 + 24 * 50);
	});
});
