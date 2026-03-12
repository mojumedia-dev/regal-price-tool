/**
 * Migration: Remove 4 Parkside available homes that aren't actually available
 * These lots exist in homesites but don't have built inventory homes
 */

const Database = require('./db-wrapper');
const path = require('path');

function migrate(db) {
  const already = db.prepare(`SELECT id FROM migrations WHERE id = '2026-03-12-cleanup-parkside'`).get();
  if (already) return console.log('Migration 2026-03-12 cleanup-parkside already applied, skipping.');

  console.log('🔄 Applying migration 2026-03-12: Remove incorrect Parkside available homes...');

  // Lots that should NOT be in available_homes (no built homes on them)
  const lotsToRemove = ['305', '306', '308', '311'];

  let deleted = 0;

  for (const lotNum of lotsToRemove) {
    const home = db.prepare(`
      SELECT ah.id, ah.address, c.name as community 
      FROM available_homes ah 
      JOIN communities c ON c.id = ah.community_id 
      WHERE c.name LIKE '%Parkside%' 
      AND (ah.address LIKE ? OR ah.address LIKE ?)
    `).get(`%#${lotNum})%`, `%(#${lotNum})%`);

    if (home) {
      db.prepare('DELETE FROM available_homes WHERE id = ?').run(home.id);
      console.log(`✅ Removed ${home.community} - ${home.address} from available homes`);
      deleted++;
    } else {
      console.log(`⏭️  Lot ${lotNum}: not found in available_homes (already deleted or doesn't exist)`);
    }
  }

  db.prepare(`INSERT INTO migrations (id) VALUES ('2026-03-12-cleanup-parkside')`).run();
  console.log(`✅ Migration complete! Deleted ${deleted} incorrect available homes from Parkside`);
  db.save();
}

module.exports = migrate;
