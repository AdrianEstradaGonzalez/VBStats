const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function extendTrial(email, extraDays) {
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
    const [users] = await conn.query(
      `SELECT id, email, name, subscription_type, subscription_expires_at, 
              auto_renew, cancelled_at, trial_used, trial_started_at, trial_ends_at, trial_plan_type,
              stripe_customer_id, stripe_subscription_id,
              apple_original_transaction_id, apple_transaction_id, apple_product_id
       FROM users WHERE email = ?`,
      [email]
    );

    if (users.length === 0) {
      console.error('❌ Usuario no encontrado:', email);
      process.exit(1);
    }

    const user = users[0];
    console.log('=== Estado ANTES ===');
    console.log(JSON.stringify(user, null, 2));

    // Calculate new trial end: 7 days from NOW
    const now = new Date();
    const trialEndsAt = new Date(now);
    trialEndsAt.setDate(trialEndsAt.getDate() + extraDays);

    console.log(`\nExtendiendo trial ${extraDays} días desde ahora:`);
    console.log(`  Ahora:     ${now.toISOString()}`);
    console.log(`  Nuevo fin: ${trialEndsAt.toISOString()}`);
    console.log(`  Estado:    CANCELADO (no se cobrará al finalizar)`);

    await conn.beginTransaction();

    // Update: extend trial, set subscription_expires_at, mark as cancelled (no auto-renew)
    const [result] = await conn.query(
      `UPDATE users SET 
        subscription_type = 'pro',
        subscription_expires_at = ?,
        auto_renew = FALSE,
        cancelled_at = NOW(),
        trial_used = TRUE,
        trial_started_at = NOW(),
        trial_ends_at = ?,
        trial_plan_type = 'pro'
      WHERE email = ?`,
      [trialEndsAt, trialEndsAt, email]
    );

    console.log(`\nFilas afectadas: ${result.affectedRows}`);
    await conn.commit();

    // Verify
    const [updated] = await conn.query(
      `SELECT id, email, name, subscription_type, subscription_expires_at, 
              auto_renew, cancelled_at, trial_used, trial_started_at, trial_ends_at, trial_plan_type,
              stripe_customer_id, stripe_subscription_id,
              apple_original_transaction_id, apple_transaction_id, apple_product_id
       FROM users WHERE email = ?`,
      [email]
    );

    console.log('\n=== Estado DESPUÉS ===');
    console.log(JSON.stringify(updated[0], null, 2));

    // Summary
    const u = updated[0];
    console.log('\n=== RESUMEN ===');
    console.log(`  Plan actual:      ${u.subscription_type}`);
    console.log(`  Trial hasta:      ${u.trial_ends_at}`);
    console.log(`  Auto-renovación:  ${u.auto_renew ? 'SÍ' : 'NO (cancelada)'}`);
    console.log(`  Cancelado:        ${u.cancelled_at ? 'SÍ, ' + u.cancelled_at : 'NO'}`);
    console.log(`  Stripe ID:        ${u.stripe_subscription_id || 'NINGUNO'}`);
    console.log(`  Apple Txn ID:     ${u.apple_original_transaction_id || 'NINGUNO'}`);
    console.log(`  → No se le cobrará al finalizar el trial`);
    console.log(`  → Al expirar pasará a plan GRATIS`);
    
    console.log('\n✅ Trial extendido correctamente');

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
const days = parseInt(process.argv[3]) || 7;
extendTrial(email, days);
