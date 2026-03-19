/**
 * Migration: Add sales_managers table
 * Date: 2026-03-19
 * Adds support for multiple sales managers per community
 */

module.exports = function(db) {
  // Check if migration already applied
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='sales_managers'").all();
  if (tables.length > 0) {
    console.log('Migration 2026-03-19 sales_managers already applied, skipping.');
    return;
  }

  console.log('🔄 Applying migration 2026-03-19: Add sales_managers table...');

  // Create sales_managers table
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
    
    CREATE INDEX IF NOT EXISTS idx_sales_managers_community_id ON sales_managers(community_id);
  `);

  // Migrate existing data from communities table
  const communities = db.prepare(`
    SELECT id, sales_manager_name, sales_manager_phone, sales_manager_email 
    FROM communities 
    WHERE sales_manager_name IS NOT NULL AND sales_manager_name != ''
  `).all();

  const insertManager = db.prepare(`
    INSERT INTO sales_managers (community_id, name, phone, email, sort_order)
    VALUES (?, ?, ?, ?, ?)
  `);

  let migrated = 0;
  for (const comm of communities) {
    // Handle cases where multiple managers might be in one field (separated by " / ")
    const names = comm.sales_manager_name.split(' / ');
    const phones = (comm.sales_manager_phone || '').split(' / ');
    const emails = (comm.sales_manager_email || '').split(' / ');

    names.forEach((name, index) => {
      if (name && name.trim()) {
        insertManager.run(
          comm.id,
          name.trim(),
          phones[index] ? phones[index].trim() : null,
          emails[index] ? emails[index].trim() : null,
          index + 1
        );
        migrated++;
      }
    });
  }

  db.save();
  console.log(`✅ Migration 2026-03-19 complete! Created sales_managers table and migrated ${migrated} managers.`);
};
