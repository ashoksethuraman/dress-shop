import { initFirebase, getFirebaseAuth } from './firebaseClient';
import type { User as AppUser } from '../utils/types';
import {
  signInAnonymously,
  onAuthStateChanged as fbOnAuthStateChanged,
  updateProfile,
  User as FirebaseUser,
  signOut as fbSignOut,
} from 'firebase/auth';

initFirebase();

export const authService = {
  async signInGuest(displayName?: string) {
    const auth = getFirebaseAuth();
    if (!auth) return null;
    const res = await signInAnonymously(auth);
    if (displayName && res.user) {
      await updateProfile(res.user as FirebaseUser, { displayName });
    }
    return res.user;
  },
  onAuthStateChanged(cb: (u: AppUser | null) => void) {
    const auth = getFirebaseAuth();
    if (!auth) return () => {};
    return fbOnAuthStateChanged(auth, (fbUser) => {
      if (fbUser) {
        cb({ id: fbUser.uid, name: fbUser.displayName || fbUser.email || undefined, isGuest: fbUser.isAnonymous });
      } else {
        cb(null);
      }
    });
  },
  async signOut() {
    const auth = getFirebaseAuth();
    if (!auth) return;
    await fbSignOut(auth);
  },
};
