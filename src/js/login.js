import {
	signIn,
	signUp,
	initAuthListener,
	sendPasswordResetEmailToUser,
} from "./auth.js";
import { showModal } from "./components/modal.js";

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

function escapeHtml(value) {
	return String(value)
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
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

async function handleForgotPassword() {
	clearError();

	showModal({
		title: "Reset password",
		html: `
            <div class="mb-3">
                <label class="form-label small">Email</label>
                <input id="reset-email" type="email" class="form-control" placeholder="you@example.com" value="${escapeHtml(emailInput.value.trim())}" />
            </div>
        `,
		saveText: "Send reset email",
		onSave: async () => {
			const email = document
				.getElementById("reset-email")
				?.value.trim()
				.toLowerCase();
			if (!email) {
				alert("Please enter your email.");
				return false;
			}

			const result = await sendPasswordResetEmailToUser(email);
			if (!result.success) {
				alert("Unable to send reset email: " + result.error);
				return false;
			}

			alert(
				"If an account exists for that email, a password reset message has been sent. Please check your inbox.",
			);
			return true;
		},
	});
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

	document
		.getElementById("forgot-password")
		?.addEventListener("click", handleForgotPassword);

	const unsubscribe = initAuthListener((user) => {
		if (user) {
			console.log("[Login] User already authenticated:", user.email);
			unsubscribe();
			window.location.replace("dashboard.html");
		}
	});
});
