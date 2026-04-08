import { signIn, signUp, initAuthListener } from "./auth.js";

const emailInput = document.getElementById("auth-email");
const passwordInput = document.getElementById("auth-password");
const errorEl = document.getElementById("auth-error");
const signInBtn = document.getElementById("sign-in-btn");
const signUpBtn = document.getElementById("sign-up-btn");

function showError(message) {
	if (!errorEl) return;
	errorEl.textContent = message;
	errorEl.classList.remove("d-none");
}

function clearError() {
	if (!errorEl) return;
	errorEl.textContent = "";
	errorEl.classList.add("d-none");
}

async function handleAuthResult(result) {
	if (result.success) {
		window.location.href = "dashboard.html";
	} else {
		showError(result.error || "Authentication failed");
	}
}

async function handleSignIn() {
	clearError();
	const email = emailInput.value.trim();
	const password = passwordInput.value;

	if (!email || !password) {
		showError("Enter both email and password");
		return;
	}

	signInBtn.disabled = true;
	signUpBtn.disabled = true;
	signInBtn.textContent = "Signing in...";

	const result = await signIn(email, password);

	signInBtn.disabled = false;
	signUpBtn.disabled = false;
	signInBtn.textContent = "Sign In";

	await handleAuthResult(result);
}

async function handleSignUp() {
	clearError();
	const email = emailInput.value.trim();
	const password = passwordInput.value;

	if (!email || !password) {
		showError("Enter both email and password");
		return;
	}

	if (password.length < 6) {
		showError("Password must be at least 6 characters");
		return;
	}

	signInBtn.disabled = true;
	signUpBtn.disabled = true;
	signUpBtn.textContent = "Creating...";

	const result = await signUp(email, password);

	signInBtn.disabled = false;
	signUpBtn.disabled = false;
	signUpBtn.textContent = "Create Account";

	await handleAuthResult(result);
}

document.addEventListener("DOMContentLoaded", () => {
	signInBtn?.addEventListener("click", handleSignIn);
	signUpBtn?.addEventListener("click", handleSignUp);

	[emailInput, passwordInput].forEach((input) => {
		if (!input) return;
		input.addEventListener("keydown", (event) => {
			if (event.key === "Enter") handleSignIn();
		});
	});

	const unsubscribe = initAuthListener((user) => {
		if (user) {
			console.log("[Login] User already authenticated:", user.email);
			unsubscribe();
			window.location.replace("dashboard.html");
		}
	});
});
