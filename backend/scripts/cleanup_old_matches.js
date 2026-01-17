/**
 * Script para limpiar partidos en curso antiguos (solo para desarrollo)
 * Ejecutar con: node scripts/cleanup_old_matches.js
 */

const { pool } = require('../db');

async function cleanupOldMatches() {
  try {
    console.log('🧹 Limpiando partidos en curso antiguos...\n');
    
    // Obtener partidos en curso con más de 1 día de antigüedad
    const [oldMatches] = await pool.query(`
      SELECT id, team_id, opponent, created_at
      FROM matches 
      WHERE status = 'in_progress' 
      AND created_at < DATE_SUB(NOW(), INTERVAL 1 DAY)
    `);
    
    if (oldMatches.length === 0) {
      console.log('✅ No hay partidos antiguos para limpiar\n');
    } else {
      console.log(`🗑️ Se encontraron ${oldMatches.length} partidos antiguos:`);
      oldMatches.forEach(m => console.log(`  - Partido #${m.id}: ${m.opponent} (${m.created_at})`));
      
      // Actualizar a cancelled
      const [result] = await pool.query(`
        UPDATE matches 
        SET status = 'cancelled' 
        WHERE status = 'in_progress' 
        AND created_at < DATE_SUB(NOW(), INTERVAL 1 DAY)
      `);
      
      console.log(`\n✅ ${result.affectedRows} partidos marcados como cancelados`);
      
      // Eliminar estados huérfanos
      const [stateResult] = await pool.query(`
        DELETE ms FROM match_states ms
        JOIN matches m ON ms.match_id = m.id
        WHERE m.status = 'cancelled'
      `);
      
      console.log(`✅ ${stateResult.affectedRows} estados de partido eliminados`);
    }
    
    // Mostrar resumen final
    const [counts] = await pool.query(`
      SELECT status, COUNT(*) as count 
      FROM matches 
      GROUP BY status
    `);
    
    console.log('\n📊 Resumen de partidos:');
    counts.forEach(c => console.log(`  ${c.status}: ${c.count}`));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

cleanupOldMatches();
