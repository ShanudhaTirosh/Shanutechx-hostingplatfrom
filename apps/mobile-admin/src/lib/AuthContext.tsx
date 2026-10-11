import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as fbSignOut,
  User as FirebaseUser,
} from 'firebase/auth';
import { auth, googleProvider, githubProvider } from './firebase';
import {
  api,
  ApiUser,
  initApiConfig,
  getEffectiveApiBase,
  setApiBaseUrl,
  getStoredApiKey,
  setStoredApiKey,
} from './api';
import { registerForPushNotifications, unregisterPushNotifications } from './pushRegistration';

interface AuthContextValue {
  firebaseUser: FirebaseUser | null;
  apiUser: ApiUser | null;
  loading: boolean;
  serverUrl: string;
  setServerUrl: (url: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithGithub: () => Promise<void>;
  signInWithApiKey: (apiKey: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshApiUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [apiUser, setApiUser] = useState<ApiUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [serverUrl, setServerUrlState] = useState(getEffectiveApiBase());

  const refreshApiUser = useCallback(async () => {
    try {
      const { user } = await api.auth.me();
      setApiUser(user);
    } catch {
      setApiUser(null);
    }
  }, []);

  const updateServerUrl = useCallback(async (newUrl: string) => {
    await setApiBaseUrl(newUrl);
    setServerUrlState(getEffectiveApiBase());
    await refreshApiUser();
  }, [refreshApiUser]);

  useEffect(() => {
    let isMounted = true;

    async function bootstrap() {
      await initApiConfig();
      if (!isMounted) return;
      setServerUrlState(getEffectiveApiBase());

      // 1. Check if an Admin / Dev API key was stored
      const storedKey = await getStoredApiKey();
      if (storedKey) {
        try {
          const { user } = await api.auth.me();
          if (isMounted) {
            setApiUser(user);
            setLoading(false);
            return;
          }
        } catch {
          // If stored key fails, continue to Firebase auth check
        }
      }

      // 2. Listen for Firebase session
      const unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (!isMounted) return;
        setFirebaseUser(user);
        if (user) {
          await refreshApiUser();
        } else if (!storedKey) {
          setApiUser(null);
        }
        setLoading(false);
      });

      return unsubscribe;
    }

    const cleanupPromise = bootstrap();

    return () => {
      isMounted = false;
      cleanupPromise.then((unsub) => {
        if (typeof unsub === 'function') unsub();
      });
    };
  }, [refreshApiUser]);

  async function signInWithGoogle() {
    const result = await signInWithPopup(auth, googleProvider);
    if (result.user) {
      const idToken = await result.user.getIdToken();
      try {
        await api.auth.login(idToken, 'google');
      } catch {
        // non-fatal, idToken is directly usable by apiFetch
      }
      await setStoredApiKey(null);
      await refreshApiUser();
      void registerForPushNotifications();
    }
  }

  async function signInWithGithub() {
    const result = await signInWithPopup(auth, githubProvider);
    if (result.user) {
      const idToken = await result.user.getIdToken();
      try {
        await api.auth.login(idToken, 'github');
      } catch {
        // non-fatal, idToken is directly usable by apiFetch
      }
      await setStoredApiKey(null);
      await refreshApiUser();
      void registerForPushNotifications();
    }
  }

  async function signInWithApiKey(apiKey: string) {
    const cleanKey = apiKey.trim();
    if (!cleanKey) throw new Error('API key cannot be empty');

    await setStoredApiKey(cleanKey);
    try {
      const { user } = await api.auth.me();
      if (user.role === 'customer') {
        await setStoredApiKey(null);
        throw new Error('Access denied: Staff/Admin role required.');
      }
      setApiUser(user);
      void registerForPushNotifications();
    } catch (err: any) {
      await setStoredApiKey(null);
      throw err;
    }
  }

  async function signOut() {
    await unregisterPushNotifications();
    await setStoredApiKey(null);
    setApiUser(null);
    setFirebaseUser(null);
    try {
      await fbSignOut(auth);
    } catch {
      // non-fatal
    }
  }

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        apiUser,
        loading,
        serverUrl,
        setServerUrl: updateServerUrl,
        signInWithGoogle,
        signInWithGithub,
        signInWithApiKey,
        signOut,
        refreshApiUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
