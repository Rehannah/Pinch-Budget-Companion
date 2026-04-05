// Authentication module for Firebase
import { auth } from '../firebase-config.js';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";

let currentUser = null;

// Listen for auth state changes
export function initAuthListener(callback) {
  return onAuthStateChanged(auth, (user) => {
    currentUser = user;
    console.log('[Auth] State changed:', user ? `Logged in as ${user.email}` : 'Logged out');
    if (callback) callback(user);
  });
}

// Get currently authenticated user
export function getCurrentUser() {
  return currentUser;
}

// Sign up with email/password
export async function signUp(email, password) {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    console.log('[Auth] Sign up successful:', userCredential.user.email);
    return { success: true, user: userCredential.user };
  } catch (error) {
    console.error('[Auth] Sign up error:', error.message);
    return { success: false, error: error.message };
  }
}

// Sign in with email/password
export async function signIn(email, password) {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    console.log('[Auth] Sign in successful:', userCredential.user.email);
    return { success: true, user: userCredential.user };
  } catch (error) {
    console.error('[Auth] Sign in error:', error.message);
    return { success: false, error: error.message };
  }
}

// Sign out
export async function logout() {
  try {
    await signOut(auth);
    console.log('[Auth] Logged out');
    return { success: true };
  } catch (error) {
    console.error('[Auth] Logout error:', error.message);
    return { success: false, error: error.message };
  }
}
