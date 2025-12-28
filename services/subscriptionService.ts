
import { UserAccount } from '../types';
import { doc, updateDoc, increment } from 'firebase/firestore';

export const checkPermission = (user: UserAccount | null, feature: string): { allowed: boolean; message?: string } => {
  // Mode Guest
  if (!user) {
    const guestUsage = parseInt(localStorage.getItem('muse_guest_usage') || '0');
    if (guestUsage >= 2) {
      return { allowed: false, message: "Limite d'invité atteinte. Inscrivez-vous gratuitement pour continuer !" };
    }
    return { allowed: true };
  }

  const today = new Date().toISOString().split('T')[0];

  switch (feature) {
    case 'challenge':
      if (user.tier === 'free') {
        const challengesToday = user.lastChallengeDate === today ? (user.dailyChallengesUsed || 0) : 0;
        if (challengesToday >= 5) {
          return { allowed: false, message: "Limite quotidienne (5) atteinte. Passez Premium !" };
        }
      }
      return { allowed: true };
    default:
      return { allowed: true };
  }
};

export const registerChallengeUsage = async (user: UserAccount | null, db: any) => {
  if (!user) {
    const current = parseInt(localStorage.getItem('muse_guest_usage') || '0');
    localStorage.setItem('muse_guest_usage', (current + 1).toString());
    return;
  }

  if (!db) return;
  const today = new Date().toISOString().split('T')[0];
  const userRef = doc(db, "users", user.id);

  try {
    if (user.lastChallengeDate !== today) {
      await updateDoc(userRef, { lastChallengeDate: today, dailyChallengesUsed: 1 });
    } else {
      await updateDoc(userRef, { dailyChallengesUsed: increment(1) });
    }
  } catch (err) {
    console.warn("Usage Registration Failed:", err);
  }
};
