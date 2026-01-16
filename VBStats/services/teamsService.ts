/**
 * Teams Service
 */

import { API_ENDPOINTS } from './config';
import { Team } from './types';

export const teamsService = {
  getAll: async (): Promise<Team[]> => {
    const response = await fetch(API_ENDPOINTS.teams);
    if (!response.ok) throw new Error('Failed to fetch teams');
    return response.json();
  },

  getById: async (id: number): Promise<Team> => {
    const response = await fetch(`${API_ENDPOINTS.teams}/${id}`);
    if (!response.ok) throw new Error('Failed to fetch team');
    return response.json();
  },

  create: async (name: string): Promise<Team> => {
    const response = await fetch(API_ENDPOINTS.teams, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (!response.ok) throw new Error('Failed to create team');
    return response.json();
  },

  update: async (id: number, name: string): Promise<Team> => {
    const response = await fetch(`${API_ENDPOINTS.teams}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (!response.ok) throw new Error('Failed to update team');
    return response.json();
  },

  delete: async (id: number): Promise<void> => {
    const response = await fetch(`${API_ENDPOINTS.teams}/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete team');
  },
};
