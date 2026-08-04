/**
 * Push notifications via Firebase Cloud Messaging.
 *
 * IMPORTANT — API shape:
 * @react-native-firebase v26 is **modular only**. There is no default export any
 * more, so the old `require('@react-native-firebase/messaging').default()` pattern
 * silently evaluated to `undefined`: the module looked "unavailable", the OS
 * permission dialog was never shown, no token was ever registered, and every
 * broadcast reported 0 devices. Everything below uses the modular functions
 * (`getMessaging(...)`, `getToken(messaging)`, ...).
 *
 * Permission model:
 *   - Android 13+ (API 33) requires the runtime POST_NOTIFICATIONS permission, and
 *     it is `PermissionsAndroid.request` that shows the system dialog. Firebase's
 *     own `requestPermission()` resolves to AUTHORIZED on Android without
 *     prompting, so it cannot be used for this.
 *   - Below API 33 notifications are granted at install time.
 *   - iOS always prompts, through Firebase.
 */

import { Platform, PermissionsAndroid, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { adminService } from './adminService';

const PUSH_TOKEN_KEY = '@VBStats:pushToken';
// Versioned: builds before this one recorded "already asked" even though the
// prompt never actually appeared. Bumping the key re-asks those installs once.
const PUSH_PROMPTED_KEY = '@VBStats:pushPrompted:v2';

export type PushPermissionStatus = 'granted' | 'denied' | 'unavailable';

interface MessagingApi {
  messaging: any;
  getToken: (m: any) => Promise<string>;
  requestPermission: (m: any) => Promise<number>;
  hasPermission: (m: any) => Promise<number>;
  onTokenRefresh: (m: any, cb: (t: string) => void) => () => void;
  onMessage: (m: any, cb: (msg: any) => void) => () => void;
  registerDeviceForRemoteMessages: (m: any) => Promise<any>;
  isDeviceRegisteredForRemoteMessages: (m: any) => boolean;
  deleteToken: (m: any) => Promise<void>;
  AuthorizationStatus: { AUTHORIZED: number; PROVISIONAL: number };
}

/** Loads the modular API. Returns null only if the native module is missing. */
function loadMessaging(): MessagingApi | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const m = require('@react-native-firebase/messaging');
    if (typeof m.getMessaging !== 'function') {
      console.warn('Firebase messaging: modular API not found in this version');
      return null;
    }
    return {
      messaging: m.getMessaging(),
      getToken: m.getToken,
      requestPermission: m.requestPermission,
      hasPermission: m.hasPermission,
      onTokenRefresh: m.onTokenRefresh,
      onMessage: m.onMessage,
      registerDeviceForRemoteMessages: m.registerDeviceForRemoteMessages,
      isDeviceRegisteredForRemoteMessages: m.isDeviceRegisteredForRemoteMessages,
      deleteToken: m.deleteToken,
      AuthorizationStatus: m.AuthorizationStatus,
    };
  } catch (error) {
    console.warn('Firebase messaging module not available:', error);
    return null;
  }
}

const isAuthorized = (api: MessagingApi, status: number): boolean =>
  status === api.AuthorizationStatus.AUTHORIZED ||
  status === api.AuthorizationStatus.PROVISIONAL;

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
  const api = loadMessaging();
  if (!api) return 'unavailable';

  try {
    if (Platform.OS === 'android') {
      if (Number(Platform.Version) >= 33) {
        const granted = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
        );
        return granted ? 'granted' : 'denied';
      }
      return 'granted';
    }

    const status = await api.hasPermission(api.messaging);
    return isAuthorized(api, status) ? 'granted' : 'denied';
  } catch (error) {
    console.error('Error checking notification permission:', error);
    return 'denied';
  }
};

/** Shows the OS dialog. Returns the resulting status. */
const askPermission = async (api: MessagingApi): Promise<PushPermissionStatus> => {
  try {
    if (Platform.OS === 'android') {
      if (Number(Platform.Version) >= 33) {
        const result = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
        );
        return result === PermissionsAndroid.RESULTS.GRANTED ? 'granted' : 'denied';
      }
      // Below API 33 the permission is implicit.
      return 'granted';
    }

    const status = await api.requestPermission(api.messaging);
    return isAuthorized(api, status) ? 'granted' : 'denied';
  } catch (error) {
    console.error('Error requesting notification permission:', error);
    return 'denied';
  }
};

