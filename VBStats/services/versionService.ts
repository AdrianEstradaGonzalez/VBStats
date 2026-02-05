/**
 * Servicio para verificación de versión de la aplicación
 * Compara la versión instalada con la versión mínima requerida del servidor
 */

import { Platform } from 'react-native';
import { API_BASE_URL } from './config';

// Versión actual de la aplicación (debe coincidir con versionName en build.gradle)
export const APP_VERSION = '1.7';

export interface VersionInfo {
  minVersion: string;
  storeUrls: {
    android: string;
    ios: string;
  };
  message: string;
}

export interface VersionCheckResult {
  needsUpdate: boolean;
  storeUrl: string;
  message: string;
}

/**
 * Compara dos versiones semánticas
 * Retorna: -1 si v1 < v2, 0 si v1 == v2, 1 si v1 > v2
 */
const compareVersions = (v1: string, v2: string): number => {
  const parts1 = v1.split('.').map(p => parseInt(p, 10) || 0);
  const parts2 = v2.split('.').map(p => parseInt(p, 10) || 0);
  
  const maxLength = Math.max(parts1.length, parts2.length);
  
  for (let i = 0; i < maxLength; i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;
    
    if (p1 < p2) return -1;
    if (p1 > p2) return 1;
  }
  
  return 0;
};

/**
 * Obtiene la información de versión del servidor
 */
export const getVersionInfo = async (): Promise<VersionInfo | null> => {
  try {
    const response = await fetch(`${API_BASE_URL}/version`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      console.warn('Error fetching version info:', response.status);
      return null;
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error checking version:', error);
    return null;
  }
};

/**
 * Verifica si la aplicación necesita actualización
 */
export const checkAppVersion = async (): Promise<VersionCheckResult> => {
  const defaultResult: VersionCheckResult = {
    needsUpdate: false,
    storeUrl: '',
    message: '',
  };
  
  try {
    const versionInfo = await getVersionInfo();
    
    if (!versionInfo) {
      return defaultResult;
    }
    
    const comparison = compareVersions(APP_VERSION, versionInfo.minVersion);
    
    if (comparison < 0) {
      // La versión instalada es menor que la mínima requerida
      return {
        needsUpdate: true,
        storeUrl: Platform.OS === 'ios' ? versionInfo.storeUrls.ios : versionInfo.storeUrls.android,
        message: versionInfo.message,
      };
    }
    
    return defaultResult;
  } catch (error) {
    console.error('Error in version check:', error);
    return defaultResult;
  }
};

export const versionService = {
  APP_VERSION,
  getVersionInfo,
  checkAppVersion,
  compareVersions,
};

export default versionService;
