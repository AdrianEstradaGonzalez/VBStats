/**
 * Tests for Settings Service
 *
 * Covers: CRUD, position initialization, batch update,
 * basic/advanced config application, error handling.
 */

import { settingsService } from '../../services/settingsService';
import {
  mockFetchSuccess,
  mockFetchError,
  setFetchMock,
  clearFetchMock,
} from '../helpers/mockFetch';

afterEach(() => clearFetchMock());

const SETTINGS = [
  { id: 1, position: 'Receptor', stat_category: 'Recepción', stat_type: 'Positivo', enabled: true, user_id: 1 },
  { id: 2, position: 'Receptor', stat_category: 'Recepción', stat_type: 'Error', enabled: true, user_id: 1 },
  { id: 3, position: 'Receptor', stat_category: 'Defensa', stat_type: 'Positivo', enabled: false, user_id: 1 },
];

// ─── getAll ──────────────────────────────────────────────────────────

describe('settingsService.getAll', () => {
  test('fetches all settings without userId', async () => {
    const mock = setFetchMock(mockFetchSuccess(SETTINGS));
    const settings = await settingsService.getAll();
    expect(settings).toHaveLength(3);
    expect(mock.mock.calls[0][0]).not.toContain('userId');
  });

  test('fetches settings filtered by userId', async () => {
    const mock = setFetchMock(mockFetchSuccess(SETTINGS));
    await settingsService.getAll(1);
    expect(mock).toHaveBeenCalledWith(expect.stringContaining('userId=1'));
  });

  test('throws on error', async () => {
    setFetchMock(mockFetchError({}, 500));
    await expect(settingsService.getAll()).rejects.toThrow('Failed to fetch settings');
  });
});

// ─── getByPosition ───────────────────────────────────────────────────

describe('settingsService.getByPosition', () => {
  test('fetches settings for Receptor', async () => {
    const receptorSettings = SETTINGS.filter(s => s.position === 'Receptor');
    const mock = setFetchMock(mockFetchSuccess(receptorSettings));
    const settings = await settingsService.getByPosition('Receptor');
    expect(settings).toHaveLength(3);
    expect(mock).toHaveBeenCalledWith(expect.stringContaining('/position/Receptor'));
  });

  test('includes userId when provided', async () => {
    const mock = setFetchMock(mockFetchSuccess([]));
    await settingsService.getByPosition('Central', 5);
    expect(mock).toHaveBeenCalledWith(expect.stringContaining('userId=5'));
  });
});

// ─── save ────────────────────────────────────────────────────────────

describe('settingsService.save', () => {
  test('saves a single setting', async () => {
    const newSetting = { ...SETTINGS[0], id: 4, stat_type: 'Neutro' };
    const mock = setFetchMock(mockFetchSuccess(newSetting));
    const result = await settingsService.save({
      position: 'Receptor',
      stat_category: 'Recepción',
      stat_type: 'Neutro',
      enabled: true,
    });
    expect(result.stat_type).toBe('Neutro');
    expect(mock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ method: 'POST' }),
    );
  });
});

// ─── batchUpdate ─────────────────────────────────────────────────────

describe('settingsService.batchUpdate', () => {
  test('sends batch of settings', async () => {
    const mock = setFetchMock(mockFetchSuccess({}));
    await settingsService.batchUpdate(
      [
        { position: 'Receptor', stat_category: 'Ataque', stat_type: 'Positivo', enabled: true },
        { position: 'Receptor', stat_category: 'Ataque', stat_type: 'Error', enabled: true },
      ],
      1,
    );
    expect(mock).toHaveBeenCalledWith(
      expect.stringContaining('/batch'),
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"user_id":1'),
      }),
    );
  });

  test('throws on error', async () => {
    setFetchMock(mockFetchError({}, 500));
    await expect(settingsService.batchUpdate([], 1)).rejects.toThrow('Failed to batch update settings');
  });
});

// ─── initPosition ────────────────────────────────────────────────────

describe('settingsService.initPosition', () => {
  test('initializes settings for a position', async () => {
    const mock = setFetchMock(mockFetchSuccess(SETTINGS));
    const settings = await settingsService.initPosition('Receptor', 1);
    expect(settings).toHaveLength(3);
    expect(mock).toHaveBeenCalledWith(
      expect.stringContaining('/init/Receptor'),
      expect.objectContaining({ method: 'POST' }),
    );
  });
});

// ─── delete ──────────────────────────────────────────────────────────

describe('settingsService.delete', () => {
  test('deletes setting by id', async () => {
    const mock = setFetchMock(mockFetchSuccess({}));
    await settingsService.delete(1);
    expect(mock).toHaveBeenCalledWith(
      expect.stringContaining('/1'),
      expect.objectContaining({ method: 'DELETE' }),
    );
  });
});

// ─── getBasicConfig / applyBasicConfig / applyAdvancedConfig ─────────

describe('settingsService config presets', () => {
  test('getBasicConfig fetches from userId=1', async () => {
    const mock = setFetchMock(mockFetchSuccess(SETTINGS));
    await settingsService.getBasicConfig();
    expect(mock).toHaveBeenCalledWith(expect.stringContaining('userId=1'));
  });

  test('applyBasicConfig sends POST with user_id', async () => {
    const mock = setFetchMock(mockFetchSuccess({}));
    await settingsService.applyBasicConfig(5);
    expect(mock).toHaveBeenCalledWith(
      expect.stringContaining('/apply-basic'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ user_id: 5 }),
      }),
    );
  });

  test('applyAdvancedConfig sends POST with user_id', async () => {
    const mock = setFetchMock(mockFetchSuccess({}));
    await settingsService.applyAdvancedConfig(5);
    expect(mock).toHaveBeenCalledWith(
      expect.stringContaining('/apply-advanced'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ user_id: 5 }),
      }),
    );
  });

  test('applyBasicConfig throws on error', async () => {
    setFetchMock(mockFetchError({}, 500));
    await expect(settingsService.applyBasicConfig(99)).rejects.toThrow('Failed to apply basic config');
  });

  test('applyAdvancedConfig throws on error', async () => {
    setFetchMock(mockFetchError({}, 500));
    await expect(settingsService.applyAdvancedConfig(99)).rejects.toThrow('Failed to apply advanced config');
  });
});
