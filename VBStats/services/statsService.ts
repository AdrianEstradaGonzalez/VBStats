/**
 * Stats Service
 */

import { API_ENDPOINTS } from './config';
import { Stat, MatchStat, MatchStatCreate, MatchStatsSummary } from './types';

export const statsService = {
  // Legacy stats methods
  getAll: async (): Promise<Stat[]> => {
    const response = await fetch(API_ENDPOINTS.stats);
    if (!response.ok) throw new Error('Failed to fetch stats');
    return response.json();
  },

  getByMatch: async (matchId: number): Promise<Stat[]> => {
    const allStats = await statsService.getAll();
    return allStats.filter(s => s.match_id === matchId);
  },

  getByPlayer: async (playerId: number): Promise<Stat[]> => {
    const allStats = await statsService.getAll();
    return allStats.filter(s => s.player_id === playerId);
  },

  create: async (data: { match_id: number; player_id: number; metric: string; value: number }): Promise<Stat> => {
    const response = await fetch(API_ENDPOINTS.stats, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to create stat');
    return response.json();
  },

  delete: async (id: number): Promise<void> => {
    const response = await fetch(`${API_ENDPOINTS.stats}/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete stat');
  },

  // ==================== Match Stats (New System) ====================

  /**
   * Save multiple stats at once (batch save at end of set/match)
   */
  saveMatchStatsBatch: async (stats: MatchStatCreate[]): Promise<{ success: boolean; inserted: number }> => {
    const response = await fetch(`${API_ENDPOINTS.stats}/match-stats/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stats }),
    });
    if (!response.ok) throw new Error('Failed to save match stats');
    return response.json();
  },

  /**
   * Get all stats for a match
   */
  getMatchStats: async (matchId: number): Promise<MatchStat[]> => {
    const response = await fetch(`${API_ENDPOINTS.stats}/match-stats/${matchId}`);
    if (!response.ok) throw new Error('Failed to fetch match stats');
    return response.json();
  },

  /**
   * Get detailed stats summary for a match
   */
  getMatchStatsSummary: async (matchId: number): Promise<MatchStatsSummary> => {
    const response = await fetch(`${API_ENDPOINTS.stats}/match-stats/${matchId}/summary`);
    if (!response.ok) throw new Error('Failed to fetch match stats summary');
    return response.json();
  },

  /**
   * Get user's all-time stats summary
   */
  getUserStatsSummary: async (userId: number): Promise<Array<{ stat_category: string; stat_type: string; total: number; matches_count: number }>> => {
    const response = await fetch(`${API_ENDPOINTS.stats}/user/${userId}/summary`);
    if (!response.ok) throw new Error('Failed to fetch user stats');
    return response.json();
  },
};
