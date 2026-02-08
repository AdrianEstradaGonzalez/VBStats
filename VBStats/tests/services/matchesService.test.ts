/**
 * Tests for Matches Service
 *
 * Covers: CRUD, filtering, match lifecycle (start → in_progress → finished),
 * match state persistence, share code generation, search by code.
 */

import { matchesService } from '../../services/matchesService';
import {
  mockFetchSuccess,
  mockFetchError,
  mockFetchNetworkError,
  setFetchMock,
  clearFetchMock,
} from '../helpers/mockFetch';

afterEach(() => clearFetchMock());

const MATCH: any = {
  id: 1,
  user_id: 1,
  team_id: 1,
  opponent: 'Team B',
  date: '2024-06-01',
  location: 'home',
  status: 'in_progress',
  total_sets: 0,
  score_home: null,
  score_away: null,
  notes: null,
  share_code: null,
};

// ─── getAll ──────────────────────────────────────────────────────────

describe('matchesService.getAll', () => {
  test('fetches all matches without filters', async () => {
    const mock = setFetchMock(mockFetchSuccess([MATCH]));
    const matches = await matchesService.getAll();
    expect(matches).toHaveLength(1);
    // No query string when no filters
    expect(mock.mock.calls[0][0]).not.toContain('?');
  });

  test('fetches with user_id filter', async () => {
    const mock = setFetchMock(mockFetchSuccess([MATCH]));
    await matchesService.getAll({ user_id: 1 });
    expect(mock).toHaveBeenCalledWith(expect.stringContaining('user_id=1'));
  });

  test('fetches with status filter', async () => {
    const mock = setFetchMock(mockFetchSuccess([]));
    await matchesService.getAll({ status: 'finished' });
    expect(mock).toHaveBeenCalledWith(expect.stringContaining('status=finished'));
  });

  test('fetches with team_id filter', async () => {
    const mock = setFetchMock(mockFetchSuccess([]));
    await matchesService.getAll({ team_id: 2 });
    expect(mock).toHaveBeenCalledWith(expect.stringContaining('team_id=2'));
  });

  test('combines multiple filters', async () => {
    const mock = setFetchMock(mockFetchSuccess([]));
    await matchesService.getAll({ user_id: 1, status: 'finished', team_id: 3 });
    const url = mock.mock.calls[0][0] as string;
    expect(url).toContain('user_id=1');
    expect(url).toContain('status=finished');
    expect(url).toContain('team_id=3');
  });

  test('throws on server error', async () => {
    setFetchMock(mockFetchError({}, 500));
    await expect(matchesService.getAll()).rejects.toThrow('Failed to fetch matches');
  });
});

// ─── getById ─────────────────────────────────────────────────────────

describe('matchesService.getById', () => {
  test('fetches single match', async () => {
    setFetchMock(mockFetchSuccess(MATCH));
    const match = await matchesService.getById(1);
    expect(match.opponent).toBe('Team B');
    expect(match.status).toBe('in_progress');
  });
});

// ─── create ──────────────────────────────────────────────────────────

describe('matchesService.create', () => {
  test('creates match with required fields', async () => {
    const mock = setFetchMock(mockFetchSuccess({ ...MATCH, id: 2 }));
    const match = await matchesService.create({
      user_id: 1,
      team_id: 1,
      opponent: 'Team C',
      location: 'away',
    });
    expect(match.id).toBe(2);
    expect(mock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"opponent":"Team C"'),
      }),
    );
  });
});

// ─── update ──────────────────────────────────────────────────────────

describe('matchesService.update', () => {
  test('updates match status', async () => {
    const updated = { ...MATCH, status: 'finished', total_sets: 3 };
    setFetchMock(mockFetchSuccess(updated));
    const match = await matchesService.update(1, { status: 'finished', total_sets: 3 });
    expect(match.status).toBe('finished');
    expect(match.total_sets).toBe(3);
  });
});

// ─── delete ──────────────────────────────────────────────────────────

