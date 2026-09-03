import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getDatabase } from 'firebase-admin/database';
import { getFirestore } from 'firebase-admin/firestore';
import { env } from '../env';
import { logger } from './logger';

let isInitialized = false;

if (getApps().length === 0) {
  const formattedKey = env.firebasePrivateKey ? env.firebasePrivateKey.replace(/\\n/g, '\n') : '';
  if (formattedKey && formattedKey.includes('BEGIN PRIVATE KEY')) {
    try {
      initializeApp({
        credential: cert({
          projectId: env.firebaseProjectId,
          clientEmail: env.firebaseClientEmail,
          privateKey: formattedKey,
        }),
        databaseURL: env.firebaseDatabaseUrl || undefined,
      });
      isInitialized = true;
    } catch (err: any) {
      logger.warn({ err: err.message }, 'Firebase Admin initialization failed. Firebase features will be disabled.');
    }
  } else {
    logger.warn('Firebase private key is not configured or invalid. Firebase features disabled.');
  }
} else {
  isInitialized = true;
}

export const firebaseAuth = isInitialized ? getAuth() : null;
export const firebaseDb = isInitialized && env.firebaseDatabaseUrl ? getDatabase() : null;
export const firebaseFirestore = isInitialized ? getFirestore() : null;
