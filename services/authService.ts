
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut,
  setPersistence,
  browserLocalPersistence,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { UserAccount, UserRole, SubscriptionTier } from '../types';

// Set persistence once
setPersistence(auth, browserLocalPersistence).catch(console.error);

export const registerUser = async (email: string, pass: string, username: string, role: UserRole, tier: SubscriptionTier): Promise<UserAccount> => {
  const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
  const firebaseUser = userCredential.user;

  const userData: UserAccount = {
    id: firebaseUser.uid,
    username: username,
    role: role,
    tier: tier,
    interests: [],
    eloquenceLevel: 1,
    exp: 0,
    language: 'fr-FR'
  };

  await setDoc(doc(db, "users", firebaseUser.uid), {
    ...userData,
    email,
    createdAt: new Date().toISOString()
  });

  return userData;
};

export const loginUser = async (email: string, pass: string): Promise<UserAccount> => {
  const userCredential = await signInWithEmailAndPassword(auth, email, pass);
  const docRef = doc(db, "users", userCredential.user.uid);
  const docSnap = await getDoc(docRef);
  
  if (docSnap.exists()) {
    return docSnap.data() as UserAccount;
  } else {
    const userData: UserAccount = {
      id: userCredential.user.uid,
      username: userCredential.user.displayName || "User_" + userCredential.user.uid.substring(0, 5),
      role: 'solo',
      tier: 'free',
      interests: [],
      eloquenceLevel: 1,
      exp: 0,
      language: 'fr-FR'
    };
    await setDoc(doc(db, "users", userCredential.user.uid), userData);
    return userData;
  }
};

export const loginWithGoogle = async (): Promise<UserAccount> => {
  const provider = new GoogleAuthProvider();
  const userCredential = await signInWithPopup(auth, provider);
  const firebaseUser = userCredential.user;

  const docRef = doc(db, "users", firebaseUser.uid);
  const docSnap = await getDoc(docRef);
  
  if (docSnap.exists()) {
    return docSnap.data() as UserAccount;
  } else {
    const userData: UserAccount = {
      id: firebaseUser.uid,
      username: firebaseUser.displayName || "Muse_" + firebaseUser.uid.substring(0, 5),
      role: 'solo',
      tier: 'free',
      interests: [],
      eloquenceLevel: 1,
      exp: 0,
      language: 'fr-FR'
    };

    await setDoc(doc(db, "users", firebaseUser.uid), {
      ...userData,
      email: firebaseUser.email,
      createdAt: new Date().toISOString()
    });

    return userData;
  }
};

export const logoutUser = async () => {
  await signOut(auth);
};
