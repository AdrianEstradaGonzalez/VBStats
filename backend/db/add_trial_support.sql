-- Migration: Add free trial support
-- Run this script to add trial tracking columns to users table

-- Add trial tracking fields to users table
ALTER TABLE users 
ADD COLUMN trial_used BOOLEAN DEFAULT FALSE AFTER stripe_subscription_id,
ADD COLUMN trial_started_at DATETIME NULL AFTER trial_used,
ADD COLUMN trial_ends_at DATETIME NULL AFTER trial_started_at,
ADD COLUMN trial_plan_type ENUM('basic', 'pro') NULL AFTER trial_ends_at;

-- Create table to track device IDs that have used trials (to prevent abuse)
CREATE TABLE IF NOT EXISTS device_trials (
  id INT AUTO_INCREMENT PRIMARY KEY,
  device_id VARCHAR(255) NOT NULL UNIQUE,
  user_id INT NOT NULL,
  plan_type ENUM('basic', 'pro') NOT NULL,
  trial_started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  trial_ended_at DATETIME NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_device_id (device_id)
);

-- Show table structures after migration
DESCRIBE users;
DESCRIBE device_trials;
