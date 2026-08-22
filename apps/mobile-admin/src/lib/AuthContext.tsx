import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, sendPasswordResetEmail, signOut as fbSignOut, User as FirebaseUser } from 'firebase/auth';
import { auth } from './firebase';
import { api, ApiUser } from './api';
import { registerForPushNotifications, unregisterPushNotifications } from './pushRegistration';

interface AuthContextValue {
  firebaseUser: FirebaseUser | null;
  apiUser: ApiUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshApiUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [apiUser, setApiUser] = useState<ApiUser | null>(null);
  const [loading, setLoading] = useState(true);

  async function refreshApiUser() {
    try {
      const { user } = await api.auth.me();
      setApiUser(user);
    } catch {
      setApiUser(null);
    }
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        await refreshApiUser();
      } else {
        setApiUser(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  async function signIn(email: string, password: string) {
    await signInWithEmailAndPassword(auth, email, password);
    // onAuthStateChanged above picks up the new session and loads apiUser.
    // Push registration happens here specifically (not in the
    // onAuthStateChanged listener) so a cold-start session restore doesn't
    // re-prompt for notification permission every single app launch —
    // only an explicit, interactive sign-in does.
    void registerForPushNotifications();
  }

  async function sendPasswordReset(email: string) {
    await sendPasswordResetEmail(auth, email);
  }

  async function signOut() {
    await unregisterPushNotifications();
    await fbSignOut(auth);
  }

  return (
    <AuthContext.Provider value={{ firebaseUser, apiUser, loading, signIn, sendPasswordReset, signOut, refreshApiUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
