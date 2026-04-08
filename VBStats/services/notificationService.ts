/**
 * Push Notification Service - Registers device for push notifications
 * Uses Expo's push notification infrastructure (expo-notifications)
 * For bare React Native, we use a simple fetch to Expo push API after manual token retrieval.
 */

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { adminService } from './adminService';

const PUSH_TOKEN_KEY = '@VBStats:pushToken';

/**
 * Get the Expo push token.
 * In a bare React Native app without expo-notifications, you need to install
 * either expo-notifications or use react-native-push-notification.
 * For simplicity, this checks if expo-notifications is available and falls back gracefully.
 */
async function getExpoPushToken(): Promise<string | null> {
  try {
    // Try to use expo-notifications if available
    const Notifications = require('expo-notifications');
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Push notification permission not granted');
      return null;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync();
    return tokenData.data;
  } catch {
    // expo-notifications not available — try react-native-push-notification or skip
    console.log('expo-notifications not available, push tokens won\'t be registered');
    return null;
  }
}

export const notificationService = {
  /**
   * Register the device for push notifications and send token to server
   */
  registerForPushNotifications: async (userId: number): Promise<void> => {
    try {
      const token = await getExpoPushToken();
      if (!token) return;

      // Save locally to avoid re-registering same token
      const savedToken = await AsyncStorage.getItem(PUSH_TOKEN_KEY);
      if (savedToken === token) return;

      await adminService.registerPushToken(
        userId,
        token,
        Platform.OS as 'ios' | 'android'
      );

      await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);
      console.log('✅ Push token registered:', token.substring(0, 20) + '...');
    } catch (error) {
      console.error('Error registering push token:', error);
    }
  },
};
