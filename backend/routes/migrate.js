const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// POST /api/migrate/add-user-id-to-teams
// Este endpoint agrega la columna user_id a la tabla teams
// Solo se debe ejecutar una vez
router.post('/add-user-id-to-teams', async (req, res) => {
  const secretKey = req.body.secret || req.query.secret;
  
  // Proteger el endpoint con una clave secreta simple
  if (secretKey !== 'vbstats2026migrate') {
    return res.status(401).json({ error: 'Unauthorized - Invalid secret key' });
  }

  try {
    // Verificar si la columna ya existe
    const [columns] = await pool.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'teams' AND COLUMN_NAME = 'user_id'
    `);

    if (columns.length > 0) {
      return res.json({ 
        success: true, 
        message: 'Column user_id already exists in teams table',
        alreadyMigrated: true 
      });
    }

    // Agregar la columna user_id
    await pool.query(`
      ALTER TABLE teams 
      ADD COLUMN user_id INT NOT NULL DEFAULT 1
    `);
    console.log('Added user_id column to teams table');

    // Intentar crear el índice (puede fallar si ya existe)
    try {
      await pool.query(`
        CREATE INDEX idx_teams_user_id ON teams(user_id)
      `);
      console.log('Created index idx_teams_user_id');
    } catch (indexError) {
      console.log('Index may already exist:', indexError.message);
    }

    res.json({ 
      success: true, 
      message: 'Migration completed successfully! Column user_id added to teams table.',
      alreadyMigrated: false
    });

  } catch (error) {
    console.error('Migration error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      sqlMessage: error.sqlMessage || null
    });
  }
});

// GET /api/migrate/status
// Verificar el estado de la migración
router.get('/status', async (req, res) => {
  try {
    const [columns] = await pool.query(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'teams'
    `);

    const hasUserId = columns.some(col => col.COLUMN_NAME === 'user_id');

    res.json({
      teamsTableColumns: columns.map(c => c.COLUMN_NAME),
      hasUserIdColumn: hasUserId,
      migrationNeeded: !hasUserId
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
