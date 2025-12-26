
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

/**
 * Hardcoded Firebase configuration provided by the user.
 * This ensures the app initializes correctly even if environment variables are missing.
 */
const firebaseConfig = {
  apiKey: "AIzaSyClOUFt9aCDWEvDoG5u6kAQ-nvG_Byh_LI",
  authDomain: "social-muse-f29f9.firebaseapp.com",
  projectId: "social-muse-f29f9",
  storageBucket: "social-muse-f29f9.firebasestorage.app",
  messagingSenderId: "628842678494",
  appId: "1:628842678494:web:1d85cd42a4e95334745a4f",
  measurementId: "G-MGG281987N"
};

// Initialize Firebase App
// We check if an app already exists to support HMR (Hot Module Replacement)
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Initialize and export services
// Passing the app instance to getAuth and getFirestore is critical for registry consistency
export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;
