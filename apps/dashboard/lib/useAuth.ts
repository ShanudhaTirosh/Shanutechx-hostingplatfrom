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
export async function getAuthToken(): Promise<string> {
  let user = firebaseAuth.currentUser;
  if (!user && typeof window !== 'undefined') {
    try {
      await Promise.race([
        new Promise<void>((resolve) => {
          const unsubscribe = onAuthStateChanged(firebaseAuth, (u) => {
            user = u;
            unsubscribe();
            resolve();
          });
        }),
        new Promise<void>((_, reject) =>
          setTimeout(() => reject(new Error('Authentication timeout — please sign in again')), 5000)
        ),
      ]);
    } catch (err) {
      // Timeout or error resolving Firebase user
    }
  }
  if (!user) {
    if (typeof window !== 'undefined') {
      window.location.replace('/login');
    }
    throw new Error('Not signed in');
  }
  return user.getIdToken();
}

export async function apiFetch(path: string, init: RequestInit = {}) {
  const token = await getAuthToken();
  const isFormData = typeof FormData !== 'undefined' && init.body instanceof FormData;
  let impersonatedUserId: string | null = null;
  if (typeof window !== 'undefined') {
    try {
      const cached = localStorage.getItem('shanutechx_user_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed?.role === 'admin' || parsed?.role === 'dev') {
          impersonatedUserId = localStorage.getItem('stx_impersonate_user_id');
        }
      }
    } catch {}
  }

  const normalizedPath =
    path.startsWith('/api') || path.startsWith('http')
      ? path
      : `/api${path.startsWith('/') ? '' : '/'}${path}`;

  const isAdminPath = normalizedPath.includes('/admin');

  return fetch(`${API_BASE}${normalizedPath}`, {
    ...init,
    headers: {
      ...init.headers,
      Authorization: `Bearer ${token}`,
      ...(impersonatedUserId && !isAdminPath ? { 'X-Impersonate-User-Id': impersonatedUserId } : {}),
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    },
  });
}
