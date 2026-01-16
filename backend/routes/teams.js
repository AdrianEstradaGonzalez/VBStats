const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// GET /teams - Obtener todos los equipos de un usuario
router.get('/', async (req, res) => {
  const { user_id } = req.query;
  
  if (!user_id) {
    return res.status(400).json({ error: 'user_id query parameter required' });
  }
  
  const [rows] = await pool.query(
    'SELECT * FROM teams WHERE user_id = ? ORDER BY id DESC',
    [user_id]
  );
  res.json(rows);
});

// POST /teams - Crear un nuevo equipo
router.post('/', async (req, res) => {
  const { name, user_id } = req.body;
  
  if (!name) return res.status(400).json({ error: 'name required' });
  if (!user_id) return res.status(400).json({ error: 'user_id required' });
  
  const [result] = await pool.query(
    'INSERT INTO teams (name, user_id) VALUES (?, ?)',
    [name, user_id]
  );
  
  const [rows] = await pool.query('SELECT * FROM teams WHERE id = ?', [result.insertId]);
  res.status(201).json(rows[0]);
});

// GET /teams/:id - Obtener un equipo específico
router.get('/:id', async (req, res) => {
  const { user_id } = req.query;
  
  if (!user_id) {
    return res.status(400).json({ error: 'user_id query parameter required' });
  }
  
  const [rows] = await pool.query(
    'SELECT * FROM teams WHERE id = ? AND user_id = ?',
    [req.params.id, user_id]
  );
  
  if (!rows.length) return res.status(404).json({ error: 'not found' });
  res.json(rows[0]);
});

// PUT /teams/:id - Actualizar un equipo
router.put('/:id', async (req, res) => {
  const { name, user_id } = req.body;
  
  if (!user_id) return res.status(400).json({ error: 'user_id required' });
  
  // Verificar que el equipo pertenece al usuario
  const [existing] = await pool.query(
    'SELECT * FROM teams WHERE id = ? AND user_id = ?',
    [req.params.id, user_id]
  );
  
  if (!existing.length) {
    return res.status(404).json({ error: 'Team not found or unauthorized' });
  }
  
  await pool.query(
    'UPDATE teams SET name = ? WHERE id = ? AND user_id = ?',
    [name, req.params.id, user_id]
  );
  
  const [rows] = await pool.query('SELECT * FROM teams WHERE id = ?', [req.params.id]);
  res.json(rows[0]);
});

// DELETE /teams/:id - Eliminar un equipo
router.delete('/:id', async (req, res) => {
  const { user_id } = req.query;
  
  if (!user_id) {
    return res.status(400).json({ error: 'user_id query parameter required' });
  }
  
  // Verificar que el equipo pertenece al usuario
  const [existing] = await pool.query(
    'SELECT * FROM teams WHERE id = ? AND user_id = ?',
    [req.params.id, user_id]
  );
  
  if (!existing.length) {
    return res.status(404).json({ error: 'Team not found or unauthorized' });
  }
  
  await pool.query('DELETE FROM teams WHERE id = ? AND user_id = ?', [req.params.id, user_id]);
  res.status(204).end();
});

module.exports = router;
