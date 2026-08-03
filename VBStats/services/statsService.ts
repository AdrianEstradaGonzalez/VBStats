/**
 * Stats Service
 *
 * The legacy `stats` table endpoints were removed: nothing in the app used them and
 * they exposed every user's rows. Only the match_stats system remains.
 */

import { API_ENDPOINTS } from './config';
import { MatchStat, MatchStatCreate, MatchStatsSummary } from './types';
import { apiFetch, apiFetchJson } from './http';

export const statsService = {
  /**
   * Save multiple stats at once (batch save at end of set/match)
   */
  saveMatchStatsBatch: async (stats: MatchStatCreate[]): Promise<{ success: boolean; inserted: number }> => {
    const response = await apiFetchJson(`${API_ENDPOINTS.stats}/match-stats/batch`, 'POST', { stats }, {
      // A full match can be a large payload on a slow connection; the default
      // 15s timeout was cutting saves off and losing the set's stats.
      timeoutMs: 60000,
    });
    if (!response.ok) throw new Error('Failed to save match stats');
    return response.json();
  },

  /**
   * Get all stats for a match
   */
  getMatchStats: async (matchId: number): Promise<MatchStat[]> => {
    const response = await apiFetch(`${API_ENDPOINTS.stats}/match-stats/${matchId}`);
    if (!response.ok) throw new Error('Failed to fetch match stats');
    return response.json();
  },

  /**
   * Get detailed stats summary for a match
   */
  getMatchStatsSummary: async (matchId: number): Promise<MatchStatsSummary> => {
    const response = await apiFetch(`${API_ENDPOINTS.stats}/match-stats/${matchId}/summary`);
    if (!response.ok) throw new Error('Failed to fetch match stats summary');
    return response.json();
  },

  /**
   * Get the signed-in user's all-time stats summary
   */
  getUserStatsSummary: async (userId: number): Promise<Array<{ stat_category: string; stat_type: string; total: number; matches_count: number }>> => {
    const response = await apiFetch(`${API_ENDPOINTS.stats}/user/${userId}/summary`);
    if (!response.ok) throw new Error('Failed to fetch user stats');
    return response.json();
  },
};
