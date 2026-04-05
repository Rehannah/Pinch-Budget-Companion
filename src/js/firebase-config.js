// Firebase initialization with Auth and Firestore
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCo0N5YbwKzssbpYfknJ85WPYH5v6NBsPo",
  authDomain: "pinch-budget-companion.firebaseapp.com",
  projectId: "pinch-budget-companion",
  storageBucket: "pinch-budget-companion.firebasestorage.app",
  messagingSenderId: "978732900484",
  appId: "1:978732900484:web:75242e4abcb567d54322d1"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and Firestore
export const auth = getAuth(app);
export const db = getFirestore(app);
