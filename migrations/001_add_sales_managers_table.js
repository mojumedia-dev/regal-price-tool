/**
 * Migration: Add sales_managers table
 * 
 * Creates a new sales_managers table to support multiple managers per community
 * and migrates existing data from communities table.
 */

const Database = require('../db-wrapper');
const path = require('path');

async function up(db) {
  console.log('Running migration: 001_add_sales_managers_table');

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

  console.log('✓ Created sales_managers table');

  // Migrate existing sales manager data from communities table (if it exists)
  let communities = [];
  try {
    communities = db.prepare(`
      SELECT id, sales_manager_name, sales_manager_phone, sales_manager_email 
      FROM communities 
      WHERE sales_manager_name IS NOT NULL AND sales_manager_name != ''
    `).all();
  } catch (err) {
    console.log('  ℹ No existing communities table found (fresh database)');
    console.log('✓ Migration complete');
    db.save();
    return;
  }

  if (communities.length === 0) {
    console.log('  ℹ No existing sales manager data to migrate');
    console.log('✓ Migration complete');
    db.save();
    return;
  }

  const insertManager = db.prepare(`
    INSERT INTO sales_managers (community_id, name, phone, email, sort_order)
    VALUES (?, ?, ?, ?, ?)
  `);

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
        console.log(`  ✓ Migrated: ${name.trim()} for community ${comm.id}`);
      }
    });
  }

  console.log('✓ Migrated existing sales manager data');
  console.log('✓ Migration complete');
  
  db.save();
}

async function down(db) {
  console.log('Rolling back migration: 001_add_sales_managers_table');

  // Drop the table
  db.exec('DROP TABLE IF EXISTS sales_managers');
  
  console.log('✓ Dropped sales_managers table');
  console.log('✓ Rollback complete');
  
  db.save();
}

module.exports = { up, down };
