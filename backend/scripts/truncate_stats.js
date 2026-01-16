const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const path = require('path');

// Load .env from backend directory
dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function truncateStatSettings() {
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
    console.log('Conectando a la base de datos...');
    
    // Truncate the table
    await connection.execute('TRUNCATE TABLE stat_settings');
    console.log('✅ Tabla stat_settings vaciada exitosamente');
    
    // Verify
    const [rows] = await connection.execute('SELECT COUNT(*) as count FROM stat_settings');
    console.log(`📊 Registros en la tabla: ${rows[0].count}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    connection.release();
  }
}

truncateStatSettings();
