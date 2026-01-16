/**
 * Teams Service
 */

import { API_ENDPOINTS } from './config';
import { Team } from './types';

export const teamsService = {
  getAll: async (userId: number): Promise<Team[]> => {
    const response = await fetch(`${API_ENDPOINTS.teams}?user_id=${userId}`);
    if (!response.ok) throw new Error('Failed to fetch teams');
    return response.json();
  },

  getById: async (id: number, userId: number): Promise<Team> => {
    const response = await fetch(`${API_ENDPOINTS.teams}/${id}?user_id=${userId}`);
    if (!response.ok) throw new Error('Failed to fetch team');
    return response.json();
  },

  create: async (name: string, userId: number): Promise<Team> => {
    const response = await fetch(API_ENDPOINTS.teams, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, user_id: userId }),
    });
    if (!response.ok) throw new Error('Failed to create team');
    return response.json();
  },

  update: async (id: number, name: string, userId: number): Promise<Team> => {
    const response = await fetch(`${API_ENDPOINTS.teams}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, user_id: userId }),
    });
    if (!response.ok) throw new Error('Failed to update team');
    return response.json();
  },

  delete: async (id: number, userId: number): Promise<void> => {
    const response = await fetch(`${API_ENDPOINTS.teams}/${id}?user_id=${userId}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete team');
  },
};
