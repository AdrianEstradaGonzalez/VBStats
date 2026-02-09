/**
 * Sistema de temas centralizado para VBStats
 * Colores y estilos globales de la aplicación
 */

import { Platform, StatusBar, Dimensions, NativeModules } from 'react-native';

const { StatusBarManager } = NativeModules;
const { height: SCREEN_HEIGHT } = Dimensions.get('window');

/**
 * Get the iOS status bar height.
 * - Devices with Dynamic Island (iPhone 14 Pro+, 15, 16): ~59pt
 * - Devices with notch (iPhone X-14): ~47-50pt
 * - Devices without notch (iPad, older iPhones): ~20pt
 * On Android, StatusBar.currentHeight works correctly.
 */
const getStatusBarHeight = (): number => {
  if (Platform.OS === 'android') {
    return StatusBar.currentHeight || 24;
  }
  // iOS: Estimate based on screen height
  // iPhone X+ have screen heights >= 812pt
  if (Platform.OS === 'ios') {
    // iPads and older iPhones (no notch)
    if (SCREEN_HEIGHT < 812) {
      return 20;
    }
    // iPhone 14 Pro, 15, 16 (Dynamic Island) have height >= 852
    if (SCREEN_HEIGHT >= 852) {
      return 59;
    }
    // iPhone X, XS, 11 Pro, 12 mini, 13 mini, etc (notch)
    return 50;
  }
  return 0;
};

export const SAFE_AREA_TOP = getStatusBarHeight();

export const Colors = {
  // Colores principales
  primary: '#e21d66',
  secondary: '#010000',
  tertiary: '#1c1a22',
  accent: '#f59e0b',
  
  // Variantes del primario
  primaryLight: '#ff4d8f',
  primaryDark: '#b31551',
  
  // Colores de fondo
  background: '#010000',
  backgroundLight: '#1a1a1a',
  surface: '#241f2b',
  surfaceLight: '#2f2836',
  
  // Colores de texto
  text: '#ffffff',
  textSecondary: '#b0b0b0',
  textTertiary: '#808080',
  textOnPrimary: '#ffffff',
  
  // Colores de estado
  success: '#10b981',
  error: '#ef4444',
  warning: '#f59e0b',
  info: '#3b82f6',
  
  // Colores de borde y sombras
  border: '#2f2836',
  borderLight: '#3a3242',
  shadow: 'rgba(226, 29, 102, 0.3)',
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const BorderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
};

export const FontSizes = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  display: 48,
};

export const FontWeights = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  extrabold: '800' as const,
};

export const Shadows = {
  sm: {
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 2,
  },
  md: {
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 4,
  },
  lg: {
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.37,
    shadowRadius: 7.49,
    elevation: 6,
  },
};

export const Theme = {
  colors: Colors,
  spacing: Spacing,
  borderRadius: BorderRadius,
  fontSize: FontSizes,
  fontWeight: FontWeights,
  shadows: Shadows,
};

export default Theme;
