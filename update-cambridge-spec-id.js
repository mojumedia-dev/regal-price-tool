/**
 * Add Homefiniti spec ID to Cambridge Lot 300
 */

const Database = require('./db-wrapper');
const path = require('path');

async function update() {
  await Database.init();
  const db = new Database(path.join(process.env.DB_DIR || path.join(__dirname, 'db'), 'regal.db'));
  
  // Find Cambridge Lot 300
  const home = db.prepare(`
    SELECT ah.id, ah.plan_name, ah.address, c.name as community 
    FROM available_homes ah 
    JOIN communities c ON c.id = ah.community_id 
    WHERE ah.plan_name LIKE '%Cambridge%' AND ah.address LIKE '%300%'
  `).get();
  
  if (!home) {
    console.log('❌ Cambridge Lot 300 not found');
    return;
  }
  
  console.log(`Found: ${home.community} - ${home.plan_name} at ${home.address}`);
  
  // Update with spec ID
  db.prepare('UPDATE available_homes SET homefiniti_spec_id = ? WHERE id = ?').run('1680334', home.id);
  db.save();
  
  console.log('✅ Updated homefiniti_spec_id to 1680334');
  
  // Verify
  const updated = db.prepare('SELECT homefiniti_spec_id FROM available_homes WHERE id = ?').get(home.id);
  console.log(`Verified: homefiniti_spec_id = ${updated.homefiniti_spec_id}`);
}

update().catch(console.error);
