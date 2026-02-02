-- Migration: Add Apple IAP support fields to users table
-- Run this migration to add Apple In-App Purchase support

-- Add Apple IAP fields to users table
ALTER TABLE users
ADD COLUMN apple_original_transaction_id VARCHAR(255) NULL AFTER stripe_subscription_id,
ADD COLUMN apple_transaction_id VARCHAR(255) NULL AFTER apple_original_transaction_id,
ADD COLUMN apple_product_id VARCHAR(255) NULL AFTER apple_transaction_id;

-- Add index for faster lookups by Apple transaction ID
CREATE INDEX idx_users_apple_transaction ON users(apple_original_transaction_id);

-- Update comment on table
ALTER TABLE users COMMENT = 'Users table with Stripe and Apple IAP subscription support';
