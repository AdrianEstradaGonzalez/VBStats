/**
 * Matches Service
 */

import { API_ENDPOINTS } from './config';
import { Match, MatchCreate, MatchUpdate, MatchStatsSummary } from './types';

export const matchesService = {
  getAll: async (filters?: { user_id?: number; status?: string; team_id?: number }): Promise<Match[]> => {
    let url = API_ENDPOINTS.matches;
    if (filters) {
      const params = new URLSearchParams();
      if (filters.user_id) params.append('user_id', filters.user_id.toString());
      if (filters.status) params.append('status', filters.status);
      if (filters.team_id) params.append('team_id', filters.team_id.toString());
      if (params.toString()) url += `?${params.toString()}`;
    }
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch matches');
    return response.json();
  },

  getById: async (id: number): Promise<Match> => {
    const response = await fetch(`${API_ENDPOINTS.matches}/${id}`);
    if (!response.ok) throw new Error('Failed to fetch match');
    return response.json();
  },

  create: async (data: MatchCreate): Promise<Match> => {
    const response = await fetch(API_ENDPOINTS.matches, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to create match');
    return response.json();
  },

  update: async (id: number, data: MatchUpdate): Promise<Match> => {
    const response = await fetch(`${API_ENDPOINTS.matches}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to update match');
    return response.json();
  },

  delete: async (id: number): Promise<void> => {
    const response = await fetch(`${API_ENDPOINTS.matches}/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete match');
  },

  // Get match statistics
  getStats: async (matchId: number): Promise<MatchStatsSummary> => {
    const response = await fetch(`${API_ENDPOINTS.matches}/${matchId}/stats`);
    if (!response.ok) throw new Error('Failed to fetch match stats');
    return response.json();
  },

  // Finish a match
  finishMatch: async (id: number, totalSets: number): Promise<Match> => {
    return matchesService.update(id, { status: 'finished', total_sets: totalSets });
  },

  // Get user's finished matches
  getFinishedByUser: async (userId: number): Promise<Match[]> => {
    return matchesService.getAll({ user_id: userId, status: 'finished' });
  },
};
