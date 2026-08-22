import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { api } from './api';

/**
 * UNTESTED AGAINST A LIVE DEVICE — see apps/api/src/lib/pushNotifications.ts
 * for the full context. This is the client half: request permission, get a
 * real Expo push token via expo-notifications (the documented API — this
 * is not a custom FCM/APNs integration), and sync it with the backend on
 * sign-in/sign-out. The registration flow itself is standard and correct
 * against Expo's docs; it has never actually run on a phone or simulator
 * in the sandbox that wrote it.
 */

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

let cachedToken: string | null = null;

/**
 * Requests notification permission (no-ops quietly if denied — this is a
 * "nice to have" for a staff app that also works fine via pull-to-refresh,
 * not something to nag the user about) and registers the resulting Expo
 * push token with the backend. Call after a successful sign-in.
 */
export async function registerForPushNotifications(): Promise<void> {
  if (!Device.isDevice) {
    // Push tokens don't work in the iOS Simulator / most Android emulators
    // — skip silently rather than throw during local development.
    return;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    return; // user declined — the app still works fully via pull-to-refresh
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.expoConfig?.extra?.projectId ??
    'c49bd60d-8872-42fa-8bda-af59a43d634a'; // matches app.json projectId
  const { data: expoToken } = await Notifications.getExpoPushTokenAsync({ projectId });

  cachedToken = expoToken;

  try {
    await api.pushTokens.register(expoToken, Platform.OS === 'ios' ? 'ios' : 'android');
  } catch {
    // Non-fatal — the app is fully usable without push, and a transient
    // registration failure shouldn't block sign-in.
  }
}

/** Call on sign-out so a shared/reset device stops receiving pushes meant for the signed-out user. */
export async function unregisterPushNotifications(): Promise<void> {
  if (!cachedToken) return;
  try {
    await api.pushTokens.unregister(cachedToken);
  } catch {
    // Non-fatal — worst case the token lingers server-side until Expo
    // reports it dead on a future send (see pushNotifications.ts cleanup).
  } finally {
    cachedToken = null;
  }
}
