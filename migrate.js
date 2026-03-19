#!/usr/bin/env node

/**
 * Database Migration Runner
 * 
 * Usage:
 *   node migrate.js up          - Run all pending migrations
 *   node migrate.js down        - Roll back last migration
 *   node migrate.js status      - Show migration status
 */

const Database = require('./db-wrapper');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(process.env.DB_DIR || path.join(__dirname, 'db'), 'regal.db');
const migrationsDir = path.join(__dirname, 'migrations');

// Initialize database
async function init() {
  await Database.init();
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Create migrations table if it doesn't exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  return db;
}

// Get list of migration files
function getMigrationFiles() {
  if (!fs.existsSync(migrationsDir)) {
    fs.mkdirSync(migrationsDir, { recursive: true });
    return [];
  }

  return fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.js'))
    .sort();
}

// Get applied migrations
function getAppliedMigrations(db) {
  return db.prepare('SELECT name FROM migrations ORDER BY id').all()
    .map(row => row.name);
}

// Run pending migrations
async function runUp(db) {
  const files = getMigrationFiles();
  const applied = getAppliedMigrations(db);
  const pending = files.filter(f => !applied.includes(f));

  if (pending.length === 0) {
    console.log('✓ No pending migrations');
    return;
  }

  console.log(`Running ${pending.length} migration(s)...\n`);

  for (const file of pending) {
    console.log(`▶ ${file}`);
    const migration = require(path.join(migrationsDir, file));
    
    try {
      await migration.up(db);
      db.prepare('INSERT INTO migrations (name) VALUES (?)').run(file);
      console.log(`✓ ${file} applied\n`);
    } catch (err) {
      console.error(`✗ ${file} failed: ${err.message}`);
      throw err;
    }
  }

  console.log('✓ All migrations completed');
}

// Roll back last migration
async function runDown(db) {
  const applied = getAppliedMigrations(db);
  
  if (applied.length === 0) {
    console.log('✓ No migrations to roll back');
    return;
  }

  const last = applied[applied.length - 1];
  console.log(`▶ Rolling back: ${last}\n`);

  const migration = require(path.join(migrationsDir, last));
  
  try {
    await migration.down(db);
    db.prepare('DELETE FROM migrations WHERE name = ?').run(last);
    console.log(`✓ ${last} rolled back\n`);
  } catch (err) {
    console.error(`✗ Rollback failed: ${err.message}`);
    throw err;
  }

  console.log('✓ Rollback completed');
}

// Show migration status
function showStatus(db) {
  const files = getMigrationFiles();
  const applied = getAppliedMigrations(db);

  console.log('\n📊 Migration Status\n');
  console.log('Applied migrations:');
  
  if (applied.length === 0) {
    console.log('  (none)');
  } else {
    applied.forEach(name => {
      console.log(`  ✓ ${name}`);
    });
  }

  const pending = files.filter(f => !applied.includes(f));
  console.log('\nPending migrations:');
  
  if (pending.length === 0) {
    console.log('  (none)');
  } else {
    pending.forEach(name => {
      console.log(`  ⏳ ${name}`);
    });
  }

  console.log('');
}

// Main
(async () => {
  const command = process.argv[2] || 'status';
  
  try {
    const db = await init();

    switch (command) {
      case 'up':
        await runUp(db);
        break;
      
      case 'down':
        await runDown(db);
        break;
      
      case 'status':
        showStatus(db);
        break;
      
      default:
        console.error(`Unknown command: ${command}`);
        console.log('\nUsage:');
        console.log('  node migrate.js up       - Run pending migrations');
        console.log('  node migrate.js down     - Roll back last migration');
        console.log('  node migrate.js status   - Show migration status');
        process.exit(1);
    }

    db.close();
  } catch (err) {
    console.error('\n❌ Migration failed:', err.message);
    process.exit(1);
  }
})();
