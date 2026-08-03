/**
 * Tests for Teams Service
 *
 * Covers: CRUD operations, error handling.
 *
 * User scoping is no longer asserted here: the server derives the owner from the
 * session token, so the client must NOT put a user id in the URL or body. The tests
 * below check that it doesn't.
 */

import { teamsService } from '../../services/teamsService';
import {
  mockFetchSuccess,
  mockFetchError,
  mockFetchNetworkError,
  setFetchMock,
  clearFetchMock,
} from '../helpers/mockFetch';

afterEach(() => clearFetchMock());

const TEAMS = [
  { id: 1, name: 'Eagles', created_at: '2024-01-01' },
  { id: 2, name: 'Hawks', created_at: '2024-02-01' },
];

// ─── getAll ──────────────────────────────────────────────────────────

describe('teamsService.getAll', () => {
  test('fetches all teams for a user', async () => {
    const mock = setFetchMock(mockFetchSuccess(TEAMS));
    const teams = await teamsService.getAll(1);
    expect(teams).toHaveLength(2);
    expect(teams[0].name).toBe('Eagles');
    // The user id must not be sent: the server takes it from the session.
    expect(mock).toHaveBeenCalledWith(
      expect.not.stringContaining('user_id='),
      expect.anything(),
    );
  });

  test('returns empty array when user has no teams', async () => {
    setFetchMock(mockFetchSuccess([]));
    const teams = await teamsService.getAll(99);
    expect(teams).toEqual([]);
  });

  test('throws on server error', async () => {
    setFetchMock(mockFetchError({ error: 'fail' }, 500));
    await expect(teamsService.getAll(1)).rejects.toThrow('Failed to fetch teams');
  });
});

// ─── getById ─────────────────────────────────────────────────────────

describe('teamsService.getById', () => {
  test('fetches single team', async () => {
    const mock = setFetchMock(mockFetchSuccess(TEAMS[0]));
    const team = await teamsService.getById(1, 1);
    expect(team.name).toBe('Eagles');
    expect(mock).toHaveBeenCalledWith(
      expect.stringContaining('/1'),
      expect.anything(),
    );
  });

  test('throws on 404', async () => {
    setFetchMock(mockFetchError({ error: 'not found' }, 404));
    await expect(teamsService.getById(999, 1)).rejects.toThrow('Failed to fetch team');
  });
});

// ─── create ──────────────────────────────────────────────────────────

describe('teamsService.create', () => {
  test('creates team with correct payload', async () => {
    const newTeam = { id: 3, name: 'Ravens', created_at: '2024-03-01' };
    const mock = setFetchMock(mockFetchSuccess(newTeam));
    const team = await teamsService.create('Ravens', 1);

    expect(team.name).toBe('Ravens');
    expect(mock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'Ravens' }),
      }),
    );
  });

  test('throws on duplicate name error', async () => {
    setFetchMock(mockFetchError({ error: 'Duplicate' }, 409));
    await expect(teamsService.create('Eagles', 1)).rejects.toThrow('Failed to create team');
  });
});

// ─── update ──────────────────────────────────────────────────────────

describe('teamsService.update', () => {
  test('updates team name', async () => {
    const updated = { id: 1, name: 'Super Eagles' };
    const mock = setFetchMock(mockFetchSuccess(updated));
    const team = await teamsService.update(1, 'Super Eagles', 1);

    expect(team.name).toBe('Super Eagles');
    expect(mock).toHaveBeenCalledWith(
      expect.stringContaining('/1'),
      expect.objectContaining({ method: 'PUT' }),
    );
  });
});

// ─── delete ──────────────────────────────────────────────────────────

describe('teamsService.delete', () => {
  test('deletes team successfully', async () => {
    const mock = setFetchMock(mockFetchSuccess({}));
    await teamsService.delete(1, 1);
    expect(mock).toHaveBeenCalledWith(
      expect.stringContaining('/1'),
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  test('throws on server error', async () => {
    setFetchMock(mockFetchError({ error: 'fail' }, 500));
    await expect(teamsService.delete(1, 1)).rejects.toThrow('Failed to delete team');
  });
});
