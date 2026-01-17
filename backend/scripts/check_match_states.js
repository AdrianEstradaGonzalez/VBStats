/**
 * Script para verificar y mostrar el estado de los partidos guardados
 * Ejecutar con: node scripts/check_match_states.js
 */

const { pool } = require('../db');

async function checkMatchStates() {
  try {
    console.log('🔍 Verificando tabla match_states...\n');
    
    // Verificar que la tabla existe
    const [tables] = await pool.query(`SHOW TABLES LIKE 'match_states'`);
    
    if (tables.length === 0) {
      console.log('❌ La tabla match_states NO existe');
      console.log('Ejecuta: node scripts/create_match_states_table.js');
      return;
    }
    
    console.log('✅ Tabla match_states existe\n');
    
    // Mostrar todos los estados guardados
    const [states] = await pool.query(`
      SELECT 
        ms.id,
        ms.match_id,
        m.team_id,
        t.name as team_name,
        m.opponent,
        m.status,
        ms.state_json,
        ms.created_at,
        ms.updated_at
      FROM match_states ms
      JOIN matches m ON ms.match_id = m.id
      LEFT JOIN teams t ON m.team_id = t.id
      ORDER BY ms.updated_at DESC
    `);
    
    if (states.length === 0) {
      console.log('📭 No hay estados de partidos guardados\n');
    } else {
      console.log(`📋 ${states.length} estado(s) de partido guardado(s):\n`);
      
      states.forEach((state, idx) => {
        console.log(`--- Partido #${state.match_id} ---`);
        console.log(`  Equipo: ${state.team_name || 'N/A'}`);
        console.log(`  Rival: ${state.opponent || 'N/A'}`);
        console.log(`  Estado partido: ${state.status}`);
        
        let parsed;
        try {
          // state_json puede ser ya un objeto si MySQL lo parsea automáticamente
          parsed = typeof state.state_json === 'string' 
            ? JSON.parse(state.state_json) 
            : state.state_json;
        } catch (e) {
          console.log(`  ⚠️ Error parseando JSON: ${e.message}`);
          console.log(`  Raw state_json type: ${typeof state.state_json}`);
          console.log(`  Raw state_json: ${JSON.stringify(state.state_json).substring(0, 200)}...`);
          return;
        }
        
        console.log(`  Set actual: ${parsed.current_set}`);
        console.log(`  Set activo: ${parsed.is_set_active}`);
        console.log(`  Posiciones con jugador: ${parsed.positions?.filter(p => p.playerId).length || 0}`);
        console.log(`  Stats pendientes: ${parsed.pending_stats?.length || 0}`);
        console.log(`  Historial acciones: ${parsed.action_history?.length || 0}`);
        console.log(`  Actualizado: ${state.updated_at}`);
        console.log('');
      });
    }
    
    // Mostrar partidos en curso sin estado guardado
    const [inProgressWithoutState] = await pool.query(`
      SELECT m.id, m.team_id, t.name as team_name, m.opponent, m.created_at
      FROM matches m
      LEFT JOIN teams t ON m.team_id = t.id
      LEFT JOIN match_states ms ON m.id = ms.match_id
      WHERE m.status = 'in_progress' AND ms.id IS NULL
    `);
    
    if (inProgressWithoutState.length > 0) {
      console.log(`⚠️ ${inProgressWithoutState.length} partido(s) en curso SIN estado guardado:`);
      inProgressWithoutState.forEach(m => {
        console.log(`  - Partido #${m.id}: ${m.team_name} vs ${m.opponent || 'N/A'}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkMatchStates();
