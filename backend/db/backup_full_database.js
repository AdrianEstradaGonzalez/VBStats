/**
 * Full Database Backup Script
 * 
 * Generates a complete SQL dump of the VBStats database including:
 * - All table structures (CREATE TABLE statements)
 * - All data (INSERT statements)
 * - All indexes and constraints
 * 
 * Usage: node db/backup_full_database.js
 * Output: db/backup_YYYY-MM-DD_HH-MM-SS.sql
 */

const { pool } = require('../db');
const fs = require('fs');
const path = require('path');

async function generateBackup() {
  const conn = await pool.getConnection();
  let sql = '';

  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const outputFile = path.join(__dirname, `backup_${timestamp}.sql`);

    sql += `-- =====================================================\n`;
    sql += `-- VBStats Full Database Backup\n`;
    sql += `-- Generated: ${new Date().toISOString()}\n`;
    sql += `-- =====================================================\n\n`;
    sql += `SET FOREIGN_KEY_CHECKS = 0;\n`;
    sql += `SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';\n`;
    sql += `SET NAMES utf8mb4;\n\n`;

    // Get all tables
    const [tables] = await conn.query('SHOW TABLES');
    const tableKey = Object.keys(tables[0])[0];
    const tableNames = tables.map(t => t[tableKey]);

    console.log(`📋 Found ${tableNames.length} tables: ${tableNames.join(', ')}`);

    for (const tableName of tableNames) {
      console.log(`📦 Backing up table: ${tableName}...`);

      // Get CREATE TABLE statement
      const [createResult] = await conn.query(`SHOW CREATE TABLE \`${tableName}\``);
      const createStatement = createResult[0]['Create Table'];

      sql += `-- =====================================================\n`;
      sql += `-- Table: ${tableName}\n`;
      sql += `-- =====================================================\n`;
      sql += `DROP TABLE IF EXISTS \`${tableName}\`;\n`;
      sql += `${createStatement};\n\n`;

      // Get all data
      const [rows] = await conn.query(`SELECT * FROM \`${tableName}\``);

      if (rows.length > 0) {
        // Get column names
        const columns = Object.keys(rows[0]);
        const columnList = columns.map(c => `\`${c}\``).join(', ');

        sql += `-- Data for table ${tableName} (${rows.length} rows)\n`;

        // Generate INSERT statements in batches of 100
        const batchSize = 100;
        for (let i = 0; i < rows.length; i += batchSize) {
          const batch = rows.slice(i, i + batchSize);
          const values = batch.map(row => {
            const vals = columns.map(col => {
              const val = row[col];
              if (val === null) return 'NULL';
              if (val instanceof Date) return `'${val.toISOString().slice(0, 19).replace('T', ' ')}'`;
              if (typeof val === 'number') return val;
              if (typeof val === 'boolean') return val ? 1 : 0;
              if (Buffer.isBuffer(val)) return `X'${val.toString('hex')}'`;
              // Escape single quotes and backslashes
              const escaped = String(val).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '\\r');
              return `'${escaped}'`;
            });
            return `(${vals.join(', ')})`;
          });

          sql += `INSERT INTO \`${tableName}\` (${columnList}) VALUES\n`;
          sql += values.join(',\n') + ';\n';
        }
        sql += '\n';
      } else {
        sql += `-- Table ${tableName} is empty\n\n`;
      }
    }

    sql += `SET FOREIGN_KEY_CHECKS = 1;\n`;
    sql += `\n-- =====================================================\n`;
    sql += `-- End of backup\n`;
    sql += `-- =====================================================\n`;

    // Write to file
    fs.writeFileSync(outputFile, sql, 'utf8');
    console.log(`\n✅ Backup saved to: ${outputFile}`);
    console.log(`📏 File size: ${(fs.statSync(outputFile).size / 1024).toFixed(2)} KB`);

    return outputFile;
  } catch (error) {
    console.error('❌ Error generating backup:', error);
    throw error;
  } finally {
    conn.release();
  }
}

