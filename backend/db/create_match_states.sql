-- Create match_states table for persisting match state
-- This allows resuming matches that were interrupted
--
-- Run this migration to enable match state persistence:
-- mysql -u root -p vbstats < db/create_match_states.sql

CREATE TABLE IF NOT EXISTS match_states (
  id INT AUTO_INCREMENT PRIMARY KEY,
  match_id INT NOT NULL UNIQUE,
  state_json JSON NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE
);

-- Index for faster lookups by match_id
CREATE INDEX idx_match_states_match_id ON match_states(match_id);
