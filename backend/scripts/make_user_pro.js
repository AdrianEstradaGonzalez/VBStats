const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const path = require('path');

// Load .env from backend directory
dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function makeUserPro(targetEmail, sourceEmail) {
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
    console.log(`Buscando usuario destino: ${targetEmail}`);
    const [targetRows] = await conn.query('SELECT id, email, subscription_type, subscription_expires_at FROM users WHERE email = ?', [targetEmail]);
    if (targetRows.length === 0) {
      console.error('Usuario destino no encontrado:', targetEmail);
      process.exit(1);
    }

    let expiresAt = '2099-12-31 23:59:59';

    if (sourceEmail) {
      console.log(`Copiando datos de suscripción desde: ${sourceEmail}`);
      const [sourceRows] = await conn.query('SELECT subscription_type, subscription_expires_at FROM users WHERE email = ?', [sourceEmail]);
      if (sourceRows.length > 0) {
        const src = sourceRows[0];
        if (src.subscription_expires_at) {
          expiresAt = src.subscription_expires_at; // copy if exists
        }
      } else {
        console.warn('Usuario fuente no encontrado, usando expiración lejana por defecto');
      }
    }

    // Update target: make PRO, set a distant expiration, remove Stripe ids to avoid billing
    const [result] = await conn.query(
      `UPDATE users SET subscription_type = ?, subscription_expires_at = ?, stripe_subscription_id = NULL, stripe_customer_id = NULL WHERE email = ?`,
      ['pro', expiresAt, targetEmail]
    );

    console.log(`Filas afectadas: ${result.affectedRows}`);

    const [updated] = await conn.query('SELECT id, email, subscription_type, subscription_expires_at, stripe_customer_id, stripe_subscription_id FROM users WHERE email = ?', [targetEmail]);
    console.log('Usuario actualizado:', updated[0]);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    conn.release();
    await pool.end();
  }
}

// CLI: node make_user_pro.js targetEmail [sourceEmail]
const args = process.argv.slice(2);
if (args.length === 0) {
  console.log('Uso: node make_user_pro.js targetEmail [sourceEmail]');
  process.exit(1);
}

const [targetEmail, sourceEmail] = args;
makeUserPro(targetEmail, sourceEmail);
