-- Migration: Add subscription support to users and share_code to matches
-- Run this script to add subscription and sharing support

-- Add subscription fields to users table
ALTER TABLE users 
ADD COLUMN subscription_type ENUM('free', 'basic', 'pro') DEFAULT 'free' AFTER name,
ADD COLUMN subscription_expires_at DATETIME NULL AFTER subscription_type,
ADD COLUMN stripe_customer_id VARCHAR(255) NULL AFTER subscription_expires_at,
ADD COLUMN stripe_subscription_id VARCHAR(255) NULL AFTER stripe_customer_id;

-- Add share_code to matches table
ALTER TABLE matches 
ADD COLUMN share_code VARCHAR(8) NULL AFTER notes,
ADD UNIQUE INDEX idx_share_code (share_code);

-- Create index for faster subscription lookups
CREATE INDEX idx_subscription_type ON users(subscription_type);

-- Show table structures after migration
DESCRIBE users;
DESCRIBE matches;
