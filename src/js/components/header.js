import { getCurrentUser, logout, showLogoutConfirm } from "../auth.js";
import { showToast } from "../components/toast.js";

const Header = () => {
	return `
    <header class="w-100 bg-white border-bottom py-1">
        <div class="container d-flex align-items-center justify-content-between">
          <a href="dashboard.html" class="text-logo fw-bold text-decoration-none">Pinch</a>
          <div class="d-flex align-items-center gap-3">
            <nav class="d-none d-sm-flex gap-3" aria-label="Main navigation">
              <a data-nav href="dashboard.html" class="text-muted text-decoration-none">Dashboard</a>
              <a data-nav href="transactions.html" class="text-muted text-decoration-none">Transactions</a>
              <a data-nav href="settings.html" class="text-muted text-decoration-none">Settings</a>
            </nav>
            <div class="d-flex align-items-center gap-2 border-start ps-3">
              <span id="user-email" class="small text-muted"></span>
              <button id="logout-btn" class="btn btn-link btn-sm text-danger text-decoration-none">Logout</button>
            </div>
          </div>
        </div>
      </header>

      <nav class="bottom-nav d-block d-md-none position-fixed start-0 end-0 bottom-0 bg-white border-top">
        <div class="container d-flex justify-content-around align-items-center p-2">
          <a data-nav href="dashboard.html" class="p-3 text-center small text-decoration-none">Dashboard</a>
          <a data-nav href="transactions.html" class="p-3 text-center small text-decoration-none">Transactions</a>
          <a data-nav href="settings.html" class="p-3 text-center small text-decoration-none">Settings</a>
        </div>
      </nav>
    `;
};

function highlightActiveLinks(container = document) {
	try {
		const current = location.pathname.split("/").pop() || "dashboard.html";
		const links = Array.from(container.querySelectorAll("a[data-nav]"));

		links.forEach((a) => {
			const href = a.getAttribute("href") || "";
			if (href === current || (href === "dashboard.html" && current === "")) {
				a.classList.add("text-primary", "font-semibold");
				a.setAttribute("aria-current", "page");
			} else {
				a.classList.remove("text-primary", "font-semibold");
				a.removeAttribute("aria-current");
			}
		});
	} catch (e) {
		console.warn("highlightActiveLinks error", e);
	}
}

async function handleLogoutClick() {
	const confirmed = await showLogoutConfirm();
	if (!confirmed) return;

	const result = await logout();
	if (result.success) {
		showToast("Logged out successfully");
		setTimeout(() => {
			window.location.href = "dashboard.html";
		}, 1000);
	} else {
		showToast("Logout failed: " + result.error);
	}
}

export function initHeader() {
	const el = document.getElementById("app-header");
	if (!el) return;

	highlightActiveLinks(el);
	window.addEventListener("popstate", () => highlightActiveLinks(document));

	try {
		const userEmailEl = document.getElementById("user-email");
		const logoutBtn = document.getElementById("logout-btn");
		const user = getCurrentUser();

		if (user && userEmailEl) {
			userEmailEl.textContent = user.email;
		}

		if (logoutBtn) {
			logoutBtn.addEventListener("click", handleLogoutClick);
		}
	} catch (e) {
		console.warn("initHeader auth setup error", e);
	}
}

export default Header;
