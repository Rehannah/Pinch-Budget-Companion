import { describe, expect, it } from "vitest";
import { simulateInvestment } from "../features/investment-projections.js";

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
});
