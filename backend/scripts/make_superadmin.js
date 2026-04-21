/**
 * Script para asignar o revocar el rol de superadmin a un usuario.
 *
 * Uso:
 *   node scripts/make_superadmin.js <email_o_nombre> [--revoke]
 *
 * Ejemplos:
 *   node scripts/make_superadmin.js test@vbstats.com
 *   node scripts/make_superadmin.js diegocharro27
 *   node scripts/make_superadmin.js test@vbstats.com --revoke
 */

const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const identifier = process.argv[2];
const revoke = process.argv.includes('--revoke');

if (!identifier) {
  console.error('Uso: node scripts/make_superadmin.js <email_o_nombre> [--revoke]');
  process.exit(1);
}

async function main() {
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
    const [rows] = await conn.query(
      'SELECT id, email, name, is_superadmin FROM users WHERE email = ? OR name = ?',
      [identifier, identifier]
    );

    if (rows.length === 0) {
      console.error(`Usuario no encontrado con email o nombre: "${identifier}"`);
      process.exit(1);
    }

    const user = rows[0];
    const newValue = revoke ? 0 : 1;
    await conn.query('UPDATE users SET is_superadmin = ? WHERE id = ?', [newValue, user.id]);

    const action = revoke ? 'revocado' : 'asignado';
    console.log(`✅ Superadmin ${action} para: ${user.name || ''} <${user.email}> (ID: ${user.id})`);
  } finally {
    conn.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
