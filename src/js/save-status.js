// Save status UI indicator
export function initSaveStatusIndicator() {
	const existing = document.getElementById("save-status-indicator");
	if (existing) return;

	const indicator = document.createElement("div");
	indicator.id = "save-status-indicator";
	indicator.className = "save-status-hidden";
	indicator.innerHTML = `
		<div class="save-status-content">
			<span class="save-status-icon"></span>
			<span class="save-status-text">Saving...</span>
		</div>
	`;
	document.body.appendChild(indicator);

	// Listen for save status events
	window.addEventListener("appSaving", () => {
		indicator.className = "save-status-saving";
		indicator.querySelector(".save-status-text").textContent = "Saving...";
	});

	window.addEventListener("appSaved", () => {
		indicator.className = "save-status-saved";
		indicator.querySelector(".save-status-text").textContent = "Saved";
		// Auto-hide after 2 seconds
		setTimeout(() => {
			indicator.className = "save-status-hidden";
		}, 2000);
	});

	window.addEventListener("appSaveFailed", (e) => {
		indicator.className = "save-status-failed";
		indicator.querySelector(".save-status-text").textContent = "Failed to save";
		console.error("[Save Status] Error:", e.detail?.error);
		// Auto-hide after 4 seconds
		setTimeout(() => {
			indicator.className = "save-status-hidden";
		}, 4000);
	});
}
