/**
 * Migration: Add inventory home ID fields for Homefiniti, Zillow to available_homes
 * Allows syncing specific inventory homes instead of just base plans
 */

const Database = require('./db-wrapper');
const path = require('path');

async function migrate() {
  const db = new Database(path.join(process.env.DB_DIR || path.join(__dirname, 'db'), 'regal.db'));
  const already = db.prepare(`SELECT id FROM migrations WHERE id = '2026-03-12-inventory-ids'`).get();
  if (already) return console.log('Migration 2026-03-12 inventory IDs already applied, skipping.');

  console.log('🔄 Applying migration 2026-03-12: Add inventory home IDs to available_homes...');

  // Add zillow_listing_id column
  try {
    db.exec(`ALTER TABLE available_homes ADD COLUMN zillow_listing_id TEXT`);
    console.log('✅ Added zillow_listing_id column to available_homes');
  } catch (e) {
    if (!e.message.includes('duplicate column name')) throw e;
    console.log('⏭️  zillow_listing_id column already exists, skipping');
  }

  // Note: homefiniti_spec_id already exists from seed.js, mls_number from previous migration

  db.prepare(`INSERT INTO migrations (id) VALUES ('2026-03-12-inventory-ids')`).run();
  console.log('✅ Migration 2026-03-12 complete!');
  db.save();
}

if (require.main === module) {
  (async () => {
    await Database.init();
    migrate();
  })();
}

module.exports = migrate;
