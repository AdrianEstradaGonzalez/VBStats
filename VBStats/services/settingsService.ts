/**
 * Settings Service
 */

import { API_BASE_URL } from './config';
import { StatSetting, StatSettingCreate } from './types';

const SETTINGS_URL = `${API_BASE_URL}/settings`;

export const settingsService = {
  async getAll(userId?: number): Promise<StatSetting[]> {
    const url = userId ? `${SETTINGS_URL}?userId=${userId}` : SETTINGS_URL;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch settings');
    return response.json();
  },

  async getByPosition(position: string, userId?: number): Promise<StatSetting[]> {
    const url = userId 
      ? `${SETTINGS_URL}/position/${position}?userId=${userId}` 
      : `${SETTINGS_URL}/position/${position}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch position settings');
    return response.json();
  },

  async save(setting: StatSettingCreate): Promise<StatSetting> {
    const response = await fetch(SETTINGS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(setting),
    });
    if (!response.ok) throw new Error('Failed to save setting');
    return response.json();
  },

  async batchUpdate(settings: StatSettingCreate[], userId?: number): Promise<void> {
    const response = await fetch(`${SETTINGS_URL}/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings, user_id: userId }),
    });
    if (!response.ok) throw new Error('Failed to batch update settings');
  },

  async initPosition(position: string, userId?: number): Promise<StatSetting[]> {
    const response = await fetch(`${SETTINGS_URL}/init/${position}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId }),
    });
    if (!response.ok) throw new Error('Failed to initialize position settings');
    return response.json();
  },

  async delete(id: number): Promise<void> {
    const response = await fetch(`${SETTINGS_URL}/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete setting');
  },

  // Obtener la configuración del usuario de test (id 1) como plantilla básica
  async getBasicConfig(): Promise<StatSetting[]> {
    const url = `${SETTINGS_URL}?userId=1`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch basic config');
    return response.json();
  },

  // Aplicar configuración básica (copiar del usuario 1)
  async applyBasicConfig(userId: number): Promise<void> {
    const response = await fetch(`${SETTINGS_URL}/apply-basic`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId }),
    });
    if (!response.ok) throw new Error('Failed to apply basic config');
  },

  // Aplicar configuración avanzada (todas las opciones activadas)
  async applyAdvancedConfig(userId: number): Promise<void> {
    const response = await fetch(`${SETTINGS_URL}/apply-advanced`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId }),
    });
    if (!response.ok) throw new Error('Failed to apply advanced config');
  },
};
