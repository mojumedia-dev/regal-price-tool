/**
 * Migration: Add last_synced_price column to track what's live on platforms
 */

const Database = require('./db-wrapper');
const path = require('path');

function migrate(db) {
  const already = db.prepare(`SELECT id FROM migrations WHERE id = '2026-03-12-last-synced-price'`).get();
  if (already) return console.log('Migration 2026-03-12 last_synced_price already applied, skipping.');

  console.log('🔄 Applying migration 2026-03-12: Add last_synced_price columns...');

  // Add last_synced_price to plans
  try {
    db.exec(`ALTER TABLE plans ADD COLUMN last_synced_price INTEGER`);
    console.log('✅ Added last_synced_price column to plans');
  } catch (e) {
    if (!e.message.includes('duplicate column name')) throw e;
    console.log('⏭️  last_synced_price column already exists in plans');
  }

  // Add last_synced_price to homesites
  try {
    db.exec(`ALTER TABLE homesites ADD COLUMN last_synced_price INTEGER`);
    console.log('✅ Added last_synced_price column to homesites');
  } catch (e) {
    if (!e.message.includes('duplicate column name')) throw e;
    console.log('⏭️  last_synced_price column already exists in homesites');
  }

  // Add last_synced_price to available_homes
  try {
    db.exec(`ALTER TABLE available_homes ADD COLUMN last_synced_price INTEGER`);
    console.log('✅ Added last_synced_price column to available_homes');
  } catch (e) {
    if (!e.message.includes('duplicate column name')) throw e;
    console.log('⏭️  last_synced_price column already exists in available_homes');
  }

  // Initialize last_synced_price to current price for all existing items
  db.prepare('UPDATE plans SET last_synced_price = base_price WHERE last_synced_price IS NULL AND base_price IS NOT NULL').run();
  db.prepare('UPDATE homesites SET last_synced_price = premium_price WHERE last_synced_price IS NULL AND premium_price IS NOT NULL').run();
  db.prepare('UPDATE available_homes SET last_synced_price = price WHERE last_synced_price IS NULL AND price IS NOT NULL').run();
  console.log('✅ Initialized last_synced_price to current prices');

  db.prepare(`INSERT INTO migrations (id) VALUES ('2026-03-12-last-synced-price')`).run();
  console.log('✅ Migration 2026-03-12 last_synced_price complete!');
  db.save();
}

module.exports = migrate;
