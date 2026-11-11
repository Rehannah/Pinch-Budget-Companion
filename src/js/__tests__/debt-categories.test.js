import { describe, expect, it } from "vitest";
import { getDebtCategoryKind } from "../features/debt-categories.js";

describe("debt category classification", () => {
	it.each([
		"Debt owed to me",
		"Debt owed to me: Other",
		"Debt owed to me: Siblings",
		"Debt owed to me: Parent",
		"Personal Debt Owed To Me",
	])("classifies %s as owed", (name) => {
		expect(getDebtCategoryKind(name)).toBe("owed");
	});

	it("still recognizes the repayment category", () => {
		expect(getDebtCategoryKind("Debts repaid to me")).toBe("repaid");
	});

	it("ignores unrelated categories", () => {
		expect(getDebtCategoryKind("Debt repayments")).toBeNull();
	});
});
