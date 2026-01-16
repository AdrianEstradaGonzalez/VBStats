const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function verifySettings() {
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
    console.log('\n📊 Verificando estadísticas por posición y categoría:\n');
    
    const positions = ['Receptor', 'Opuesto', 'Colocador', 'Central', 'Líbero'];
    
    for (const position of positions) {
      console.log(`\n=== ${position} ===`);
      
      const [categories] = await connection.execute(
        `SELECT stat_category, COUNT(*) as count 
         FROM stat_settings 
         WHERE position = ? AND user_id = 1
         GROUP BY stat_category 
         ORDER BY stat_category`,
        [position]
      );
      
      if (categories.length === 0) {
        console.log('  ❌ Sin categorías encontradas');
      } else {
        let total = 0;
        categories.forEach(cat => {
          console.log(`  ${cat.stat_category}: ${cat.count} tipos`);
          total += cat.count;
        });
        console.log(`  📈 Total: ${total} estadísticas, ${categories.length} categorías`);
      }
    }
    
    // Total general
    const [totalRows] = await connection.execute(
      'SELECT COUNT(*) as count FROM stat_settings WHERE user_id = 1'
    );
    console.log(`\n🎯 TOTAL GENERAL para usuario 1: ${totalRows[0].count} estadísticas`);
    
    // Esperado:
    // Receptor/Opuesto/Colocador/Central: 6 categorías × (4+3+3+4+2+2) = 18 tipos cada uno = 72 total
    // Líbero: 3 categorías × (4+2+2) = 8 tipos
    // Total esperado: 72 + 8 = 80
    console.log('\n📋 ESPERADO:');
    console.log('  Receptor: 6 categorías, 18 tipos');
    console.log('  Opuesto: 6 categorías, 18 tipos');
    console.log('  Colocador: 6 categorías, 18 tipos');
    console.log('  Central: 6 categorías, 18 tipos');
    console.log('  Líbero: 3 categorías, 8 tipos');
    console.log('  TOTAL: 80 estadísticas');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    connection.release();
    await pool.end();
  }
}

verifySettings();
