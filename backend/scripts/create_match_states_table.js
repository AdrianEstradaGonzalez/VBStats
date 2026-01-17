/**
 * Script para crear la tabla match_states
 * Ejecutar con: node scripts/create_match_states_table.js
 */

const { pool } = require('../db');

async function createMatchStatesTable() {
  try {
    console.log('🔨 Creando tabla match_states...');
    
    // Crear la tabla
    await pool.query(`
      CREATE TABLE IF NOT EXISTS match_states (
        id INT AUTO_INCREMENT PRIMARY KEY,
        match_id INT NOT NULL UNIQUE,
        state_json JSON NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE
      )
    `);
    
    console.log('✅ Tabla match_states creada');
    
    // Crear índice (con manejo de error si ya existe)
    try {
      await pool.query(`
        CREATE INDEX idx_match_states_match_id ON match_states(match_id)
      `);
      console.log('✅ Índice idx_match_states_match_id creado');
    } catch (indexError) {
      if (indexError.code === 'ER_DUP_KEYNAME') {
        console.log('ℹ️  Índice idx_match_states_match_id ya existe');
      } else {
        throw indexError;
      }
    }
    
    // Verificar que la tabla existe
    const [tables] = await pool.query(`
      SHOW TABLES LIKE 'match_states'
    `);
    
    if (tables.length > 0) {
      console.log('✅ Verificación exitosa: tabla match_states existe');
      
      // Mostrar estructura de la tabla
      const [columns] = await pool.query(`
        DESCRIBE match_states
      `);
      
      console.log('\n📋 Estructura de la tabla:');
      console.table(columns);
    } else {
      console.log('❌ Error: la tabla no se creó correctamente');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

createMatchStatesTable();