/** Fetches the FCM token and sends it to the server. */
const registerToken = async (api: MessagingApi): Promise<string | null> => {
  try {
    // iOS must be registered for remote messages before a token can be issued.
    if (Platform.OS === 'ios' && !api.isDeviceRegisteredForRemoteMessages(api.messaging)) {
      await api.registerDeviceForRemoteMessages(api.messaging);
    }

    const token = await api.getToken(api.messaging);
    if (!token) {
      console.warn('FCM returned an empty token');
      return null;
    }

    const savedToken = await AsyncStorage.getItem(PUSH_TOKEN_KEY);
    if (savedToken === token) {
      // Already registered for this account on this device.
      return token;
    }

    await adminService.registerPushToken(token, Platform.OS as 'ios' | 'android');
    await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);
    console.log('✅ Push token registered with the server');
    return token;
  } catch (error) {
    console.error('Error registering push token:', error);
    return null;
  }
};

export const notificationService = {
  /**
   * Shows the OS permission dialog and, if accepted, registers the device.
   * Call from the opt-in screen — not silently on launch.
   */
  requestPermissionAndRegister: async (): Promise<PushPermissionStatus> => {
    const api = loadMessaging();
    if (!api) {
      // Don't record a prompt that never happened, or the user would never be
      // asked again once the build is fixed.
      return 'unavailable';
    }

    const status = await askPermission(api);
    await markPrompted();

    if (status === 'granted') {
      await registerToken(api);
    }
    return status;
  },

  /**
   * Registers the token only if permission was already granted. Never prompts,
   * so it is safe to call on every login.
   */
  syncTokenIfAlreadyGranted: async (): Promise<void> => {
    const api = loadMessaging();
    if (!api) return;

    const status = await getPermissionStatus();
    if (status === 'granted') {
      await registerToken(api);
    }
  },

  getPermissionStatus,
  hasBeenPrompted,

  /**
   * Records that the user turned the offer down, so we don't ask on every login.
   * Kept here rather than writing the storage key from a screen, so the versioned
   * key lives in exactly one place.
   */
  markDeclined: async (): Promise<void> => {
    await markPrompted();
  },

  /** Opens the OS settings page so a user who declined can turn it back on. */
  openSystemSettings: async (): Promise<void> => {
    try {
      await Linking.openSettings();
    } catch (error) {
      console.error('Error opening system settings:', error);
    }
  },

  /**
   * Follows FCM token rotation. Without this a device silently stops receiving
   * notifications when its token changes. Returns an unsubscribe function.
   */
  onTokenRefresh: (): (() => void) => {
    const api = loadMessaging();
    if (!api) return () => {};
    try {
      return api.onTokenRefresh(api.messaging, async (token: string) => {
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

  /**
   * Messages received while the app is in the foreground.
   * Android only auto-displays notifications in the tray when the app is in the
   * background, so the caller shows something in-app for this case.
   */
  onForegroundMessage: (handler: (message: { title?: string; body?: string }) => void): (() => void) => {
    const api = loadMessaging();
    if (!api) return () => {};
    try {
      return api.onMessage(api.messaging, (remoteMessage: any) => {
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

  /** Drops this device's token on logout so the next user doesn't inherit it. */
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

  /** Diagnostics for the admin screen: why is this device not receiving? */
  getDiagnostics: async (): Promise<{
    moduleAvailable: boolean;
    permission: PushPermissionStatus;
    tokenRegistered: boolean;
    tokenPreview: string | null;
  }> => {
    const api = loadMessaging();
    const permission = await getPermissionStatus();
    const token = await AsyncStorage.getItem(PUSH_TOKEN_KEY).catch(() => null);
    return {
      moduleAvailable: !!api,
      permission,
      tokenRegistered: !!token,
      tokenPreview: token ? `${token.slice(0, 12)}…` : null,
    };
  },
};
