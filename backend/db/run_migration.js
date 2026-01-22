/**
 * Script para ejecutar la migración de suscripciones
 * Ejecutar con: node run_migration.js
 */

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Cargar variables de entorno
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Configuración de la base de datos (usar la misma que db.js)
const connectionUrl = process.env.MYSQL_PUBLIC_URL || process.env.MYSQL_URL;

const dbConfig = connectionUrl ? connectionUrl : {
  host: process.env.MYSQL_HOST || '127.0.0.1',
  port: process.env.MYSQL_PORT ? Number(process.env.MYSQL_PORT) : 3306,
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'vbstats',
  multipleStatements: true
};

async function runMigration() {
  let connection;
  
  try {
    console.log('🔌 Conectando a la base de datos...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Conectado exitosamente\n');

    // Leer el archivo SQL
    const sqlFile = path.join(__dirname, 'add_subscription_support.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');

    // Dividir el SQL en queries individuales
    // Filtrar comentarios y queries vacías
    const queries = sql
      .split('\n')
      .filter(line => !line.trim().startsWith('--') && line.trim() !== '')
      .join('\n')
      .split(';')
      .map(q => q.trim())
      .filter(q => q.length > 0 && !q.toLowerCase().startsWith('describe'));

    console.log(`📝 Ejecutando ${queries.length} queries de migración...\n`);

    for (let i = 0; i < queries.length; i++) {
      const query = queries[i];
      try {
        console.log(`⚙️  Query ${i + 1}/${queries.length}:`, query.substring(0, 60) + '...');
        await connection.execute(query);
        console.log(`✅ Completada\n`);
      } catch (error) {
        // Si el error es que la columna ya existe, lo ignoramos
        if (error.code === 'ER_DUP_FIELDNAME' || error.code === 'ER_DUP_KEYNAME') {
          console.log(`⚠️  Ya existe (saltando)\n`);
        } else {
          throw error;
        }
      }
    }

    // Verificar las tablas
    console.log('🔍 Verificando estructura de tablas...\n');
    
    const [usersColumns] = await connection.execute('DESCRIBE users');
    console.log('📊 Columnas de users:');
    usersColumns.forEach(col => {
      if (col.Field.includes('subscription') || col.Field.includes('stripe')) {
        console.log(`   ✓ ${col.Field} (${col.Type})`);
      }
    });

    const [matchesColumns] = await connection.execute('DESCRIBE matches');
    console.log('\n📊 Columnas de matches:');
    matchesColumns.forEach(col => {
      if (col.Field === 'share_code') {
        console.log(`   ✓ ${col.Field} (${col.Type})`);
      }
    });

    console.log('\n✨ ¡Migración completada exitosamente!');

  } catch (error) {
    console.error('\n❌ Error ejecutando migración:', error.message);
    console.error('Detalles:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 Conexión cerrada');
    }
  }
}

// Ejecutar migración
runMigration();
