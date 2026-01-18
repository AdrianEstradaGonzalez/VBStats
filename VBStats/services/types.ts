/**
 * Common types for API responses
 */

export interface Team {
  id: number;
  name: string;
  players?: Player[];
  playerCount?: number;
  created_at?: string;
}

export interface Player {
  id: number;
  team_id: number;
  name: string;
  position: string;
  number?: number;
  created_at?: string;
}

export interface Match {
  id: number;
  user_id: number | null;
  team_id: number | null;
  team_name?: string;
  opponent: string | null;
  date: string | null;
  location: 'home' | 'away';
  status: 'in_progress' | 'finished' | 'cancelled';
  total_sets: number;
  score_home: number | null;
  score_away: number | null;
  notes: string | null;
  created_at?: string;
  finished_at?: string | null;
}

export interface MatchCreate {
  user_id: number;
  team_id: number;
  opponent?: string;
  date?: string;
  location?: 'home' | 'away';
  notes?: string;
}

export interface MatchUpdate {
  status?: 'in_progress' | 'finished' | 'cancelled';
  total_sets?: number;
  score_home?: number;
  score_away?: number;
  notes?: string;
}

// Position state for match persistence
export interface PositionState {
  id: string;
  label: string;
  playerId: number | null;
  playerName: string | null;
  playerNumber: number | null;
}

// Action history item for match persistence  
export interface ActionHistoryItem {
  type: string;
  timestamp?: number;
  data?: {
    id?: string;
    playerId?: number;
    playerName?: string;
    playerNumber?: number | null;
    setNumber?: number;
    statSettingId?: number;
    statCategory?: string;
    statType?: string;
    timestamp?: number;
  };
}

// Stat action for in-memory tracking during a match
export interface StatActionState {
  id: string;
  playerId: number;
  playerName: string;
  playerNumber: number | null;
  setNumber: number;
  statSettingId: number;
  statCategory: string;
  statType: string;
  timestamp: number;
}

// Match state for persistence
export interface MatchState {
  positions?: PositionState[];
  current_set?: number;
  is_set_active?: boolean;
  action_history?: ActionHistoryItem[];
  pending_stats?: StatActionState[];
}

export interface Stat {
  id: number;
  match_id: number;
  player_id: number;
  metric: string;
  value: number;
  created_at?: string;
}

export interface StatSetting {
  id: number;
  position: string;
  stat_category: string;
  stat_type: string;
  enabled: boolean;
  user_id?: number;
  created_at?: string;
}

export interface StatSettingCreate {
  position: string;
  stat_category: string;
  stat_type: string;
  enabled: boolean;
  user_id?: number;
}

export interface User {
  id: number;
  email: string;
  name?: string;
  created_at?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  name?: string;
}

// Match Stats (individual button presses)
export interface MatchStat {
  id?: number;
  user_id: number;
  match_id: number;
  player_id: number;
  set_number: number;
  stat_setting_id: number;
  stat_category: string;
  stat_type: string;
  player_name?: string;
  player_number?: number;
  player_position?: string;
  created_at?: string;
}

export interface MatchStatCreate {
  user_id: number;
  match_id: number;
  player_id: number;
  set_number: number;
  stat_setting_id: number;
  stat_category: string;
  stat_type: string;
}

// Stats Summary Types
export interface TeamStatSummary {
  stat_category: string;
  stat_type: string;
  total: number;
}

export interface PlayerStatSummary {
  player_id: number;
  player_name: string;
  player_number?: number;
  player_position: string;
  stat_category: string;
  stat_type: string;
  total: number;
}

export interface SetStatSummary {
  set_number: number;
  stat_category: string;
  stat_type: string;
  total: number;
}

export interface MatchStatsSummary {
  stats: MatchStat[];
  summary: PlayerStatSummary[];
  bySet: SetStatSummary[];
}
