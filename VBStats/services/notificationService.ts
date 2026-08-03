/**
 * Push notifications via Firebase Cloud Messaging.
 *
 * Replaces the previous stub, which called `require('expo-notifications')` in a bare
 * React Native app where that package was never installed — so the require always
 * threw, no token was ever registered, and no notification could be delivered.
 *
 * Permission model:
 *   - Android 13+ (API 33) requires the runtime POST_NOTIFICATIONS permission.
 *     Below 33 notifications are granted at install time.
 *   - iOS always requires an explicit prompt.
 *
 * We only ask once, and we remember the user's answer so a decline isn't nagged at
 * every launch. `requestPermissionAndRegister` is the entry point for the opt-in
 * screen; `syncTokenIfAlreadyGranted` is the silent path used on every login.
 */

import { Platform, PermissionsAndroid } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { adminService } from './adminService';

const PUSH_TOKEN_KEY = '@VBStats:pushToken';
const PUSH_PROMPTED_KEY = '@VBStats:pushPrompted';

export type PushPermissionStatus = 'granted' | 'denied' | 'unavailable';

/** Lazily loaded so a build without the native module still runs. */
function getMessaging(): any | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('@react-native-firebase/messaging');
    return mod.default ? mod.default() : null;
  } catch (error) {
    console.warn('Firebase messaging module not available:', error);
    return null;
  }
}

/** True once the opt-in prompt has been shown at least once. */
export const hasBeenPrompted = async (): Promise<boolean> => {
  try {
    return (await AsyncStorage.getItem(PUSH_PROMPTED_KEY)) === 'true';
  } catch {
    return false;
  }
};

const markPrompted = async (): Promise<void> => {
  try {
    await AsyncStorage.setItem(PUSH_PROMPTED_KEY, 'true');
  } catch (error) {
    console.error('Error saving push prompt flag:', error);
  }
};

/** Current permission state, without prompting. */
export const getPermissionStatus = async (): Promise<PushPermissionStatus> => {
  const messaging = getMessaging();
  if (!messaging) return 'unavailable';

  try {
    if (Platform.OS === 'android') {
      if (Platform.Version >= 33) {
        const granted = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
        );
        return granted ? 'granted' : 'denied';
      }
      return 'granted';
    }

    const authStatus = await messaging.hasPermission();
    // 1 = AUTHORIZED, 2 = PROVISIONAL
    return authStatus === 1 || authStatus === 2 ? 'granted' : 'denied';
  } catch (error) {
    console.error('Error checking notification permission:', error);
    return 'denied';
  }
};

/** Asks the OS for permission. Returns the resulting status. */
const askPermission = async (): Promise<PushPermissionStatus> => {
  const messaging = getMessaging();
  if (!messaging) return 'unavailable';

  try {
    if (Platform.OS === 'android') {
      if (Platform.Version >= 33) {
        const result = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
        );
        return result === PermissionsAndroid.RESULTS.GRANTED ? 'granted' : 'denied';
      }
      return 'granted';
    }

    const authStatus = await messaging.requestPermission();
    return authStatus === 1 || authStatus === 2 ? 'granted' : 'denied';
  } catch (error) {
    console.error('Error requesting notification permission:', error);
    return 'denied';
  }
};

/** Fetches the FCM token and sends it to the server. */
const registerToken = async (): Promise<string | null> => {
  const messaging = getMessaging();
  if (!messaging) return null;

  try {
    // On iOS the device must be registered for remote messages before asking for a
    // token, otherwise getToken() rejects.
    if (Platform.OS === 'ios' && !messaging.isDeviceRegisteredForRemoteMessages) {
      await messaging.registerDeviceForRemoteMessages();
    }

    const token = await messaging.getToken();
    if (!token) return null;

    const savedToken = await AsyncStorage.getItem(PUSH_TOKEN_KEY);
    if (savedToken === token) {
      // Already registered on the server for this account.
      return token;
    }

    await adminService.registerPushToken(token, Platform.OS as 'ios' | 'android');
    await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);
    console.log('✅ Push token registered');
    return token;
  } catch (error) {
    console.error('Error registering push token:', error);
    return null;
  }
};

export const notificationService = {
  /**
   * Shows the OS permission prompt and, if accepted, registers the device.
   * Call this from the opt-in screen — not silently on launch.
   */
  requestPermissionAndRegister: async (): Promise<PushPermissionStatus> => {
    const status = await askPermission();
    await markPrompted();
    if (status === 'granted') {
      await registerToken();
    }
    return status;
  },

  /**
   * Registers the token only if permission was already granted. Safe to call on
   * every login: it never shows a prompt.
   */
  syncTokenIfAlreadyGranted: async (): Promise<void> => {
    const status = await getPermissionStatus();
    if (status === 'granted') {
      await registerToken();
    }
  },

  getPermissionStatus,
  hasBeenPrompted,

  /**
   * Subscribes to token rotation. FCM can issue a new token at any time; if we don't
   * follow it the device silently stops receiving notifications.
   * Returns an unsubscribe function.
   */
  onTokenRefresh: (): (() => void) => {
    const messaging = getMessaging();
    if (!messaging) return () => {};
    try {
      return messaging.onTokenRefresh(async (token: string) => {
        try {
          await adminService.registerPushToken(token, Platform.OS as 'ios' | 'android');
          await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);
          console.log('🔄 Push token refreshed');
        } catch (error) {
          console.error('Error updating refreshed push token:', error);
        }
      });
    } catch (error) {
      console.error('Error subscribing to token refresh:', error);
      return () => {};
    }
  },

  /** Handles taps on a notification while the app is in the foreground. */
  onForegroundMessage: (handler: (message: { title?: string; body?: string }) => void): (() => void) => {
    const messaging = getMessaging();
    if (!messaging) return () => {};
    try {
      return messaging.onMessage(async (remoteMessage: any) => {
        handler({
          title: remoteMessage?.notification?.title,
          body: remoteMessage?.notification?.body,
        });
      });
    } catch (error) {
      console.error('Error subscribing to foreground messages:', error);
      return () => {};
    }
  },

  /** Drops the device token on logout so the next user doesn't inherit it. */
  unregister: async (): Promise<void> => {
    try {
      const token = await AsyncStorage.getItem(PUSH_TOKEN_KEY);
      if (token) {
        await adminService.removePushToken(token).catch(() => {});
      }
      await AsyncStorage.removeItem(PUSH_TOKEN_KEY);
    } catch (error) {
      console.error('Error unregistering push token:', error);
    }
  },
};
