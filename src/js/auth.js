import { auth } from "./firebase-config.js";
import {
	onAuthStateChanged,
	signInWithEmailAndPassword,
	createUserWithEmailAndPassword,
	signOut,
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
