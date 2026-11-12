import { beforeEach, describe, expect, it, vi } from "vitest";

const firestore = vi.hoisted(() => ({
	auth: { currentUser: { uid: "test-user" } },
	doc: vi.fn((...parts) => ({ parts })),
	getDoc: vi.fn(),
	setDoc: vi.fn(),
	serverTimestamp: vi.fn(() => "server-timestamp"),
}));

vi.mock("../firebase-config.js", () => ({ db: {}, auth: firestore.auth }));
vi.mock("firebase/firestore", () => ({
	doc: firestore.doc,
	getDoc: firestore.getDoc,
	setDoc: firestore.setDoc,
	serverTimestamp: firestore.serverTimestamp,
}));

const { addTransaction, editTransaction, deleteTransaction, resetForNewMonth } =
	await import("../cloud-storage.js");

function existingState() {
	return {
		meta: {
			month: "2026-11",
			baseBudget: 3000,
			debtPreviousBalances: {},
			investments: {
				principal: 0,
				annualRatePercent: 3.49,
			},
		},
		categories: [{ id: "food", name: "Food", type: "expense", limit: 500 }],
		transactions: [
			{
				id: "tx-1",
				date: "2026-11-10",
				amount: 20,
				categoryId: "food",
				type: "expense",
				description: "Lunch",
				bankPool: false,
			},
		],
	};
}

beforeEach(() => {
	vi.clearAllMocks();
	firestore.setDoc.mockResolvedValue(undefined);
	firestore.getDoc.mockImplementation(async () => {
		const state = existingState();
		return { exists: () => true, data: () => structuredClone(state) };
	});
});

describe("transaction Firestore persistence", () => {
	it("clears carried-over debt balances when resetting the month", async () => {
		const state = existingState();
		state.meta.debtPreviousBalances = { Alex: 125 };
		firestore.getDoc.mockResolvedValue({
			exists: () => true,
			data: () => structuredClone(state),
		});

		await resetForNewMonth({ month: "2026-12", baseBudget: 3200 });

		const writtenState = firestore.setDoc.mock.calls[0][1];
		expect(writtenState.meta.debtPreviousBalances).toEqual({});
		expect(writtenState.transactions).toEqual([]);
		expect(writtenState.meta.investments).toEqual(state.meta.investments);
	});

	it("writes a new transaction to the app-state document", async () => {
		const result = await addTransaction({
			date: "2026-11-11",
			amount: 42,
			categoryId: "food",
			type: "expense",
			description: "Groceries",
			bankPool: true,
		});

		expect(firestore.setDoc).toHaveBeenCalledOnce();
		const writtenState = firestore.setDoc.mock.calls[0][1];
		expect(writtenState.transactions).toContainEqual(
			expect.objectContaining({
				id: result.id,
				amount: 42,
				bankPool: true,
			}),
		);
	});

	it.each([
		[
			"add",
			() =>
				addTransaction({
					date: "2026-11-11",
					amount: 42,
					categoryId: "food",
					type: "expense",
					description: "Groceries",
				}),
		],
		["edit", () => editTransaction("tx-1", { amount: 42 })],
		["delete", () => deleteTransaction("tx-1")],
	])(
		"propagates Firestore permission errors when a transaction is %s",
		async (_action, perform) => {
			const error = Object.assign(
				new Error("Missing or insufficient permissions."),
				{ code: "permission-denied" },
			);
			firestore.setDoc.mockRejectedValue(error);

			await expect(perform()).rejects.toMatchObject({
				code: "permission-denied",
			});
			expect(firestore.setDoc).toHaveBeenCalledOnce();
		},
	);
});
