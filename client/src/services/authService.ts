import { initFirebase, getFirebaseAuth } from './firebaseClient';
import type { User as AppUser } from '../utils/types';
import {
  signInAnonymously,
  onAuthStateChanged as fbOnAuthStateChanged,
  updateProfile,
  updatePhoneNumber,
  PhoneAuthProvider,
  User as FirebaseUser,
  signOut as fbSignOut,
  signInWithEmailAndPassword,
} from 'firebase/auth';

initFirebase();

function mapAuthError(code: string): string {
  switch (code) {
    case 'auth/user-not-found':         return 'No account found with this email address.';
    case 'auth/wrong-password':         return 'Incorrect password. Please try again.';
    case 'auth/invalid-email':          return 'Invalid email address format.';
    case 'auth/invalid-credential':     return 'Invalid credentials. Please check your email and password.';
    case 'auth/user-disabled':          return 'This account has been disabled.';
    case 'auth/too-many-requests':      return 'Too many failed attempts. Please try again later.';
    case 'auth/network-request-failed': return 'Network error. Please check your connection.';
    default:                            return 'Login failed. Please try again.';
  }
}

export const authService = {
  async signInWithEmail(email: string, password: string) {
    const auth = getFirebaseAuth();
    if (!auth) throw new Error('Firebase is not configured.');
    try {
      const res = await signInWithEmailAndPassword(auth, email, password);
      return res.user;
    } catch (err: any) {
      throw new Error(mapAuthError(err.code));
    }
  },

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
    return fbOnAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        const { claims } = await fbUser.getIdTokenResult();
        cb({
          id:       fbUser.uid,
          name:     fbUser.displayName || fbUser.email || undefined,
          photoURL: fbUser.photoURL || undefined,
          isGuest:  fbUser.isAnonymous,
          isAdmin:  claims['isAdmin'] === true || claims['role'] === 'admin',
        });
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

  /**
   * Returns the Firebase ID token (JWT) for the current user.
   * Always call this fresh before each API request — Firebase auto-refreshes
   * it when it's close to expiry (token lifetime = 1 hour).
   *
   * Usage:
   *   const token = await authService.getIdToken();
   *   fetch(url, { headers: { Authorization: `Bearer ${token}` } });
   */
  async getIdToken(forceRefresh = false): Promise<string | null> {
    const auth = getFirebaseAuth();
    const user = auth?.currentUser;
    if (!user) return null;
    return user.getIdToken(forceRefresh);
  },

  /**
   * Update Firebase Auth profile fields.
   * Call this after sign-up or from a profile settings page.
   *
   * @param displayName  The name shown in the navbar avatar.
   * @param photoURL     Absolute URL to a profile picture.
   */
  async updateUserProfile({ displayName, photoURL }: { displayName?: string; photoURL?: string }): Promise<void> {
    const auth = getFirebaseAuth();
    const user = auth?.currentUser as FirebaseUser | null;
    if (!user) throw new Error('No authenticated user.');
    await updateProfile(user, {
      ...(displayName !== undefined && { displayName }),
      ...(photoURL    !== undefined && { photoURL }),
    });
    // Force-refresh token so updated claims propagate immediately
    await user.getIdToken(true);
  },

  /**
   * NOTE: Firebase phone number update requires a phone auth credential
   * (SMS OTP). For simple storage without SMS verification, save the phone
   * number in Firestore (users/{uid}) and read it back via firestoreService.
   *
   * Example Firestore approach (call from your profile page):
   *   await firestoreService.updateUserPhone(uid, phone);
   *   // then read it back when displaying the profile.
   *
   * If you DO have SMS OTP set up, pass the PhoneAuthCredential here:
   *   await authService.linkPhoneCredential(credential);
   */
  async linkPhoneCredential(credential: ReturnType<typeof PhoneAuthProvider.credential>): Promise<void> {
    const auth = getFirebaseAuth();
    const user = auth?.currentUser as FirebaseUser | null;
    if (!user) throw new Error('No authenticated user.');
    await updatePhoneNumber(user, credential);
  },
};

