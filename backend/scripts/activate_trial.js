const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function activateTrial(email) {
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

  const conn = await pool.getConnection();
  try {
    // 1. Check user exists
    const [users] = await conn.query(
      'SELECT id, email, name, subscription_type, trial_used, trial_ends_at FROM users WHERE email = ?',
      [email]
    );

    if (users.length === 0) {
      console.error('❌ Usuario no encontrado:', email);
      process.exit(1);
    }

    const user = users[0];
    console.log('=== Estado ANTES ===');
    console.log(JSON.stringify(user, null, 2));

    // 2. Calculate trial dates: starts NOW, ends in 7 days
    const now = new Date();
    const trialEndsAt = new Date(now);
    trialEndsAt.setDate(trialEndsAt.getDate() + 7);

    console.log(`\nActivando trial Pro de 7 días:`);
    console.log(`  Inicio: ${now.toISOString()}`);
    console.log(`  Fin:    ${trialEndsAt.toISOString()}`);

    // 3. Update user: set subscription to pro, activate trial
    await conn.beginTransaction();

    const [result] = await conn.query(
      `UPDATE users SET 
        subscription_type = 'pro',
        subscription_expires_at = ?,
        auto_renew = TRUE,
        cancelled_at = NULL,
        trial_used = TRUE,
        trial_started_at = NOW(),
        trial_ends_at = ?,
        trial_plan_type = 'pro'
      WHERE email = ?`,
      [trialEndsAt, trialEndsAt, email]
    );

    console.log(`\nFilas afectadas: ${result.affectedRows}`);

    await conn.commit();

    // 4. Verify
    const [updated] = await conn.query(
      `SELECT id, email, name, subscription_type, subscription_expires_at, 
              auto_renew, trial_used, trial_started_at, trial_ends_at, trial_plan_type 
       FROM users WHERE email = ?`,
      [email]
    );

    console.log('\n=== Estado DESPUÉS ===');
    console.log(JSON.stringify(updated[0], null, 2));
    console.log('\n✅ Trial de 7 días activado correctamente para', email);

  } catch (err) {
    await conn.rollback();
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    conn.release();
    await pool.end();
  }
}

const email = process.argv[2] || 'ricardoromanovarone4@gmail.com';
activateTrial(email);
