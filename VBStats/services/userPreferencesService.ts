/**
 * User Preferences Service
 * Stores lightweight per-user preferences in AsyncStorage.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFS_KEY_PREFIX = '@VBStats:userPrefs';

export interface UserPreferences {
  showScoreboard: boolean;
}

const DEFAULT_PREFERENCES: UserPreferences = {
  showScoreboard: true,
};

const getKey = (userId?: number | null): string =>
  userId ? `${PREFS_KEY_PREFIX}:${userId}` : PREFS_KEY_PREFIX;

export const userPreferencesService = {
  async load(userId?: number | null): Promise<UserPreferences> {
    try {
      const raw = await AsyncStorage.getItem(getKey(userId));
      if (!raw) return { ...DEFAULT_PREFERENCES };
      return { ...DEFAULT_PREFERENCES, ...JSON.parse(raw) };
    } catch {
      return { ...DEFAULT_PREFERENCES };
    }
  },

  async save(prefs: Partial<UserPreferences>, userId?: number | null): Promise<void> {
    try {
      const current = await userPreferencesService.load(userId);
      const merged = { ...current, ...prefs };
      await AsyncStorage.setItem(getKey(userId), JSON.stringify(merged));
    } catch {
      // Silently fail — preferences are non-critical
    }
  },
};
