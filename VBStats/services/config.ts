/**
 * API Configuration
 * For Android Emulator, use 10.0.2.2 instead of localhost
 * For iOS Simulator, use localhost
 * For physical device, use your computer's IP address (e.g., 192.168.1.X)
 */

import { Platform } from 'react-native';

const PROD_API_URL = 'https://vbstats.onrender.com/api';

const getApiUrl = (): string => {
  // Allow an optional developer override file to force a specific API URL
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const override = require('./overrideApiUrl') as { API_OVERRIDE_URL?: string };
    if (override && override.API_OVERRIDE_URL) {
      return override.API_OVERRIDE_URL;
    }
  } catch (e) {
    // ignore if file does not exist
  }

  // In production builds use the deployed Render URL
  if (typeof __DEV__ !== 'undefined' && !__DEV__) {
    return PROD_API_URL;
  }

  // Development: different hosts depending on platform/emulator
  if (Platform.OS === 'android') {
    // Android Emulator maps 10.0.2.2 to host's localhost
    return 'http://10.0.2.2:4000/api';
  } else if (Platform.OS === 'ios') {
    // iOS Simulator can use localhost directly
    return 'http://localhost:4000/api';
  }
  // Default fallback
  return 'http://localhost:4000/api';
};

export const API_BASE_URL = getApiUrl();

export const API_ENDPOINTS = {
  teams: `${API_BASE_URL}/teams`,
  players: `${API_BASE_URL}/players`,
  matches: `${API_BASE_URL}/matches`,
  stats: `${API_BASE_URL}/stats`,
  health: `${API_BASE_URL}/health`,
};
