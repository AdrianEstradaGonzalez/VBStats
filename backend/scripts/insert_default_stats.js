const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const path = require('path');

// Load .env from backend directory
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Default stat settings for all positions
const DEFAULT_STATS = [
  // Receptor
  { position: 'Receptor', stat_category: 'Recepción', stat_type: 'Doble positivo', enabled: 1 },
  { position: 'Receptor', stat_category: 'Recepción', stat_type: 'Positivo', enabled: 1 },
  { position: 'Receptor', stat_category: 'Recepción', stat_type: 'Neutra', enabled: 1 },
   { position: 'Receptor', stat_category: 'Recepción', stat_type: 'Error', enabled: 1 },
  { position: 'Receptor', stat_category: 'Ataque', stat_type: 'Positivo', enabled: 1 },
  { position: 'Receptor', stat_category: 'Ataque', stat_type: 'Neutro', enabled: 1 },
  { position: 'Receptor', stat_category: 'Ataque', stat_type: 'Error', enabled: 1 },
  { position: 'Receptor', stat_category: 'Bloqueo', stat_type: 'Positivo', enabled: 1 },
  { position: 'Receptor', stat_category: 'Bloqueo', stat_type: 'Neutro', enabled: 1 },
  { position: 'Receptor', stat_category: 'Bloqueo', stat_type: 'Error', enabled: 1 },
  { position: 'Receptor', stat_category: 'Saque', stat_type: 'Punto directo', enabled: 1 },
  { position: 'Receptor', stat_category: 'Saque', stat_type: 'Positivo', enabled: 1 },
  { position: 'Receptor', stat_category: 'Saque', stat_type: 'Neutro', enabled: 1 },
  { position: 'Receptor', stat_category: 'Saque', stat_type: 'Error', enabled: 1 },
  { position: 'Receptor', stat_category: 'Defensa', stat_type: 'Positivo', enabled: 1 },
  { position: 'Receptor', stat_category: 'Defensa', stat_type: 'Error', enabled: 1 },
  { position: 'Receptor', stat_category: 'Colocación', stat_type: 'Positivo', enabled: 1 },
   { position: 'Receptor', stat_category: 'Colocación', stat_type: 'Error', enabled: 1 },

  // Opuesto
  { position: 'Opuesto', stat_category: 'Recepción', stat_type: 'Doble positivo', enabled: 1 },
   { position: 'Opuesto', stat_category: 'Recepción', stat_type: 'Positivo', enabled: 1 },
  { position: 'Opuesto', stat_category: 'Recepción', stat_type: 'Neutra', enabled: 1 },
  { position: 'Opuesto', stat_category: 'Recepción', stat_type: 'Error', enabled: 1 },
  { position: 'Opuesto', stat_category: 'Ataque', stat_type: 'Positivo', enabled: 1 },
  { position: 'Opuesto', stat_category: 'Ataque', stat_type: 'Neutro', enabled: 1 },
  { position: 'Opuesto', stat_category: 'Ataque', stat_type: 'Error', enabled: 1 },
  { position: 'Opuesto', stat_category: 'Bloqueo', stat_type: 'Positivo', enabled: 1 },
  { position: 'Opuesto', stat_category: 'Bloqueo', stat_type: 'Neutro', enabled: 1 },
  { position: 'Opuesto', stat_category: 'Bloqueo', stat_type: 'Error', enabled: 1 },
  { position: 'Opuesto', stat_category: 'Saque', stat_type: 'Punto directo', enabled: 1 },
  { position: 'Opuesto', stat_category: 'Saque', stat_type: 'Positivo', enabled: 1 },
  { position: 'Opuesto', stat_category: 'Saque', stat_type: 'Neutro', enabled: 1 },
  { position: 'Opuesto', stat_category: 'Saque', stat_type: 'Error', enabled: 1 },
  { position: 'Opuesto', stat_category: 'Defensa', stat_type: 'Positivo', enabled: 1 },
  { position: 'Opuesto', stat_category: 'Defensa', stat_type: 'Error', enabled: 1 },
  { position: 'Opuesto', stat_category: 'Colocación', stat_type: 'Positivo', enabled: 1 },
   { position: 'Opuesto', stat_category: 'Colocación', stat_type: 'Error', enabled: 1 },

  // Colocador
  { position: 'Colocador', stat_category: 'Recepción', stat_type: 'Doble positivo', enabled: 1 },
   { position: 'Colocador', stat_category: 'Recepción', stat_type: 'Positivo', enabled: 1 },
  { position: 'Colocador', stat_category: 'Recepción', stat_type: 'Neutra', enabled: 1 },
  { position: 'Colocador', stat_category: 'Recepción', stat_type: 'Error', enabled: 1 },
  { position: 'Colocador', stat_category: 'Ataque', stat_type: 'Positivo', enabled: 1 },
  { position: 'Colocador', stat_category: 'Ataque', stat_type: 'Neutro', enabled: 1 },
  { position: 'Colocador', stat_category: 'Ataque', stat_type: 'Error', enabled: 1 },
  { position: 'Colocador', stat_category: 'Bloqueo', stat_type: 'Positivo', enabled: 1 },
  { position: 'Colocador', stat_category: 'Bloqueo', stat_type: 'Neutro', enabled: 1 },
  { position: 'Colocador', stat_category: 'Bloqueo', stat_type: 'Error', enabled: 1 },
  { position: 'Colocador', stat_category: 'Saque', stat_type: 'Punto directo', enabled: 1 },
  { position: 'Colocador', stat_category: 'Saque', stat_type: 'Positivo', enabled: 1 },
  { position: 'Colocador', stat_category: 'Saque', stat_type: 'Neutro', enabled: 1 },
  { position: 'Colocador', stat_category: 'Saque', stat_type: 'Error', enabled: 1 },
  { position: 'Colocador', stat_category: 'Defensa', stat_type: 'Positivo', enabled: 1 },
  { position: 'Colocador', stat_category: 'Defensa', stat_type: 'Error', enabled: 1 },
  { position: 'Colocador', stat_category: 'Colocación', stat_type: 'Positivo', enabled: 1 },
   { position: 'Colocador', stat_category: 'Colocación', stat_type: 'Error', enabled: 1 },

  // Central
  { position: 'Central', stat_category: 'Recepción', stat_type: 'Doble positivo', enabled: 1 },
   { position: 'Central', stat_category: 'Recepción', stat_type: 'Positivo', enabled: 1 },
  { position: 'Central', stat_category: 'Recepción', stat_type: 'Neutra', enabled: 1 },
  { position: 'Central', stat_category: 'Recepción', stat_type: 'Error', enabled: 1 },
  { position: 'Central', stat_category: 'Ataque', stat_type: 'Positivo', enabled: 1 },
  { position: 'Central', stat_category: 'Ataque', stat_type: 'Neutro', enabled: 1 },
  { position: 'Central', stat_category: 'Ataque', stat_type: 'Error', enabled: 1 },
  { position: 'Central', stat_category: 'Bloqueo', stat_type: 'Positivo', enabled: 1 },
  { position: 'Central', stat_category: 'Bloqueo', stat_type: 'Neutro', enabled: 1 },
  { position: 'Central', stat_category: 'Bloqueo', stat_type: 'Error', enabled: 1 },
  { position: 'Central', stat_category: 'Saque', stat_type: 'Punto directo', enabled: 1 },
  { position: 'Central', stat_category: 'Saque', stat_type: 'Positivo', enabled: 1 },
  { position: 'Central', stat_category: 'Saque', stat_type: 'Neutro', enabled: 1 },
  { position: 'Central', stat_category: 'Saque', stat_type: 'Error', enabled: 1 },
  { position: 'Central', stat_category: 'Defensa', stat_type: 'Positivo', enabled: 1 },
  { position: 'Central', stat_category: 'Defensa', stat_type: 'Error', enabled: 1 },
  { position: 'Central', stat_category: 'Colocación', stat_type: 'Positivo', enabled: 1 },
   { position: 'Central', stat_category: 'Colocación', stat_type: 'Error', enabled: 1 },

  // Líbero
  { position: 'Líbero', stat_category: 'Recepción', stat_type: 'Doble positivo', enabled: 1 },
   { position: 'Líbero', stat_category: 'Recepción', stat_type: 'Positivo', enabled: 1 },
  { position: 'Líbero', stat_category: 'Recepción', stat_type: 'Neutra', enabled: 1 },
  { position: 'Líbero', stat_category: 'Recepción', stat_type: 'Error', enabled: 1 },
  { position: 'Líbero', stat_category: 'Defensa', stat_type: 'Positivo', enabled: 1 },
  { position: 'Líbero', stat_category: 'Defensa', stat_type: 'Error', enabled: 1 },
  { position: 'Líbero', stat_category: 'Colocación', stat_type: 'Positivo', enabled: 1 },
   { position: 'Líbero', stat_category: 'Colocación', stat_type: 'Error', enabled: 1 },
];

async function insertDefaultStats() {
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
    
    // Insert all default stats
    let insertedCount = 0;
    for (const stat of DEFAULT_STATS) {
      await connection.execute(
        'INSERT INTO stat_settings (position, stat_category, stat_type, enabled, user_id) VALUES (?, ?, ?, ?, NULL)',
        [stat.position, stat.stat_category, stat.stat_type, stat.enabled]
      );
      insertedCount++;
    }
    
    console.log(`✅ ${insertedCount} estadísticas insertadas exitosamente`);
    
    // Verify
    const [rows] = await connection.execute('SELECT COUNT(*) as count FROM stat_settings');
    console.log(`📊 Total de registros en la tabla: ${rows[0].count}`);
    
    // Show sample
    const [sample] = await connection.execute(
      'SELECT position, stat_category, stat_type, enabled FROM stat_settings LIMIT 10'
    );
    console.log('\n📋 Primeros 10 registros:');
    sample.forEach(row => {
      console.log(`  ${row.position} - ${row.stat_category} - ${row.stat_type}: ${row.enabled ? '✓' : '✗'}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    connection.release();
    await pool.end();
  }
}

insertDefaultStats();
