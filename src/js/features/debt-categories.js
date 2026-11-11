export function getDebtCategoryKind(categoryName) {
	const normalizedName = String(categoryName || "")
		.trim()
		.toLowerCase();
	if (normalizedName.includes("debt owed to me")) return "owed";
	if (normalizedName.includes("debts repaid to me")) return "repaid";
	return null;
}
