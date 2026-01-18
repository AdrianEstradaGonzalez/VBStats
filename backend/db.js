const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
dotenv.config();

// Prefer a full connection URL (public) when provided (e.g. MYSQL_PUBLIC_URL or MYSQL_URL).
// mysql2 supports a connection string passed directly to createPool.
const connectionUrl = process.env.MYSQL_PUBLIC_URL || process.env.MYSQL_URL;

let pool;
if (connectionUrl) {
  pool = mysql.createPool(connectionUrl);
} else {
  pool = mysql.createPool({
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: process.env.MYSQL_PORT ? Number(process.env.MYSQL_PORT) : 3306,
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'vbstats',
    waitForConnections: true,
    connectionLimit: 10,
  });
}

async function init() {
  // create basic tables if they don't exist
  const conn = await pool.getConnection();
  try {
    await conn.query(`
      CREATE TABLE IF NOT EXISTS teams (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB;
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS players (
        id INT AUTO_INCREMENT PRIMARY KEY,
        team_id INT,
        name VARCHAR(255) NOT NULL,
        position VARCHAR(100),
        number INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL
      ) ENGINE=InnoDB;
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS matches (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT,
        team_id INT,
        opponent VARCHAR(255),
        date DATETIME,
        location ENUM('home', 'away') DEFAULT 'home',
        status ENUM('in_progress', 'finished', 'cancelled') DEFAULT 'in_progress',
        total_sets INT DEFAULT 0,
        score_home INT NULL,
        score_away INT NULL,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        finished_at TIMESTAMP NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL
      ) ENGINE=InnoDB;
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS stats (
        id INT AUTO_INCREMENT PRIMARY KEY,
        match_id INT,
        player_id INT,
        metric VARCHAR(100),
        value INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,
        FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
      ) ENGINE=InnoDB;
    `);

    // Table for individual stat actions (each button press)
    await conn.query(`
      CREATE TABLE IF NOT EXISTS match_stats (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        match_id INT NOT NULL,
        player_id INT NOT NULL,
        set_number INT NOT NULL,
        stat_setting_id INT NOT NULL,
        stat_category VARCHAR(100) NOT NULL,
        stat_type VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,
        FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
        FOREIGN KEY (stat_setting_id) REFERENCES stat_settings(id) ON DELETE CASCADE,
        INDEX idx_match_set (match_id, set_number),
        INDEX idx_player_match (player_id, match_id)
      ) ENGINE=InnoDB;
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS stat_settings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        position VARCHAR(100) NOT NULL,
        stat_category VARCHAR(100) NOT NULL,
        stat_type VARCHAR(100) NOT NULL,
        enabled BOOLEAN DEFAULT TRUE,
        user_id INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_user_position_stat (user_id, position, stat_category, stat_type)
      ) ENGINE=InnoDB;
    `);

    // Create users table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB;
    `);

    // Add user_id column to stat_settings if it doesn't exist
    try {
      await conn.query(`
        ALTER TABLE stat_settings ADD COLUMN user_id INT AFTER enabled;
      `);
    } catch (err) {
      if (err.code !== 'ER_DUP_FIELDNAME') {
        console.error('Error adding user_id column to stat_settings:', err);
      }
    }

    // Update unique constraint for stat_settings to include user_id
    try {
      await conn.query(`ALTER TABLE stat_settings DROP INDEX unique_position_stat;`);
    } catch (err) {
      // Index doesn't exist, ignore
    }
    
    try {
      await conn.query(`
        ALTER TABLE stat_settings ADD UNIQUE KEY unique_user_position_stat (user_id, position, stat_category, stat_type);
      `);
    } catch (err) {
      if (err.code !== 'ER_DUP_KEYNAME') {
        console.error('Error adding unique constraint:', err);
      }
    }

    // Create default test user if not exists
    try {
      await conn.query(`
        INSERT INTO users (email, password, name) 
        VALUES ('test@vbstats.com', 'test123', 'Usuario de Prueba')
        ON DUPLICATE KEY UPDATE name = name;
      `);
    } catch (err) {
      console.error('Error creating test user:', err);
    }

    // Add number column to players table if it doesn't exist
    try {
      await conn.query(`
        ALTER TABLE players ADD COLUMN number INT AFTER position;
      `);
    } catch (err) {
      // Column already exists, ignore error
      if (err.code !== 'ER_DUP_FIELDNAME') {
        console.error('Error adding number column:', err);
      }
    }

    // Add new columns to matches table if they don't exist
    const matchColumns = [
      { name: 'user_id', definition: 'INT AFTER id' },
      { name: 'location', definition: "ENUM('home', 'away') DEFAULT 'home' AFTER date" },
      { name: 'status', definition: "ENUM('in_progress', 'finished', 'cancelled') DEFAULT 'in_progress' AFTER location" },
      { name: 'total_sets', definition: 'INT DEFAULT 0 AFTER status' },
      { name: 'score_home', definition: 'INT NULL AFTER total_sets' },
      { name: 'score_away', definition: 'INT NULL AFTER score_home' },
      { name: 'finished_at', definition: 'TIMESTAMP NULL AFTER created_at' },
    ];
    
    for (const col of matchColumns) {
      try {
        await conn.query(`ALTER TABLE matches ADD COLUMN ${col.name} ${col.definition};`);
      } catch (err) {
        if (err.code !== 'ER_DUP_FIELDNAME') {
          console.error(`Error adding ${col.name} column to matches:`, err);
        }
      }
    }

    // Create match_stats table if not exists (for individual stat actions)
    await conn.query(`
      CREATE TABLE IF NOT EXISTS match_stats (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        match_id INT NOT NULL,
        player_id INT NOT NULL,
        set_number INT NOT NULL,
        stat_setting_id INT NOT NULL,
        stat_category VARCHAR(100) NOT NULL,
        stat_type VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,
        FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
        INDEX idx_match_set (match_id, set_number),
        INDEX idx_player_match (player_id, match_id)
      ) ENGINE=InnoDB;
    `);
  } finally {
    conn.release();
  }
}

module.exports = { pool, init };
