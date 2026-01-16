/**
 * API Configuration
 * For Android Emulator, use 10.0.2.2 instead of localhost
 * For iOS Simulator, use localhost
 * For physical device, use your computer's IP address (e.g., 192.168.1.X)
 */

import { Platform } from 'react-native';

const getApiUrl = (): string => {
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
