export function formatDate(dateStr) {
	if (!dateStr) return "";

	const isoMatch = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})$/);
	if (isoMatch) {
		const yyyy = isoMatch[1];
		const mm = isoMatch[2];
		const dd = isoMatch[3];
		return `${dd}-${mm}-${yyyy}`;
	}

	const d = new Date(dateStr);
	if (Number.isNaN(d.getTime())) return dateStr;

	const dd = String(d.getDate()).padStart(2, "0");
	const mm = String(d.getMonth() + 1).padStart(2, "0");
	const yyyy = d.getFullYear();
	return `${dd}-${mm}-${yyyy}`;
}