// Also generate a restore script
async function generateRestoreScript() {
  const conn = await pool.getConnection();
  let sql = '';

  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const outputFile = path.join(__dirname, `restore_point_${timestamp}.sql`);

    sql += `-- =====================================================\n`;
    sql += `-- VBStats Database Restore Point\n`;
    sql += `-- Generated: ${new Date().toISOString()}\n`;
    sql += `-- \n`;
    sql += `-- This script will COMPLETELY RESET the database to\n`;
    sql += `-- the state it was in at the time of this backup.\n`;
    sql += `-- WARNING: All current data will be REPLACED!\n`;
    sql += `-- \n`;
    sql += `-- To restore, run: mysql -u root -p vbstats < restore_point_${timestamp}.sql\n`;
    sql += `-- =====================================================\n\n`;

    sql += `SET FOREIGN_KEY_CHECKS = 0;\n`;
    sql += `SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';\n`;
    sql += `SET NAMES utf8mb4;\n\n`;

    // Get all tables in dependency order (drop in reverse order)
    const [tables] = await conn.query('SHOW TABLES');
    const tableKey = Object.keys(tables[0])[0];
    const tableNames = tables.map(t => t[tableKey]);

    // Drop all tables first
    sql += `-- Drop all existing tables\n`;
    for (const tableName of tableNames) {
      sql += `DROP TABLE IF EXISTS \`${tableName}\`;\n`;
    }
    sql += '\n';

    // Create tables and insert data
    for (const tableName of tableNames) {
      const [createResult] = await conn.query(`SHOW CREATE TABLE \`${tableName}\``);
      const createStatement = createResult[0]['Create Table'];

      sql += `-- Table: ${tableName}\n`;
      sql += `${createStatement};\n\n`;

      const [rows] = await conn.query(`SELECT * FROM \`${tableName}\``);

      if (rows.length > 0) {
        const columns = Object.keys(rows[0]);
        const columnList = columns.map(c => `\`${c}\``).join(', ');

        const batchSize = 100;
        for (let i = 0; i < rows.length; i += batchSize) {
          const batch = rows.slice(i, i + batchSize);
          const values = batch.map(row => {
            const vals = columns.map(col => {
              const val = row[col];
              if (val === null) return 'NULL';
              if (val instanceof Date) return `'${val.toISOString().slice(0, 19).replace('T', ' ')}'`;
              if (typeof val === 'number') return val;
              if (typeof val === 'boolean') return val ? 1 : 0;
              if (Buffer.isBuffer(val)) return `X'${val.toString('hex')}'`;
              const escaped = String(val).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '\\r');
              return `'${escaped}'`;
            });
            return `(${vals.join(', ')})`;
          });

          sql += `INSERT INTO \`${tableName}\` (${columnList}) VALUES\n`;
          sql += values.join(',\n') + ';\n';
        }
        sql += '\n';
      }
    }

    sql += `SET FOREIGN_KEY_CHECKS = 1;\n`;
    sql += `\n-- Restore complete\n`;

    fs.writeFileSync(outputFile, sql, 'utf8');
    console.log(`✅ Restore script saved to: ${outputFile}`);
    console.log(`📏 File size: ${(fs.statSync(outputFile).size / 1024).toFixed(2)} KB`);

    return outputFile;
  } catch (error) {
    console.error('❌ Error generating restore script:', error);
    throw error;
  } finally {
    conn.release();
  }
}

async function main() {
  console.log('🔄 Starting VBStats database backup...\n');

  try {
    const backupFile = await generateBackup();
    console.log('');
    const restoreFile = await generateRestoreScript();

    console.log('\n========================================');
    console.log('✅ Backup completed successfully!');
    console.log(`📁 Backup file: ${backupFile}`);
    console.log(`📁 Restore script: ${restoreFile}`);
    console.log('========================================\n');
    console.log('To restore the database to this point, run:');
    console.log(`  mysql -u root -p vbstats < ${restoreFile}`);
    console.log('');
  } catch (error) {
    console.error('\n❌ Backup failed:', error.message);
    process.exit(1);
  }

  process.exit(0);
}

main();
