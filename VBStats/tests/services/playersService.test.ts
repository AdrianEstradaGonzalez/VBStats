/**
 * Tests for Players Service
 *
 * Covers: CRUD, team filtering (server-side + client-side fallback),
 * error handling, position data.
 */

import { playersService } from '../../services/playersService';
import {
  mockFetchSuccess,
  mockFetchError,
  mockFetchNetworkError,
  setFetchMock,
  clearFetchMock,
  mockFetchSequence,
} from '../helpers/mockFetch';

afterEach(() => clearFetchMock());

const PLAYERS = [
  { id: 1, team_id: 1, name: 'Ana', position: 'Receptor', number: 7 },
  { id: 2, team_id: 1, name: 'Luis', position: 'Central', number: 10 },
  { id: 3, team_id: 2, name: 'Eva', position: 'Líbero', number: 3 },
];

// ─── getAll ──────────────────────────────────────────────────────────

describe('playersService.getAll', () => {
  test('fetches all players', async () => {
    setFetchMock(mockFetchSuccess(PLAYERS));
    const players = await playersService.getAll();
    expect(players).toHaveLength(3);
  });

  test('throws on server error', async () => {
    setFetchMock(mockFetchError({}, 500));
    await expect(playersService.getAll()).rejects.toThrow('Failed to fetch players');
  });
});

// ─── getById ─────────────────────────────────────────────────────────

describe('playersService.getById', () => {
  test('fetches single player', async () => {
    setFetchMock(mockFetchSuccess(PLAYERS[0]));
    const player = await playersService.getById(1);
    expect(player.name).toBe('Ana');
    expect(player.position).toBe('Receptor');
  });
});

// ─── getByTeam ───────────────────────────────────────────────────────

describe('playersService.getByTeam', () => {
  test('fetches players by team via server filtering', async () => {
    const team1Players = PLAYERS.filter(p => p.team_id === 1);
    const mock = setFetchMock(mockFetchSuccess(team1Players));
    const players = await playersService.getByTeam(1);
    expect(players).toHaveLength(2);
    expect(mock).toHaveBeenCalledWith(expect.stringContaining('team_id=1'));
  });

  test('falls back to client-side filtering on server error', async () => {
    // First call (server filter) fails, then second call (getAll) succeeds
    mockFetchSequence([
      { error: {}, status: 500 },
      { data: PLAYERS },
    ]);
    const players = await playersService.getByTeam(1);
    expect(players).toHaveLength(2);
    expect(players.every(p => p.team_id === 1)).toBe(true);
  });

  test('returns empty array for invalid teamId (NaN)', async () => {
    const players = await playersService.getByTeam(NaN);
    expect(players).toEqual([]);
  });
});

// ─── create ──────────────────────────────────────────────────────────

describe('playersService.create', () => {
  test('creates player with all fields', async () => {
    const newPlayer = { id: 4, team_id: 1, name: 'Carlos', position: 'Opuesto', number: 14 };
    const mock = setFetchMock(mockFetchSuccess(newPlayer));
    const player = await playersService.create({
      name: 'Carlos',
      team_id: 1,
      position: 'Opuesto',
      number: 14,
    });

    expect(player.name).toBe('Carlos');
    expect(player.number).toBe(14);
    expect(mock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"name":"Carlos"'),
      }),
    );
  });

  test('creates player without number', async () => {
    const newPlayer = { id: 5, team_id: 2, name: 'Sara', position: 'Colocador' };
    setFetchMock(mockFetchSuccess(newPlayer));
    const player = await playersService.create({
      name: 'Sara',
      team_id: 2,
      position: 'Colocador',
    });
    expect(player.name).toBe('Sara');
  });

  test('throws on error with details', async () => {
    setFetchMock(mockFetchError('Validation failed', 422));
    await expect(
      playersService.create({ name: '', team_id: 1, position: 'Receptor' }),
    ).rejects.toThrow();
  });
});

// ─── update ──────────────────────────────────────────────────────────

describe('playersService.update', () => {
  test('updates player data', async () => {
    const updated = { id: 1, team_id: 1, name: 'Ana Maria', position: 'Opuesto', number: 7 };
    setFetchMock(mockFetchSuccess(updated));
    const player = await playersService.update(1, {
      name: 'Ana Maria',
      team_id: 1,
      position: 'Opuesto',
      number: 7,
    });
    expect(player.name).toBe('Ana Maria');
    expect(player.position).toBe('Opuesto');
  });
});

// ─── delete ──────────────────────────────────────────────────────────

describe('playersService.delete', () => {
  test('deletes player', async () => {
    const mock = setFetchMock(mockFetchSuccess({}));
    await playersService.delete(1);
    expect(mock).toHaveBeenCalledWith(
      expect.stringContaining('/1'),
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  test('throws on error', async () => {
    setFetchMock(mockFetchError({}, 500));
    await expect(playersService.delete(999)).rejects.toThrow('Failed to delete player');
  });
});
