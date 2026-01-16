const express = require('express');
const router = express.Router();
const { pool } = require('../db');

router.get('/', async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM teams ORDER BY id DESC');
  res.json(rows);
});

router.post('/', async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  const [result] = await pool.query('INSERT INTO teams (name) VALUES (?)', [name]);
  const [rows] = await pool.query('SELECT * FROM teams WHERE id = ?', [result.insertId]);
  res.status(201).json(rows[0]);
});

router.get('/:id', async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM teams WHERE id = ?', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'not found' });
  res.json(rows[0]);
});

router.put('/:id', async (req, res) => {
  const { name } = req.body;
  await pool.query('UPDATE teams SET name = ? WHERE id = ?', [name, req.params.id]);
  const [rows] = await pool.query('SELECT * FROM teams WHERE id = ?', [req.params.id]);
  res.json(rows[0]);
});

router.delete('/:id', async (req, res) => {
  await pool.query('DELETE FROM teams WHERE id = ?', [req.params.id]);
  res.status(204).end();
});

module.exports = router;
