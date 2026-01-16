const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function resetUserSettings() {
  const connectionUrl = process.env.MYSQL_PUBLIC_URL || process.env.MYSQL_URL;
  
  console.log('Conectando a:', connectionUrl ? 'Railway DB' : 'Local DB');
  
  const pool = connectionUrl 
    ? mysql.createPool(connectionUrl)
    : mysql.createPool({
        host: process.env.MYSQL_HOST || '127.0.0.1',
        port: process.env.MYSQL_PORT ? Number(process.env.MYSQL_PORT) : 3306,
        user: process.env.MYSQL_USER || 'root',
        password: process.env.MYSQL_PASSWORD || '',
        database: process.env.MYSQL_DATABASE || 'vbstats',
      });
  
  const connection = await pool.getConnection();

  try {
    console.log('Borrando configuraciones de usuarios (no globales)...');
    
    // Delete only user-specific settings (where user_id IS NOT NULL)
    const [result] = await connection.execute(
      'DELETE FROM stat_settings WHERE user_id IS NOT NULL'
    );
    
    console.log(`✅ ${result.affectedRows} configuraciones de usuario eliminadas`);
    
    // Verify
    const [userRows] = await connection.execute(
      'SELECT COUNT(*) as count FROM stat_settings WHERE user_id IS NOT NULL'
    );
    const [globalRows] = await connection.execute(
      'SELECT COUNT(*) as count FROM stat_settings WHERE user_id IS NULL'
    );
    
    console.log(`\n📊 Configuraciones de usuario restantes: ${userRows[0].count}`);
    console.log(`📊 Configuraciones globales: ${globalRows[0].count}`);
    console.log('\n✨ Ahora cuando el usuario inicie sesión se crearán las configuraciones completas');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    connection.release();
    await pool.end();
  }
}

resetUserSettings();
