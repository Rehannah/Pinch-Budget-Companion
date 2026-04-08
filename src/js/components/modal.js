export function showModal({
	title = "",
	html = "",
	onSave = null,
	saveText = "Save",
	onCancel = null,
	cancelText = "Cancel",
}) {
	const existing = document.getElementById("generic-modal");
	if (existing) existing.remove();

	const modal = document.createElement("div");
	modal.id = "generic-modal";
	modal.className =
		"position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-4";
	modal.style.backgroundColor = "rgba(0,0,0,0.5)";
	modal.innerHTML = `
        <div class="bg-white rounded shadow p-4" style="max-width:28rem; width:100%">
            <h3 class="h5 fw-semibold">${title}</h3>
            <div class="mt-3">${html}</div>
            <div class="d-flex gap-2 justify-content-end mt-4">
                <button id="modal-cancel" class="btn btn-secondary">${cancelText}</button>
                <button id="modal-save" class="btn btn-primary">${saveText}</button>
            </div>
        </div>
    `;

	document.body.appendChild(modal);

	document.getElementById("modal-cancel").addEventListener("click", () => {
		modal.remove();
		onCancel?.();
	});

	document.getElementById("modal-save").addEventListener("click", async () => {
		if (onSave) {
			try {
				const res = await onSave();
				if (res === false) return;
			} catch (err) {
				console.error("modal onSave error", err);
				return;
			}
		}

		modal.remove();
	});

	return modal;
}
