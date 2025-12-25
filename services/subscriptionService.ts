
import { UserAccount, SubscriptionTier } from '../types';
import { getFirestore, doc, updateDoc, increment } from 'https://esm.sh/firebase@10.7.1/firestore';

export const checkPermission = (user: UserAccount | null, feature: string): { allowed: boolean; message?: string } => {
  if (!user) return { allowed: false, message: "Veuillez vous connecter pour accéder à cette fonctionnalité." };

  const today = new Date().toISOString().split('T')[0];

  switch (feature) {
    case 'challenge':
      if (user.tier === 'free') {
        const challengesToday = user.lastChallengeDate === today ? (user.dailyChallengesUsed || 0) : 0;
        if (challengesToday >= 1) {
          return { 
            allowed: false, 
            message: "Vous avez atteint votre limite quotidienne. Passez à Social Muse Premium pour un entraînement illimité." 
          };
        }
      }
      return { allowed: true };

    case 'debate_mode':
      if (user.tier === 'free') {
        return { 
          allowed: false, 
          message: "Le Mode Débat est réservé aux membres Premium. Challengez votre éloquence dès maintenant." 
        };
      }
      return { allowed: true };

    case 'admin_dashboard':
      if (user.tier !== 'business') {
        return { allowed: false, message: "Le Dashboard Administrateur est exclusif au plan Entreprise." };
      }
      return { allowed: true };

    case 'private_rooms':
      if (user.tier === 'free') {
        return { allowed: false, message: "La création de salons privés nécessite un compte Premium ou Entreprise." };
      }
      return { allowed: true };

    default:
      return { allowed: true };
  }
};

export const registerChallengeUsage = async (user: UserAccount, db: any) => {
  if (user.tier !== 'free') return;

  const today = new Date().toISOString().split('T')[0];
  const userRef = doc(db, "users", user.id);

  if (user.lastChallengeDate !== today) {
    await updateDoc(userRef, {
      lastChallengeDate: today,
      dailyChallengesUsed: 1
    });
  } else {
    await updateDoc(userRef, {
      dailyChallengesUsed: increment(1)
    });
  }
};
