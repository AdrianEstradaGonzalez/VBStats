const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function checkUserPlan(email) {
  const connectionUrl = process.env.MYSQL_PUBLIC_URL || process.env.MYSQL_URL;
  const pool = connectionUrl
    ? mysql.createPool(connectionUrl)
    : mysql.createPool({
        host: process.env.MYSQL_HOST || '127.0.0.1',
        port: process.env.MYSQL_PORT ? Number(process.env.MYSQL_PORT) : 3306,
        user: process.env.MYSQL_USER || 'root',
        password: process.env.MYSQL_PASSWORD || '',
        database: process.env.MYSQL_DATABASE || 'vbstats',
      });

  try {
    const [rows] = await pool.query(
      `SELECT id, email, name, subscription_type, subscription_expires_at, 
              auto_renew, cancelled_at, stripe_customer_id, stripe_subscription_id,
              apple_original_transaction_id, apple_transaction_id, apple_product_id, 
              trial_used, trial_started_at, trial_ends_at, trial_plan_type 
       FROM users WHERE email = ?`,
      [email]
    );
    
    if (rows.length === 0) {
      console.log('Usuario no encontrado:', email);
    } else {
      console.log('=== Estado actual del usuario ===');
      console.log(JSON.stringify(rows[0], null, 2));
    }

    // Also check device_trials
    if (rows.length > 0) {
      const [deviceRows] = await pool.query(
        'SELECT * FROM device_trials WHERE user_id = ?',
        [rows[0].id]
      );
      console.log('\n=== Device trials ===');
      console.log(JSON.stringify(deviceRows, null, 2));
    }
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

const email = process.argv[2] || 'ricardoromanovarone4@gmail.com';
checkUserPlan(email);
