// Authentication UI helpers
export function showLogoutConfirm() {
	return new Promise((resolve) => {
		if (!window.showModal) {
			resolve(false);
			return;
		}
		const html = `
      <div class="text-center mb-3">
        <p>Are you sure you want to log out? Your data is safely stored in the cloud.</p>
      </div>
    `;

		window.showModal({
			title: "Log Out",
			html,
			saveText: "Log Out",
			cancelText: "Cancel",
			onSave: () => {
				resolve(true);
				return true;
			},
			onCancel: () => {
				resolve(false);
				return true;
			},
		});
	});
}
