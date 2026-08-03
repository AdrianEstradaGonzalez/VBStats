/**
 * Tests for Stats Service
 *
 * Covers: match stats (batch save, per-match, summary), user stats summary,
 * error handling.
 *
 * The legacy `stats` table methods were removed along with their endpoints — they
 * were unused by the app and returned every user's rows, so their tests went too.
 */

import { statsService } from '../../services/statsService';
import {
  mockFetchSuccess,
  mockFetchError,
  mockFetchNetworkError,
  setFetchMock,
  clearFetchMock,
  mockFetchSequence,
} from '../helpers/mockFetch';

afterEach(() => clearFetchMock());

// ─── Match Stats ─────────────────────────────────────────────────────

describe('statsService match stats', () => {
  const MATCH_STATS = [
    {
      id: 1,
      user_id: 1,
      match_id: 10,
      player_id: 1,
      set_number: 1,
      stat_setting_id: 5,
      stat_category: 'Ataque',
      stat_type: 'Positivo',
    },
    {
      id: 2,
      user_id: 1,
      match_id: 10,
      player_id: 2,
      set_number: 1,
      stat_setting_id: 3,
      stat_category: 'Recepción',
      stat_type: 'Error',
    },
  ];

  test('saveMatchStatsBatch sends stats array', async () => {
    const mock = setFetchMock(mockFetchSuccess({ success: true, inserted: 2 }));
    const result = await statsService.saveMatchStatsBatch(MATCH_STATS as any);
    expect(result.success).toBe(true);
    expect(result.inserted).toBe(2);
    expect(mock).toHaveBeenCalledWith(
      expect.stringContaining('/match-stats/batch'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ stats: MATCH_STATS }),
      }),
    );
  });

  test('saveMatchStatsBatch throws on error', async () => {
    setFetchMock(mockFetchError({}, 500));
    await expect(statsService.saveMatchStatsBatch([])).rejects.toThrow('Failed to save match stats');
  });

  test('getMatchStats fetches stats for a match', async () => {
    const mock = setFetchMock(mockFetchSuccess(MATCH_STATS));
    const stats = await statsService.getMatchStats(10);
    expect(stats).toHaveLength(2);
    expect(mock).toHaveBeenCalledWith(
      expect.stringContaining('/match-stats/10'),
      expect.anything(),
    );
  });

  test('getMatchStatsSummary fetches summary', async () => {
    const summary = {
      stats: MATCH_STATS,
      summary: [{ player_id: 1, player_name: 'Ana', stat_category: 'Ataque', stat_type: 'Positivo', total: 5, player_position: 'Receptor' }],
      bySet: [{ set_number: 1, stat_category: 'Ataque', stat_type: 'Positivo', total: 3 }],
    };
    const mock = setFetchMock(mockFetchSuccess(summary));
    const result = await statsService.getMatchStatsSummary(10);
    expect(result.summary).toHaveLength(1);
    expect(result.bySet).toHaveLength(1);
    expect(mock).toHaveBeenCalledWith(
      expect.stringContaining('/match-stats/10/summary'),
      expect.anything(),
    );
  });

  test('getUserStatsSummary fetches user aggregated stats', async () => {
    const userSummary = [
      { stat_category: 'Ataque', stat_type: 'Positivo', total: 42, matches_count: 10 },
      { stat_category: 'Recepción', stat_type: 'Error', total: 8, matches_count: 10 },
    ];
    const mock = setFetchMock(mockFetchSuccess(userSummary));
    const result = await statsService.getUserStatsSummary(1);
    expect(result).toHaveLength(2);
    expect(result[0].total).toBe(42);
    expect(mock).toHaveBeenCalledWith(
      expect.stringContaining('/user/1/summary'),
      expect.anything(),
    );
  });
});
