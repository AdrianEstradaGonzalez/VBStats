/**
 * Matches Service
 */

import { API_ENDPOINTS } from './config';
import { Match, MatchCreate, MatchUpdate, MatchStatsSummary, MatchState } from './types';

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
  finishMatch: async (
    id: number, 
    totalSets: number,
    scoreHome?: number | null,
    scoreAway?: number | null
  ): Promise<Match> => {
    const updateData: MatchUpdate = { 
      status: 'finished', 
      total_sets: totalSets 
    };
    
    if (scoreHome !== undefined && scoreHome !== null) {
      updateData.score_home = scoreHome;
    }
    if (scoreAway !== undefined && scoreAway !== null) {
      updateData.score_away = scoreAway;
    }
    
    return matchesService.update(id, updateData);
  },

  // Get user's finished matches
  getFinishedByUser: async (userId: number): Promise<Match[]> => {
    return matchesService.getAll({ user_id: userId, status: 'finished' });
  },

  // Get in-progress matches for user
  getInProgressByUser: async (userId: number): Promise<Match[]> => {
    return matchesService.getAll({ user_id: userId, status: 'in_progress' });
  },

  // Save match state for persistence (positions, pending stats, etc.)
  saveMatchState: async (matchId: number, state: MatchState): Promise<void> => {
    const response = await fetch(`${API_ENDPOINTS.matches}/${matchId}/state`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state),
    });
    if (!response.ok) throw new Error('Failed to save match state');
  },

  // Get match state for resuming
  getMatchState: async (matchId: number): Promise<MatchState | null> => {
    try {
      const response = await fetch(`${API_ENDPOINTS.matches}/${matchId}/state`);
      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error('Failed to fetch match state');
      }
      return response.json();
    } catch (error) {
      console.log('No match state found:', error);
      return null;
    }
  },

  // Delete match state when match is finished
  deleteMatchState: async (matchId: number): Promise<void> => {
    const response = await fetch(`${API_ENDPOINTS.matches}/${matchId}/state`, {
      method: 'DELETE',
    });
    if (!response.ok && response.status !== 404) {
      throw new Error('Failed to delete match state');
    }
  },
};
