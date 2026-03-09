/**
 * Migration: Add MLS number column to available_homes
 */
module.exports = function migrate(db) {
  const version = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='migrations'`).get();
  if (!version) {
    db.exec(`CREATE TABLE migrations (id TEXT PRIMARY KEY, applied_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
  }
  
  const already = db.prepare(`SELECT id FROM migrations WHERE id = '2026-03-09-mls-number'`).get();
  if (already) return console.log('Migration 2026-03-09 MLS number already applied, skipping.');
  
  console.log('🔄 Applying migration 2026-03-09: Add MLS number to available_homes...');

  // Add mls_number column to available_homes table
  try {
    db.exec(`ALTER TABLE available_homes ADD COLUMN mls_number TEXT`);
    console.log('✅ Added mls_number column to available_homes');
  } catch (err) {
    // Column might already exist
    if (!err.message.includes('duplicate column')) throw err;
    console.log('⚠️  mls_number column already exists, skipping');
  }

  db.prepare(`INSERT INTO migrations (id) VALUES ('2026-03-09-mls-number')`).run();
  console.log('✅ Migration 2026-03-09 applied');
};
