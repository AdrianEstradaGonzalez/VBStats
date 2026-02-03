/**
 * Script para ejecutar la migración de Apple IAP
 * Ejecutar con: node run_apple_iap_migration.js
 */

const mysql = require('mysql2/promise');
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

async function checkColumnExists(connection, tableName, columnName) {
  const [rows] = await connection.execute(
    `SELECT COUNT(*) as count FROM information_schema.columns 
     WHERE table_schema = DATABASE() 
     AND table_name = ? 
     AND column_name = ?`,
    [tableName, columnName]
  );
  return rows[0].count > 0;
}

async function runMigration() {
  let connection;
  
  try {
    console.log('🔌 Conectando a la base de datos...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Conectado exitosamente\n');

    // Verificar si las columnas ya existen
    console.log('🔍 Verificando si la migración ya está aplicada...\n');
    
    const hasAppleOriginalTransactionId = await checkColumnExists(connection, 'users', 'apple_original_transaction_id');
    const hasAppleTransactionId = await checkColumnExists(connection, 'users', 'apple_transaction_id');
    const hasAppleProductId = await checkColumnExists(connection, 'users', 'apple_product_id');

    if (hasAppleOriginalTransactionId && hasAppleTransactionId && hasAppleProductId) {
      console.log('✅ La migración de Apple IAP ya está aplicada.');
      console.log('   - apple_original_transaction_id: ✓');
      console.log('   - apple_transaction_id: ✓');
      console.log('   - apple_product_id: ✓');
      console.log('\n🎉 No se requieren cambios adicionales.');
      return;
    }

    console.log('📝 Aplicando migración de Apple IAP...\n');

    // Agregar columnas que faltan
    if (!hasAppleOriginalTransactionId) {
      console.log('   Agregando columna apple_original_transaction_id...');
      await connection.execute(
        `ALTER TABLE users ADD COLUMN apple_original_transaction_id VARCHAR(255) NULL AFTER stripe_subscription_id`
      );
      console.log('   ✅ apple_original_transaction_id agregada');
    }

    if (!hasAppleTransactionId) {
      console.log('   Agregando columna apple_transaction_id...');
      await connection.execute(
        `ALTER TABLE users ADD COLUMN apple_transaction_id VARCHAR(255) NULL AFTER apple_original_transaction_id`
      );
      console.log('   ✅ apple_transaction_id agregada');
    }

    if (!hasAppleProductId) {
      console.log('   Agregando columna apple_product_id...');
      await connection.execute(
        `ALTER TABLE users ADD COLUMN apple_product_id VARCHAR(255) NULL AFTER apple_transaction_id`
      );
      console.log('   ✅ apple_product_id agregada');
    }

    // Verificar si el índice ya existe
    const [indexes] = await connection.execute(
      `SELECT COUNT(*) as count FROM information_schema.statistics 
       WHERE table_schema = DATABASE() 
       AND table_name = 'users' 
       AND index_name = 'idx_users_apple_transaction'`
    );

    if (indexes[0].count === 0) {
      console.log('   Creando índice idx_users_apple_transaction...');
      await connection.execute(
        `CREATE INDEX idx_users_apple_transaction ON users(apple_original_transaction_id)`
      );
      console.log('   ✅ Índice creado');
    } else {
      console.log('   ✅ Índice idx_users_apple_transaction ya existe');
    }

    console.log('\n🎉 ¡Migración de Apple IAP completada exitosamente!');

    // Mostrar estructura actual de la tabla
    console.log('\n📋 Estructura actual de la tabla users (campos de suscripción):');
    const [columns] = await connection.execute(
      `SELECT column_name, column_type, is_nullable 
       FROM information_schema.columns 
       WHERE table_schema = DATABASE() 
       AND table_name = 'users' 
       AND (column_name LIKE '%stripe%' OR column_name LIKE '%apple%' OR column_name LIKE '%subscription%' OR column_name LIKE '%plan%')
       ORDER BY ordinal_position`
    );
    
    columns.forEach(col => {
      console.log(`   - ${col.column_name}: ${col.column_type} (${col.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
    });

  } catch (error) {
    console.error('❌ Error durante la migración:', error.message);
    if (error.code === 'ER_DUP_FIELDNAME') {
      console.log('\n⚠️  La columna ya existe. La migración puede estar parcialmente aplicada.');
    }
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 Conexión cerrada');
    }
  }
}

// Ejecutar la migración
runMigration();
