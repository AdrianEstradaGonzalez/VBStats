const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { init } = require('./db');

dotenv.config();

const teams = require('./routes/teams');
const players = require('./routes/players');
const matches = require('./routes/matches');
const stats = require('./routes/stats');
const settings = require('./routes/settings');
const users = require('./routes/users');
const migrate = require('./routes/migrate');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  if (req.body && Object.keys(req.body).length > 0) {
    console.log('Body:', JSON.stringify(req.body));
  }
  next();
});

app.use('/api/teams', teams);
app.use('/api/players', players);
app.use('/api/matches', matches);
app.use('/api/stats', stats);
app.use('/api/settings', settings);
app.use('/api/users', users);
app.use('/api/migrate', migrate);

app.get('/api/health', (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 4000;

init()
  .then(() => {
    app.listen(PORT, () => console.log(`VBStats backend listening on port ${PORT}`));
  })
  .catch((err) => {
    console.error('Failed to initialize DB', err);
    process.exit(1);
  });
