/**
 * Settings Service
 *
 * Stat settings belong to the signed-in user; the server ignores any user id sent by
 * the client. `userId` parameters are kept for call-site compatibility.
 */

import { API_BASE_URL } from './config';
import { StatSetting, StatSettingCreate } from './types';
import { apiFetch, apiFetchJson } from './http';

const SETTINGS_URL = `${API_BASE_URL}/settings`;

export const settingsService = {
  async getAll(_userId?: number): Promise<StatSetting[]> {
    const response = await apiFetch(SETTINGS_URL);
    if (!response.ok) throw new Error('Failed to fetch settings');
    return response.json();
  },

  async getByPosition(position: string, _userId?: number): Promise<StatSetting[]> {
    const response = await apiFetch(`${SETTINGS_URL}/position/${encodeURIComponent(position)}`);
    if (!response.ok) throw new Error('Failed to fetch position settings');
    return response.json();
  },

  async save(setting: StatSettingCreate): Promise<StatSetting> {
    const response = await apiFetchJson(SETTINGS_URL, 'POST', setting);
    if (!response.ok) throw new Error('Failed to save setting');
    return response.json();
  },

  async batchUpdate(settings: StatSettingCreate[], _userId?: number): Promise<void> {
    const response = await apiFetchJson(`${SETTINGS_URL}/batch`, 'POST', { settings });
    if (!response.ok) throw new Error('Failed to batch update settings');
  },

  async initPosition(position: string, _userId?: number): Promise<StatSetting[]> {
    const response = await apiFetchJson(`${SETTINGS_URL}/init/${encodeURIComponent(position)}`, 'POST');
    if (!response.ok) throw new Error('Failed to initialize position settings');
    return response.json();
  },

  async delete(id: number): Promise<void> {
    const response = await apiFetch(`${SETTINGS_URL}/${id}`, { method: 'DELETE' });
    if (!response.ok) throw new Error('Failed to delete setting');
  },

  // Aplicar configuración básica (plantilla del servidor)
  async applyBasicConfig(_userId?: number): Promise<void> {
    const response = await apiFetchJson(`${SETTINGS_URL}/apply-basic`, 'POST');
    if (!response.ok) throw new Error('Failed to apply basic config');
  },

  // Aplicar configuración avanzada (todas las opciones activadas)
  async applyAdvancedConfig(_userId?: number): Promise<void> {
    const response = await apiFetchJson(`${SETTINGS_URL}/apply-advanced`, 'POST');
    if (!response.ok) throw new Error('Failed to apply advanced config');
  },
};