describe('matchesService.delete', () => {
  test('deletes match', async () => {
    const mock = setFetchMock(mockFetchSuccess({}));
    await matchesService.delete(1);
    expect(mock).toHaveBeenCalledWith(
      expect.stringContaining('/1'),
      expect.objectContaining({ method: 'DELETE' }),
    );
  });
});

// ─── finishMatch ─────────────────────────────────────────────────────

describe('matchesService.finishMatch', () => {
  test('finishes match with sets and score', async () => {
    const finished = { ...MATCH, status: 'finished', total_sets: 3, score_home: 3, score_away: 1 };
    const mock = setFetchMock(mockFetchSuccess(finished));
    const match = await matchesService.finishMatch(1, 3, 3, 1);
    expect(match.status).toBe('finished');
    expect(match.score_home).toBe(3);
    expect(match.score_away).toBe(1);
    // Verify it used PUT
    expect(mock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ method: 'PUT' }),
    );
  });

  test('finishes match without explicit score', async () => {
    const finished = { ...MATCH, status: 'finished', total_sets: 5 };
    const mock = setFetchMock(mockFetchSuccess(finished));
    const match = await matchesService.finishMatch(1, 5);
    expect(match.total_sets).toBe(5);
  });
});

// ─── getFinishedByUser / getInProgressByUser ─────────────────────────

describe('matchesService convenience filters', () => {
  test('getFinishedByUser calls getAll with correct filters', async () => {
    const mock = setFetchMock(mockFetchSuccess([]));
    await matchesService.getFinishedByUser(5);
    const url = mock.mock.calls[0][0] as string;
    expect(url).toContain('user_id=5');
    expect(url).toContain('status=finished');
  });

  test('getInProgressByUser calls getAll with correct filters', async () => {
    const mock = setFetchMock(mockFetchSuccess([]));
    await matchesService.getInProgressByUser(5);
    const url = mock.mock.calls[0][0] as string;
    expect(url).toContain('user_id=5');
    expect(url).toContain('status=in_progress');
  });
});

// ─── Match state persistence ─────────────────────────────────────────

describe('matchesService match state', () => {
  const state = {
    positions: [{ id: 'pos1', label: 'P1', playerId: 1, playerName: 'Ana', playerNumber: 7 }],
    current_set: 2,
    is_set_active: true,
    action_history: [],
    pending_stats: [],
  };

  test('saves match state', async () => {
    const mock = setFetchMock(mockFetchSuccess({}));
    await matchesService.saveMatchState(1, state);
    expect(mock).toHaveBeenCalledWith(
      expect.stringContaining('/1/state'),
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify(state),
      }),
    );
  });

  test('retrieves match state', async () => {
    setFetchMock(mockFetchSuccess(state));
    const result = await matchesService.getMatchState(1);
    expect(result).toEqual(state);
    expect(result!.current_set).toBe(2);
  });

  test('returns null for missing state (404)', async () => {
    setFetchMock(mockFetchError({}, 404));
    const result = await matchesService.getMatchState(99);
    expect(result).toBeNull();
  });

  test('deletes match state', async () => {
    const mock = setFetchMock(mockFetchSuccess({}));
    await matchesService.deleteMatchState(1);
    expect(mock).toHaveBeenCalledWith(
      expect.stringContaining('/1/state'),
      expect.objectContaining({ method: 'DELETE' }),
    );
  });
});

// ─── Share code ──────────────────────────────────────────────────────

describe('matchesService share code', () => {
  test('generates share code', async () => {
    const mock = setFetchMock(mockFetchSuccess({ share_code: 'ABCD1234' }));
    const result = await matchesService.generateShareCode(1);
    expect(result.share_code).toBe('ABCD1234');
    expect(mock).toHaveBeenCalledWith(
      expect.stringContaining('/1/generate-code'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  test('finds match by share code', async () => {
    setFetchMock(mockFetchSuccess({ ...MATCH, share_code: 'ABCD1234' }));
    const match = await matchesService.getByShareCode('ABCD1234');
    expect(match.id).toBe(1);
  });

  test('throws on invalid share code', async () => {
    setFetchMock(mockFetchError({}, 404));
    await expect(matchesService.getByShareCode('INVALID1')).rejects.toThrow('Failed to fetch match by code');
  });
});
