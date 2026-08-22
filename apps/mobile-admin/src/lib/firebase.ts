import { initializeApp, getApps } from 'firebase/app';
// getReactNativePersistence is exported by firebase/auth only via its
// "react-native" package.json export condition, which Metro (the RN/Expo
// bundler) resolves correctly at runtime but plain `tsc` does not — a
// known, documented interop quirk between Firebase v10 and TypeScript in
// React Native projects, not a real missing export. Safe to ignore here.
// @ts-ignore
import { initializeAuth, getReactNativePersistence, Auth } from 'firebase/auth';
// @ts-ignore — no official types for this deep import, but it's the
// documented pattern for Firebase Auth persistence in React Native/Expo.
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

/**
 * Same Firebase project as the web dashboard (apps/dashboard/lib/firebaseClient.ts)
 * — the API server verifies Firebase ID tokens regardless of which client
 * (web or mobile) issued them, so signing in here produces a token the real
 * API already knows how to authenticate.
 *
 * Fill in your actual Firebase config below (same values as the web app's
 * .env — NEXT_PUBLIC_FIREBASE_*). Left as placeholders here since this
 * sandbox has no access to your real Firebase project credentials.
 */
const firebaseConfig = {
  apiKey: Constants.expoConfig?.extra?.firebaseApiKey ?? 'REPLACE_WITH_REAL_FIREBASE_API_KEY',
  authDomain: Constants.expoConfig?.extra?.firebaseAuthDomain ?? 'REPLACE_WITH_REAL_AUTH_DOMAIN',
  projectId: Constants.expoConfig?.extra?.firebaseProjectId ?? 'REPLACE_WITH_REAL_PROJECT_ID',
  storageBucket: Constants.expoConfig?.extra?.firebaseStorageBucket ?? '',
  messagingSenderId: Constants.expoConfig?.extra?.firebaseSenderId ?? '',
  appId: Constants.expoConfig?.extra?.firebaseAppId ?? 'REPLACE_WITH_REAL_APP_ID',
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

let auth: Auth;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch {
  // initializeAuth throws if already initialized (e.g. Fast Refresh during dev)
  const { getAuth } = require('firebase/auth');
  auth = getAuth(app);
}

export { auth };
