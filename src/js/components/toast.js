export function showToast(message, { timeout = 3000 } = {}) {
	try {
		const existing = document.getElementById("app-toast");
		if (existing) existing.remove();

		const t = document.createElement("div");
		t.id = "app-toast";
		t.style.position = "fixed";
		t.style.right = "1rem";
		t.style.top = "1rem";
		t.style.zIndex = 9999;
		t.style.background = "rgba(16,24,40,0.95)";
		t.style.color = "#fff";
		t.style.padding = "0.6rem 1rem";
		t.style.borderRadius = "0.5rem";
		t.style.boxShadow = "0 6px 18px rgba(2,6,23,0.2)";
		t.style.fontSize = "0.95rem";
		t.textContent = message;

		document.body.appendChild(t);

		setTimeout(() => {
			t.style.transition = "opacity 300ms";
			t.style.opacity = "0";
			setTimeout(() => t.remove(), 320);
		}, timeout);
	} catch (e) {
		console.warn("showToast failed", e);
	}
}
