/**
 * Local mirror of the in-progress match state.
 *
 * The match screen used to persist its state only to the server. In a sports hall
 * with no usable connection every autosave failed silently, and if the app was
 * killed the whole match — positions, score, and the stats not yet flushed — was
 * gone. Nothing was ever written to the device.
 *
 * So every save now writes here first (this cannot fail for network reasons) and
 * only then attempts the server. On restore we take whichever copy is newer, which
 * also covers "recorded offline, reopened before the server ever received it".
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { MatchState } from './types';

const KEY_PREFIX = '@VBStats:matchState:';

const keyFor = (matchId: number) => `${KEY_PREFIX}${matchId}`;

export interface CachedMatchState {
  state: MatchState;
  /** Epoch ms of the local write. */
  savedAt: number;
  /** False until the same snapshot has been accepted by the server. */
  syncedToServer: boolean;
}

/** Writes the snapshot to the device. Always call this before hitting the network. */
export async function saveLocalMatchState(
  matchId: number,
  state: MatchState,
  syncedToServer = false,
): Promise<void> {
  try {
    const payload: CachedMatchState = { state, savedAt: Date.now(), syncedToServer };
    await AsyncStorage.setItem(keyFor(matchId), JSON.stringify(payload));
  } catch (error) {
    console.error('Error saving local match state:', error);
  }
}

/** Marks the currently cached snapshot as confirmed by the server. */
export async function markSynced(matchId: number): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(keyFor(matchId));
    if (!raw) return;
    const cached: CachedMatchState = JSON.parse(raw);
    cached.syncedToServer = true;
    await AsyncStorage.setItem(keyFor(matchId), JSON.stringify(cached));
  } catch (error) {
    console.error('Error marking match state synced:', error);
  }
}

export async function loadLocalMatchState(matchId: number): Promise<CachedMatchState | null> {
  try {
    const raw = await AsyncStorage.getItem(keyFor(matchId));
    if (!raw) return null;
    return JSON.parse(raw) as CachedMatchState;
  } catch (error) {
    console.error('Error loading local match state:', error);
    return null;
  }
}

/** Called once the match is finished and its stats are safely on the server. */
export async function clearLocalMatchState(matchId: number): Promise<void> {
  try {
    await AsyncStorage.removeItem(keyFor(matchId));
  } catch (error) {
    console.error('Error clearing local match state:', error);
  }
}

/**
 * Picks the copy to restore from.
 *
 * The server copy wins on ties, but a local snapshot that never reached the server
 * is always preferred — it is by definition the more recent one.
 */
export function chooseFreshestState(
  serverState: MatchState | null,
  cached: CachedMatchState | null,
): { state: MatchState | null; source: 'server' | 'local' | 'none' } {
  if (!cached) {
    return serverState ? { state: serverState, source: 'server' } : { state: null, source: 'none' };
  }
  if (!serverState) {
    return { state: cached.state, source: 'local' };
  }
  if (!cached.syncedToServer) {
    return { state: cached.state, source: 'local' };
  }
  return { state: serverState, source: 'server' };
}

/**
 * Stats that were recorded but never accepted by the server, kept separately from
 * the match state so a failed flush can be retried on the next attempt.
 */
const PENDING_KEY_PREFIX = '@VBStats:pendingStats:';

export async function saveUnflushedStats(matchId: number, stats: unknown[]): Promise<void> {
  try {
    if (stats.length === 0) {
      await AsyncStorage.removeItem(`${PENDING_KEY_PREFIX}${matchId}`);
      return;
    }
    await AsyncStorage.setItem(`${PENDING_KEY_PREFIX}${matchId}`, JSON.stringify(stats));
  } catch (error) {
    console.error('Error saving unflushed stats:', error);
  }
}

export async function loadUnflushedStats(matchId: number): Promise<unknown[]> {
  try {
    const raw = await AsyncStorage.getItem(`${PENDING_KEY_PREFIX}${matchId}`);
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    console.error('Error loading unflushed stats:', error);
    return [];
  }
}

export async function clearUnflushedStats(matchId: number): Promise<void> {
  try {
    await AsyncStorage.removeItem(`${PENDING_KEY_PREFIX}${matchId}`);
  } catch (error) {
    console.error('Error clearing unflushed stats:', error);
  }
}
