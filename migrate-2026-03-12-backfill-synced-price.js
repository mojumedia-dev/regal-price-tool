/**
 * Migration: Backfill last_synced_price from sync logs
 * Gets the most recent successful sync price from homefiniti_sync_log
 */

const Database = require('./db-wrapper');
const path = require('path');

function migrate(db) {
  const already = db.prepare(`SELECT id FROM migrations WHERE id = '2026-03-12-backfill-synced-price'`).get();
  if (already) return console.log('Migration 2026-03-12 backfill-synced-price already applied, skipping.');

  console.log('🔄 Applying migration 2026-03-12: Backfill last_synced_price from sync logs...');

  // Get all available homes
  const homes = db.prepare('SELECT id, plan_name, address FROM available_homes').all();
  
  let updated = 0;
  
  for (const home of homes) {
    // Find most recent successful Homefiniti sync for this home
    // Match by plan_name in the sync log
    const lastSync = db.prepare(`
      SELECT new_price, completed_at 
      FROM homefiniti_sync_log 
      WHERE plan_name LIKE ? 
      AND status = 'synced' 
      AND new_price IS NOT NULL
      ORDER BY completed_at DESC 
      LIMIT 1
    `).get(`%${home.plan_name}%`);
    
    if (lastSync && lastSync.new_price) {
      db.prepare('UPDATE available_homes SET last_synced_price = ? WHERE id = ?').run(lastSync.new_price, home.id);
      console.log(`✅ ${home.address}: set last_synced_price to $${lastSync.new_price} from ${lastSync.completed_at}`);
      updated++;
    }
  }

  db.prepare(`INSERT INTO migrations (id) VALUES ('2026-03-12-backfill-synced-price')`).run();
  console.log(`✅ Migration complete! Backfilled ${updated} available homes with last synced prices`);
  db.save();
}

module.exports = migrate;
