import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getDatabase } from 'firebase-admin/database';
import { env } from '../env';

if (getApps().length === 0) {
  initializeApp({
    credential: cert({
      projectId: env.firebaseProjectId,
      clientEmail: env.firebaseClientEmail,
      privateKey: env.firebasePrivateKey,
    }),
    // Only needed for the live-chat admin sync (lib/chatAdminSync.ts).
    // Safe to leave unset elsewhere — getDatabase() just won't be called.
    databaseURL: env.firebaseDatabaseUrl || undefined,
  });
}

export const firebaseAuth = getAuth();
export const firebaseDb = env.firebaseDatabaseUrl ? getDatabase() : null;
