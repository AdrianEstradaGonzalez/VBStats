/**
 * One-time script: Set auto_renew=FALSE for existing demo users
 * so the scheduler will downgrade them when demo period ends.
 */
const { pool } = require('../db');

async function fixDemoUsers() {
  try {
    const [result] = await pool.query(
      `UPDATE users SET auto_renew = FALSE 
       WHERE subscription_type = 'pro' 
         AND subscription_expires_at = '2026-09-30 23:59:59' 
         AND stripe_subscription_id IS NULL 
         AND apple_original_transaction_id IS NULL 
         AND auto_renew = TRUE`
    );
    console.log(`Updated ${result.affectedRows} demo user(s) to auto_renew=FALSE`);
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    process.exit(0);
  }
}

fixDemoUsers();
