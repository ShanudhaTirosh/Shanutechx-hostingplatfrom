'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { firebaseAuth } from './firebaseClient';
import { api } from './api';
import { ApiUser } from './types';

interface AppUserContextValue {
  apiUser: ApiUser | null;
  rootDomain: string | null;
  loading: boolean;
  error: string | null;
  refetchUser: () => Promise<void>;
  switchRole: (role: 'customer' | 'support' | 'dev' | 'admin') => Promise<void>;
}

const AppUserContext = createContext<AppUserContextValue>({
  apiUser: null,
  rootDomain: null,
  loading: true,
  error: null,
  refetchUser: async () => {},
  switchRole: async () => {},
});

const USER_CACHE_KEY = 'shanutechx_user_cache';
const USER_CACHE_TIMESTAMP_KEY = 'shanutechx_user_cache_ts';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export function AppUserProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [apiUser, setApiUser] = useState<ApiUser | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem(USER_CACHE_KEY);
        const timestamp = localStorage.getItem(USER_CACHE_TIMESTAMP_KEY);
        if (cached && timestamp) {
          const age = Date.now() - parseInt(timestamp, 10);
          if (age < CACHE_DURATION) {
            return JSON.parse(cached);
          }
        }
      } catch {}
    }
    return null;
  });
  const [rootDomain, setRootDomain] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('shanutechx_root_domain') || null;
    }
    return null;
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUser = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.me();
      setApiUser(data.user);
      setRootDomain(data.rootDomain);
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(USER_CACHE_KEY, JSON.stringify(data.user));
          localStorage.setItem('shanutechx_root_domain', data.rootDomain);
          localStorage.setItem(USER_CACHE_TIMESTAMP_KEY, Date.now().toString());
        } catch {}
      }
    } catch (err: any) {
      // Clear stale cache on auth failure
      if (typeof window !== 'undefined') {
        try {
          localStorage.removeItem(USER_CACHE_KEY);
          localStorage.removeItem(USER_CACHE_TIMESTAMP_KEY);
        } catch {}
      }
      setApiUser(null);
      setError(err.message || 'Failed to fetch user context from server');
    } finally {
      setLoading(false);
    }
  };

  const switchRole = async (role: 'customer' | 'support' | 'dev' | 'admin') => {
    try {
      setLoading(true);
      const data = await api.updateRole(role);
      setApiUser(data.user);
      if (data.rootDomain) setRootDomain(data.rootDomain);
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(USER_CACHE_KEY, JSON.stringify(data.user));
          localStorage.setItem(USER_CACHE_TIMESTAMP_KEY, Date.now().toString());
        } catch {}
      }
    } catch (err: any) {
      setError(err.message || 'Failed to switch role');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Wait for Firebase auth state to resolve before fetching user
    const unsubscribe = onAuthStateChanged(firebaseAuth, (firebaseUser) => {
      if (!firebaseUser) {
        // Not signed in — clear state and redirect to login
        setApiUser(null);
        setLoading(false);
        if (typeof window !== 'undefined') {
          try {
            localStorage.removeItem(USER_CACHE_KEY);
            localStorage.removeItem(USER_CACHE_TIMESTAMP_KEY);
          } catch {}
        }
        router.replace('/login');
        return;
      }

      // Always fetch fresh user context from API on auth change to ensure role accuracy
      fetchUser();
    });

    return () => unsubscribe();
  }, []);

  return (
    <AppUserContext.Provider value={{ apiUser, rootDomain, loading, error, refetchUser: fetchUser, switchRole }}>
      {children}
    </AppUserContext.Provider>
  );
}

export function useAppUser() {
  return useContext(AppUserContext);
}
