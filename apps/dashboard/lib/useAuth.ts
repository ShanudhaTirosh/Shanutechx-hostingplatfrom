'use client';

import { useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { firebaseAuth } from './firebaseClient';

interface AuthState {
  user: User | null;
  loading: boolean;
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  return { user, loading };
}

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';

/**
 * Calls the API with the current Firebase ID token attached. Use this for
 * every authenticated request — the API resolves role from Postgres, never
 * from anything the client sends.
 *
 * When `init.body` is a FormData (file uploads), Content-Type is left unset
 * so the browser can attach its own multipart boundary — setting it manually
 * to 'application/json' here would silently corrupt the upload.
 */
export async function apiFetch(path: string, init: RequestInit = {}) {
  const user = firebaseAuth.currentUser;
  if (!user) {
    // Firebase session expired or not signed in — redirect to login
    if (typeof window !== 'undefined') {
      window.location.replace('/login');
    }
    throw new Error('Not signed in');
  }

  const token = await user.getIdToken();
  const isFormData = typeof FormData !== 'undefined' && init.body instanceof FormData;

  return fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...init.headers,
      Authorization: `Bearer ${token}`,
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    },
  });
}
