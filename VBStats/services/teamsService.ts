/**
 * Teams Service
 *
 * The server derives the owner from the session token, so `userId` arguments are kept
 * only for call-site compatibility — they are no longer sent or trusted.
 */

import { API_ENDPOINTS } from './config';
import { Team } from './types';
import { apiFetch, apiFetchJson } from './http';

export const teamsService = {
  getAll: async (_userId?: number): Promise<Team[]> => {
    const response = await apiFetch(API_ENDPOINTS.teams);
    if (!response.ok) throw new Error('Failed to fetch teams');
    return response.json();
  },

  getById: async (id: number, _userId?: number): Promise<Team> => {
    const response = await apiFetch(`${API_ENDPOINTS.teams}/${id}`);
    if (!response.ok) throw new Error('Failed to fetch team');
    return response.json();
  },

  create: async (name: string, _userId?: number): Promise<Team> => {
    const response = await apiFetchJson(API_ENDPOINTS.teams, 'POST', { name });
    if (!response.ok) throw new Error('Failed to create team');
    return response.json();
  },

  update: async (id: number, name: string, _userId?: number): Promise<Team> => {
    const response = await apiFetchJson(`${API_ENDPOINTS.teams}/${id}`, 'PUT', { name });
    if (!response.ok) throw new Error('Failed to update team');
    return response.json();
  },

  delete: async (id: number, _userId?: number): Promise<void> => {
    const response = await apiFetch(`${API_ENDPOINTS.teams}/${id}`, { method: 'DELETE' });
    if (!response.ok) throw new Error('Failed to delete team');
  },
};
