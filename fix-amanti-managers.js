/**
 * One-time script to add Melinda to Amanti Lago sales_managers
 * Run with: node fix-amanti-managers.js
 */

const Database = require('./db-wrapper');
const path = require('path');

async function fix() {
  await Database.init();
  const dbPath = path.join(process.env.DB_DIR || path.join(__dirname, 'db'), 'regal.db');
  const db = new Database(dbPath);
  db.pragma('foreign_keys = ON');

  console.log('🔧 Fixing Amanti Lago sales managers...\n');

  // Check current state
  console.log('Current sales_managers for Amanti Lago (community_id=4):');
  try {
    const current = db.prepare('SELECT * FROM sales_managers WHERE community_id=4').all();
    console.log(JSON.stringify(current, null, 2));
  } catch (err) {
    console.log('  ⚠️  Table might not exist yet');
  }

  // Ensure table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS sales_managers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      community_id INTEGER NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Remove existing Amanti Lago managers
  db.prepare('DELETE FROM sales_managers WHERE community_id=4').run();
  console.log('\n✅ Cleared existing Amanti Lago managers');

  // Add both managers
  const insert = db.prepare(`
    INSERT INTO sales_managers (community_id, name, phone, email, sort_order)
    VALUES (?, ?, ?, ?, ?)
  `);

  insert.run(4, 'Melinda Balsterholt', '801-656-9183', 'melinda@regalut.com', 1);
  insert.run(4, 'Gina McBride', '801-688-2279', 'gina@regalut.com', 2);

  console.log('✅ Added Melinda Balsterholt');
  console.log('✅ Added Gina McBride');

  // Verify
  const final = db.prepare('SELECT * FROM sales_managers WHERE community_id=4').all();
  console.log('\nFinal state:');
  console.log(JSON.stringify(final, null, 2));

  db.save();
  db.close();

  console.log('\n✅ Done! Amanti Lago now has both managers.');
}

fix().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
