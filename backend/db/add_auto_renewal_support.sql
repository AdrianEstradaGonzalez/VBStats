-- Migration: Add auto-renewal and cancellation tracking support
-- Run this script to add subscription renewal/cancellation fields

-- Add auto_renew flag (defaults to TRUE for paid subscriptions)
ALTER TABLE users
ADD COLUMN auto_renew BOOLEAN DEFAULT TRUE AFTER subscription_expires_at;

-- Add cancelled_at timestamp to know when user cancelled
ALTER TABLE users  
ADD COLUMN cancelled_at DATETIME NULL AFTER auto_renew;

-- Add index for faster expired subscription lookups (cron job)
CREATE INDEX idx_subscription_expires ON users(subscription_expires_at);
CREATE INDEX idx_auto_renew ON users(auto_renew);

-- Show updated structure
DESCRIBE users;
