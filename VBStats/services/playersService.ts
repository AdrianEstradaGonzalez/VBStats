/**
 * Players Service
 *
 * `getAll` now returns only the players of the signed-in user's own teams.
 */

import { API_ENDPOINTS } from './config';
import { Player } from './types';
import { apiFetch, apiFetchJson } from './http';

export const playersService = {
  getAll: async (): Promise<Player[]> => {
    const response = await apiFetch(API_ENDPOINTS.players);
    if (!response.ok) throw new Error('Failed to fetch players');
    return response.json();
  },

  getById: async (id: number): Promise<Player> => {
    const response = await apiFetch(`${API_ENDPOINTS.players}/${id}`);
    if (!response.ok) throw new Error('Failed to fetch player');
    return response.json();
  },

  getByTeam: async (teamId: number): Promise<Player[]> => {
    const normalizedTeamId = Number(teamId);
    if (Number.isNaN(normalizedTeamId)) {
      console.warn('[playersService.getByTeam] Invalid teamId:', teamId);
      return [];
    }
    try {
      const response = await apiFetch(`${API_ENDPOINTS.players}?team_id=${normalizedTeamId}`);
      if (!response.ok) throw new Error(`Server returned ${response.status}`);
      const players = await response.json();
      if (Array.isArray(players)) return players;
      console.warn('[playersService.getByTeam] Response is not an array, falling back');
    } catch (serverError) {
      console.warn('[playersService.getByTeam] Server filter failed, falling back to client filter:', serverError);
    }
    // Fallback: fetch the user's players and filter client-side
    const allPlayers = await playersService.getAll();
    return allPlayers.filter(p => Number(p.team_id) === normalizedTeamId);
  },

  create: async (data: { name: string; team_id: number; position: string; number?: number }): Promise<Player> => {
    const response = await apiFetchJson(API_ENDPOINTS.players, 'POST', data, {
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Create player error response:', errorText);
      throw new Error(`Failed to create player: ${response.status}`);
    }

    return response.json();
  },

  update: async (id: number, data: { name: string; team_id: number; position: string; number?: number }): Promise<Player> => {
    const response = await apiFetchJson(`${API_ENDPOINTS.players}/${id}`, 'PUT', data);
    if (!response.ok) throw new Error('Failed to update player');
    return response.json();
  },

  delete: async (id: number): Promise<void> => {
    const response = await apiFetch(`${API_ENDPOINTS.players}/${id}`, { method: 'DELETE' });
    if (!response.ok) throw new Error('Failed to delete player');
  },
};
