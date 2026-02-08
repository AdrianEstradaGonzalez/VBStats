/**
 * Subscription Scheduler
 * 
 * Runs periodic checks for:
 * 1. Expired subscriptions that should be downgraded to free
 * 2. Cancelled subscriptions past their end date
 * 
 * This runs every 15 minutes to check for expired subscriptions
 * and downgrade users who cancelled or whose subscription expired.
 * 
 * Data is NEVER deleted - users keep all their teams, players, matches, etc.
 * Only the subscription_type is changed to 'free'.
 */

const { pool } = require('../db');

const CHECK_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Check for expired subscriptions and downgrade to free.
 * 
 * Cases handled:
 * 1. User cancelled (auto_renew = FALSE) and subscription_expires_at has passed
 *    → Downgrade to free, keep all data
 * 
 * 2. Subscription expired (subscription_expires_at passed) and no auto-renewal
 *    → Downgrade to free, keep all data
 * 
 * Note: For Stripe, auto-renewal is handled by Stripe itself via webhooks.
 * For Apple IAP, auto-renewal is handled by Apple's S2S notifications.
 * This scheduler is a safety net to catch any missed webhook events.
 */
async function checkExpiredSubscriptions() {
  try {
    // Find users with expired subscriptions who are still on paid plans
    const [expiredUsers] = await pool.query(`
      SELECT id, email, subscription_type, subscription_expires_at, 
             auto_renew, cancelled_at, stripe_subscription_id, apple_original_transaction_id
      FROM users 
      WHERE subscription_type IN ('basic', 'pro')
        AND subscription_expires_at IS NOT NULL
        AND subscription_expires_at < NOW()
        AND auto_renew = FALSE
    `);

    if (expiredUsers.length > 0) {
      console.log(`⏰ Found ${expiredUsers.length} expired cancelled subscription(s) to downgrade`);
    }

    for (const user of expiredUsers) {
      try {
        // Downgrade to free - DO NOT delete any data
        await pool.query(
          `UPDATE users SET 
            subscription_type = 'free',
            auto_renew = FALSE
          WHERE id = ?`,
          [user.id]
        );
        
        console.log(`✅ User ${user.id} (${user.email}) downgraded from ${user.subscription_type} to free (subscription expired after cancellation)`);
      } catch (err) {
        console.error(`❌ Error downgrading user ${user.id}:`, err.message);
      }
    }

    // Also check for users with expired subscriptions but auto_renew still TRUE
    // This catches cases where the payment gateway webhook was missed
    // We give a 2-day grace period for payment processing
    const [overdueUsers] = await pool.query(`
      SELECT id, email, subscription_type, subscription_expires_at, 
             stripe_subscription_id, apple_original_transaction_id
      FROM users 
      WHERE subscription_type IN ('basic', 'pro')
        AND subscription_expires_at IS NOT NULL
        AND subscription_expires_at < DATE_SUB(NOW(), INTERVAL 2 DAY)
        AND auto_renew = TRUE
    `);

    if (overdueUsers.length > 0) {
      console.log(`⚠️ Found ${overdueUsers.length} overdue subscription(s) (2+ days past expiry with auto_renew=true)`);
    }

    for (const user of overdueUsers) {
      try {
        // Check with Stripe if subscription is still active
        if (user.stripe_subscription_id) {
          const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
          if (STRIPE_SECRET_KEY && !STRIPE_SECRET_KEY.startsWith('sk_test_tu_clave') && STRIPE_SECRET_KEY !== 'sk_test_placeholder') {
            try {
              const stripe = require('stripe')(STRIPE_SECRET_KEY);
              const sub = await stripe.subscriptions.retrieve(user.stripe_subscription_id);
              
              if (sub.status === 'active' || sub.status === 'trialing') {
                // Subscription is still active in Stripe, update local expiry
                await pool.query(
                  `UPDATE users SET subscription_expires_at = FROM_UNIXTIME(?) WHERE id = ?`,
                  [sub.current_period_end, user.id]
                );
                console.log(`🔄 User ${user.id} subscription still active in Stripe, updated expiry`);
                continue;
              }
              
              if (sub.cancel_at_period_end) {
                // Stripe has it marked for cancellation
                await pool.query(
                  `UPDATE users SET auto_renew = FALSE, cancelled_at = NOW() WHERE id = ?`,
                  [user.id]
                );
                console.log(`🔄 User ${user.id} subscription marked for cancellation in Stripe`);
                continue;
              }
            } catch (stripeErr) {
              console.error(`⚠️ Could not verify Stripe subscription for user ${user.id}:`, stripeErr.message);
            }
          }
        }

        // If we couldn't verify with Stripe/Apple, and it's been 2+ days, downgrade
        await pool.query(
          `UPDATE users SET 
            subscription_type = 'free',
            auto_renew = FALSE
          WHERE id = ?`,
          [user.id]
        );
        console.log(`⚠️ User ${user.id} (${user.email}) downgraded due to overdue subscription (no renewal detected)`);
      } catch (err) {
        console.error(`❌ Error checking overdue user ${user.id}:`, err.message);
      }
    }
  } catch (error) {
    console.error('❌ Error in checkExpiredSubscriptions:', error);
  }
}

/**
 * Start the subscription scheduler
 */
function startSubscriptionScheduler() {
  console.log(`⏰ Subscription scheduler started (checking every ${CHECK_INTERVAL_MS / 60000} minutes)`);
  
  // Run immediately on start
  checkExpiredSubscriptions();
  
  // Then run periodically
  const intervalId = setInterval(checkExpiredSubscriptions, CHECK_INTERVAL_MS);
  
  return intervalId;
}

module.exports = { startSubscriptionScheduler, checkExpiredSubscriptions };
