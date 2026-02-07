const express = require('express');
const router = express.Router();
const { pool } = require('../db');

router.get('/', async (req, res) => {
  const { team_id } = req.query;
  if (team_id) {
    const [rows] = await pool.query('SELECT * FROM players WHERE team_id = ? ORDER BY id DESC', [team_id]);
    return res.json(rows);
  }
  const [rows] = await pool.query('SELECT * FROM players ORDER BY id DESC');
  res.json(rows);
});

router.post('/', async (req, res) => {
  const { name, team_id, position, number } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  const [result] = await pool.query(
    'INSERT INTO players (name, team_id, position, number) VALUES (?, ?, ?, ?)', 
    [name, team_id || null, position || null, number || null]
  );
  const [rows] = await pool.query('SELECT * FROM players WHERE id = ?', [result.insertId]);
  res.status(201).json(rows[0]);
});

router.get('/:id', async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM players WHERE id = ?', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'not found' });
  res.json(rows[0]);
});

router.put('/:id', async (req, res) => {
  const { name, team_id, position, number } = req.body;
  await pool.query(
    'UPDATE players SET name = ?, team_id = ?, position = ?, number = ? WHERE id = ?', 
    [name, team_id || null, position || null, number || null, req.params.id]
  );
  const [rows] = await pool.query('SELECT * FROM players WHERE id = ?', [req.params.id]);
  res.json(rows[0]);
});

router.delete('/:id', async (req, res) => {
  await pool.query('DELETE FROM players WHERE id = ?', [req.params.id]);
  res.status(204).end();
});

module.exports = router;
