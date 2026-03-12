/**
 * Migration: Add Cambridge Lot 300 spec ID
 */

const Database = require('./db-wrapper');
const path = require('path');

function migrate(db) {
  const already = db.prepare(`SELECT id FROM migrations WHERE id = '2026-03-12-cambridge-spec'`).get();
  if (already) return console.log('Migration 2026-03-12 Cambridge spec already applied, skipping.');

  console.log('🔄 Applying migration 2026-03-12: Add Cambridge Lot 300 spec ID...');

  // Add Cambridge Lot 300 spec ID
  const cambridge300 = db.prepare(`
    SELECT ah.id, ah.plan_name, ah.address, c.name as community 
    FROM available_homes ah 
    JOIN communities c ON c.id = ah.community_id 
    WHERE c.name LIKE '%Parkside%' 
    AND ah.plan_name LIKE '%Cambridge%' 
    AND ah.address LIKE '%300%'
  `).get();
  
  if (cambridge300) {
    db.prepare('UPDATE available_homes SET homefiniti_spec_id = ? WHERE id = ?').run('1680334', cambridge300.id);
    console.log(`✅ Added Homefiniti spec ID 1680334 to ${cambridge300.community} - ${cambridge300.plan_name} at ${cambridge300.address}`);
  } else {
    console.log('⚠️  Cambridge Lot 300 not found in database');
  }

  db.prepare(`INSERT INTO migrations (id) VALUES ('2026-03-12-cambridge-spec')`).run();
  console.log('✅ Migration 2026-03-12 Cambridge spec complete!');
  db.save();
}

module.exports = migrate;
