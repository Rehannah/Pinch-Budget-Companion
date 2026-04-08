import Header, { initHeader } from "./components/header.js";
import { initAuthListener } from "./auth.js";
import { initCloudStorage } from "./cloud-storage.js";
import { showOnboarding } from "./features/onboarding.js";
import {
	showBudgetWarningBanner,
	showUnallocatedBanner,
} from "./components/budget-banners.js";
import { initSaveStatusIndicator } from "./save-status.js";

function mountHeader() {
	const el = document.getElementById("app-header");
	if (!el) return;
	el.innerHTML = Header();
	initHeader();
}

function removeAuthLoadingOverlay() {
	const loadingOverlay = document.getElementById("auth-loading");
	if (loadingOverlay) loadingOverlay.remove();
}

async function initializeAuthenticatedApp() {
	let state = null;

	try {
		state = await initCloudStorage();
		console.log("[App] Cloud storage initialized");
	} catch (error) {
		console.error("[App] Cloud storage init failed:", error);
	}

	mountHeader();

	const isRestarting = sessionStorage.getItem("showOnboardingAfterRestart");
	sessionStorage.removeItem("showOnboardingAfterRestart");

	if (isRestarting || !state || !state.meta || !state.meta.month) {
		await showOnboarding(isRestarting);
	}

	await Promise.allSettled([
		Promise.resolve(window.initDashboard?.()),
		Promise.resolve(window.initTransactions?.()),
		Promise.resolve(window.initSettings?.()),
	]);

	await Promise.allSettled([
		showBudgetWarningBanner(),
		showUnallocatedBanner(),
	]);
}

document.addEventListener("DOMContentLoaded", () => {
	initSaveStatusIndicator();

	const authTimeoutId = setTimeout(() => {
		const loadingOverlay = document.getElementById("auth-loading");
		if (loadingOverlay) {
			console.warn("[App] Auth check timed out after 5s, redirecting to login");
			window.location.href = "login.html";
		}
	}, 5000);

	try {
		const unsubscribe = initAuthListener(async (user) => {
			clearTimeout(authTimeoutId);

			if (!user) {
				console.log("[App] No authenticated user, redirecting to login.html");
				unsubscribe();
				window.location.href = "login.html";
				return;
			}

			removeAuthLoadingOverlay();
			console.log("[App] User authenticated:", user.email);
			unsubscribe();

			await initializeAuthenticatedApp();
		});
	} catch (error) {
		console.error("[App] Fatal error during auth setup:", error);
		clearTimeout(authTimeoutId);
		removeAuthLoadingOverlay();

		setTimeout(() => {
			window.location.href = "login.html";
		}, 1000);
	}
});

window.addEventListener("appStateChanged", async () => {
	try {
		await Promise.allSettled([
			Promise.resolve(window.initDashboard?.()),
			Promise.resolve(window.initTransactions?.()),
			Promise.resolve(window.initSettings?.()),
		]);

		await Promise.allSettled([
			showBudgetWarningBanner(),
			showUnallocatedBanner(),
		]);
	} catch (err) {
		console.error("appStateChanged handler error", err);
	}
});
