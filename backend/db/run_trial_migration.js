/**
 * Script para ejecutar la migración de soporte de trial en Railway
 */

const mysql = require('mysql2/promise');

// Conexión a Railway (usando URL pública)
const config = {
  host: 'switchback.proxy.rlwy.net',
  port: 27892,
  user: 'root',
  password: 'squPJEdZWJeQFblzVtyTPrZQBhgtPbht',
  database: 'railway',
  multipleStatements: true
};

const migrationSQL = `
-- Add trial tracking fields to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS trial_used BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS trial_started_at DATETIME NULL,
ADD COLUMN IF NOT EXISTS trial_ends_at DATETIME NULL,
ADD COLUMN IF NOT EXISTS trial_plan_type ENUM('basic', 'pro') NULL;

-- Create table to track device IDs that have used trials
CREATE TABLE IF NOT EXISTS device_trials (
  id INT AUTO_INCREMENT PRIMARY KEY,
  device_id VARCHAR(255) NOT NULL UNIQUE,
  user_id INT NOT NULL,
  plan_type ENUM('basic', 'pro') NOT NULL,
  trial_started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  trial_ended_at DATETIME NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_device_id (device_id)
);
`;

async function runMigration() {
  let connection;
  
  try {
    console.log('🔌 Conectando a Railway MySQL...');
    connection = await mysql.createConnection(config);
    console.log('✅ Conexión establecida');
    
    // Primero verificar si las columnas ya existen
    console.log('\n📋 Verificando estructura actual de la tabla users...');
    const [columns] = await connection.query('SHOW COLUMNS FROM users');
    const columnNames = columns.map(c => c.Field);
    console.log('Columnas actuales:', columnNames.join(', '));
    
    // Añadir columnas una por una si no existen
    const columnsToAdd = [
      { name: 'trial_used', sql: 'ADD COLUMN trial_used BOOLEAN DEFAULT FALSE' },
      { name: 'trial_started_at', sql: 'ADD COLUMN trial_started_at DATETIME NULL' },
      { name: 'trial_ends_at', sql: 'ADD COLUMN trial_ends_at DATETIME NULL' },
      { name: 'trial_plan_type', sql: "ADD COLUMN trial_plan_type ENUM('basic', 'pro') NULL" }
    ];
    
    for (const col of columnsToAdd) {
      if (!columnNames.includes(col.name)) {
        console.log(`\n➕ Añadiendo columna ${col.name}...`);
        await connection.query(`ALTER TABLE users ${col.sql}`);
        console.log(`✅ Columna ${col.name} añadida`);
      } else {
        console.log(`⏭️  Columna ${col.name} ya existe, saltando...`);
      }
    }
    
    // Crear tabla device_trials
    console.log('\n📋 Creando tabla device_trials...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS device_trials (
        id INT AUTO_INCREMENT PRIMARY KEY,
        device_id VARCHAR(255) NOT NULL UNIQUE,
        user_id INT NOT NULL,
        plan_type ENUM('basic', 'pro') NOT NULL,
        trial_started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        trial_ended_at DATETIME NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_device_id (device_id)
      )
    `);
    console.log('✅ Tabla device_trials creada/verificada');
    
    // Verificar resultado
    console.log('\n📋 Verificando estructura final...');
    const [finalColumns] = await connection.query('SHOW COLUMNS FROM users');
    console.log('Columnas de users:', finalColumns.map(c => c.Field).join(', '));
    
    const [tables] = await connection.query("SHOW TABLES LIKE 'device_trials'");
    console.log('Tabla device_trials existe:', tables.length > 0 ? 'Sí ✅' : 'No ❌');
    
    console.log('\n🎉 ¡Migración completada exitosamente!');
    
  } catch (error) {
    console.error('\n❌ Error durante la migración:', error.message);
    if (error.code === 'ER_DUP_FIELDNAME') {
      console.log('ℹ️  Algunas columnas ya existían, esto es normal.');
    }
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 Conexión cerrada');
    }
  }
}

runMigration();
