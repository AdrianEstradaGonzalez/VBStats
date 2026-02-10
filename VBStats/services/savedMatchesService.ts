/**
 * Service for persisting searched matches locally for free users.
 * Stores match references in AsyncStorage so users can revisit
 * stats without re-entering the share code each time.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Match } from './types';

const STORAGE_KEY = '@VBStats:savedMatches';

const getStorageKey = (userId?: number | string | null): string => {
  if (userId === null || userId === undefined) return STORAGE_KEY;
  return `${STORAGE_KEY}:${userId}`;
};

export interface SavedMatch {
  id: number;
  team_name?: string;
  opponent: string | null;
  date: string | null;
  score_home: number | null;
  score_away: number | null;
  share_code: string;
  saved_at: string;
}

/**
 * Get all saved matches from local storage, sorted by most recently saved.
 */
export async function getSavedMatches(userId?: number | string | null): Promise<SavedMatch[]> {
  try {
    const data = await AsyncStorage.getItem(getStorageKey(userId));
    if (!data) return [];
    const matches: SavedMatch[] = JSON.parse(data);
    // Sort by saved_at descending (most recent first)
    return matches.sort((a, b) => new Date(b.saved_at).getTime() - new Date(a.saved_at).getTime());
  } catch (error) {
    console.error('Error loading saved matches:', error);
    return [];
  }
}

/**
 * Save a match result from a code search. Avoids duplicates by match ID.
 */
export async function saveMatch(match: Match, shareCode: string, userId?: number | string | null): Promise<void> {
  try {
    const existing = await getSavedMatches(userId);
    
    // Remove any existing entry for this match (to update and move to top)
    const filtered = existing.filter(m => m.id !== match.id);
    
    const entry: SavedMatch = {
      id: match.id,
      team_name: match.team_name,
      opponent: match.opponent,
      date: match.date,
      score_home: match.score_home,
      score_away: match.score_away,
      share_code: shareCode,
      saved_at: new Date().toISOString(),
    };
    
    // Add to beginning (most recent first), limit to 50 entries
    const updated = [entry, ...filtered].slice(0, 50);
    await AsyncStorage.setItem(getStorageKey(userId), JSON.stringify(updated));
  } catch (error) {
    console.error('Error saving match:', error);
  }
}

/**
 * Remove a saved match by ID.
 */
export async function removeSavedMatch(matchId: number, userId?: number | string | null): Promise<void> {
  try {
    const existing = await getSavedMatches(userId);
    const filtered = existing.filter(m => m.id !== matchId);
    await AsyncStorage.setItem(getStorageKey(userId), JSON.stringify(filtered));
  } catch (error) {
    console.error('Error removing saved match:', error);
  }
}

export const savedMatchesService = {
  getSavedMatches,
  saveMatch,
  removeSavedMatch,
};

export default savedMatchesService;
