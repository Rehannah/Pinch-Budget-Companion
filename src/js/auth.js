import { auth } from "./firebase-config.js";
import {
	onAuthStateChanged,
	signInWithEmailAndPassword,
	createUserWithEmailAndPassword,
	signOut,
	fetchSignInMethodsForEmail,
	sendPasswordResetEmail,
} from "firebase/auth";
import { showModal } from "./components/modal.js";

export function initAuthListener(callback) {
	console.log("[Auth] Registering auth listener");

	return onAuthStateChanged(
		auth,
		(user) => {
			console.log("[Auth] Auth state changed:", user ? user.email : "no user");
			callback(user);
		},
		(error) => {
			console.error("[Auth] Listener error:", error);
			callback(null);
		},
	);
}

export function getCurrentUser() {
	return auth.currentUser;
}

export async function signIn(email, password) {
	try {
		const cred = await signInWithEmailAndPassword(auth, email, password);
		return { success: true, user: cred.user };
	} catch (error) {
		return { success: false, error: error.message };
	}
}

export async function signUp(email, password) {
	try {
		const cred = await createUserWithEmailAndPassword(auth, email, password);
		return { success: true, user: cred.user };
	} catch (error) {
		return { success: false, error: error.message };
	}
}

export async function checkEmailExists(email) {
	try {
		const normalizedEmail = String(email || "")
			.trim()
			.toLowerCase();
		const methods = await fetchSignInMethodsForEmail(auth, normalizedEmail);
		return {
			exists: Array.isArray(methods) && methods.length > 0,
			error: null,
		};
	} catch (error) {
		console.error("[Auth] checkEmailExists error:", error);
		return {
			exists: false,
			error: error.message || String(error),
		};
	}
}

export async function sendPasswordResetEmailToUser(email) {
	try {
		const normalizedEmail = String(email || "")
			.trim()
			.toLowerCase();
		await sendPasswordResetEmail(auth, normalizedEmail);
		return { success: true };
	} catch (error) {
		console.error("[Auth] sendPasswordResetEmailToUser error:", error);
		return {
			success: false,
			error: error.message || String(error),
			code: error.code || null,
		};
	}
}

export async function logout() {
	try {
		await signOut(auth);
		return { success: true };
	} catch (error) {
		return { success: false, error: error.message };
	}
}

export function showLogoutConfirm() {
	return new Promise((resolve) => {
		showModal({
			title: "Confirm Logout",
			html: "<p>Are you sure you want to log out?</p>",
			saveText: "Logout",
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
