const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const path = require('path');

// Load .env from backend directory
dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function makeAllUsersPro() {
  const PRO_EXPIRATION = '2026-09-30 23:59:59';

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
    // Count users before update
    const [countBefore] = await conn.query('SELECT COUNT(*) as total FROM users');
    console.log(`Total usuarios en la base de datos: ${countBefore[0].total}`);

    // Show current status breakdown
    const [statusBefore] = await conn.query(
      'SELECT subscription_type, COUNT(*) as count FROM users GROUP BY subscription_type'
    );
    console.log('\n=== Estado ANTES de la actualización ===');
    statusBefore.forEach(row => {
      console.log(`  ${row.subscription_type || 'NULL'}: ${row.count} usuarios`);
    });

    // Update ALL users to PRO until September 2026
    const [result] = await conn.query(
      `UPDATE users 
       SET subscription_type = 'pro', 
           subscription_expires_at = ?,
           stripe_subscription_id = NULL
       WHERE 1=1`,
      [PRO_EXPIRATION]
    );

    console.log(`\n✅ ${result.affectedRows} usuarios actualizados a PRO hasta ${PRO_EXPIRATION}`);

    // Show status after update
    const [statusAfter] = await conn.query(
      'SELECT subscription_type, COUNT(*) as count FROM users GROUP BY subscription_type'
    );
    console.log('\n=== Estado DESPUÉS de la actualización ===');
    statusAfter.forEach(row => {
      console.log(`  ${row.subscription_type || 'NULL'}: ${row.count} usuarios`);
    });

    // Show a few sample users
    const [sampleUsers] = await conn.query(
      'SELECT id, email, subscription_type, subscription_expires_at FROM users LIMIT 5'
    );
    console.log('\n=== Muestra de usuarios actualizados ===');
    sampleUsers.forEach(u => {
      console.log(`  ID ${u.id}: ${u.email} → ${u.subscription_type} (expira: ${u.subscription_expires_at})`);
    });

  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    conn.release();
    await pool.end();
  }
}

makeAllUsersPro();
