
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, setDoc } from 'firebase/firestore';

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
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Initialize and export services
// Critical: Passing the app instance directly fixes registration issues
export const auth = getAuth(app);

// Forcer l'utilisation de la base 'muse' vue sur votre console
export const db = getFirestore(app, "muse");

/**
 * Test de connexion Firestore
 * Tente d'écrire un document dans la collection 'connection_tests' de la base 'muse'
 */
const testConnection = async () => {
  try {
    await setDoc(doc(db, "connection_tests", "test_id"), {
      status: "success",
      message: "Connexion depuis AI Studio réussie",
      timestamp: new Date()
    });
    console.log("🔥 [Firebase] Test réussi ! Vérifie ta console Firebase (Base: muse).");
  } catch (error) {
    console.error("❌ [Firebase] Erreur de connexion :", error);
  }
};

// Exécution du test au démarrage
testConnection();

export default app;
