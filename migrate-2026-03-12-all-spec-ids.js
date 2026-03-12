/**
 * Migration: Add Homefiniti spec IDs for all available homes
 */

const Database = require('./db-wrapper');
const path = require('path');

function migrate(db) {
  const already = db.prepare(`SELECT id FROM migrations WHERE id = '2026-03-12-all-spec-ids'`).get();
  if (already) return console.log('Migration 2026-03-12 all spec IDs already applied, skipping.');

  console.log('🔄 Applying migration 2026-03-12: Add all Homefiniti spec IDs...');

  // Map of lot numbers to spec IDs (extracted from lot numbers in parentheses)
  const specMapping = {
    '14': '1727031',
    '7': '1713646',
    '6': '1713645',
    '310': '1729801',
    '24': '1689941',
    '23': '1732129',
    '216': '1730632',
    '218': '1730652',
    '304': '1714140',
    '402': '1726897',
    '405': '1711680',
    '403': '1726899',
    '490': '1732126',
    '451': '1732151',
    '467': '1699974',
    '468': '1727015',
    '471': '1727017',
    '470': '1727016',
    '469': '1727013',
    '481': '1709507',
    '480': '1711096',
    '479': '1711099',
    '307': '1732128',
    '227': '1715702',
    '406': '1686860',
    '447': '1630701',
    '300': '1680334',
    '228': '1715703',
    '413': '1708657',
    '229': '1715704',
    '414': '1708660',
    '287': '1641021',
    '230': '1715705',
    '415': '1645602',
    '231': '1715707',
    '232': '1715712',
    '233': '1715715',
    '215': '1714480',
    '217': '1713751',
    '103': '1680325',
    '102': '1680323',
  };

  let updated = 0;
  let skipped = 0;

  for (const [lotNum, specId] of Object.entries(specMapping)) {
    // Find available home by lot number in address (e.g., "(#300)" or "Lot 300")
    const home = db.prepare(`
      SELECT id, plan_name, address, homefiniti_spec_id 
      FROM available_homes 
      WHERE address LIKE ? OR address LIKE ? OR address LIKE ?
    `).get(`%#${lotNum})%`, `%(#${lotNum})%`, `%Lot ${lotNum}%`);

    if (!home) {
      console.log(`⚠️  No available home found for lot ${lotNum}`);
      skipped++;
      continue;
    }

    if (home.homefiniti_spec_id === specId) {
      console.log(`⏭️  ${home.address} already has spec ID ${specId}`);
      skipped++;
      continue;
    }

    db.prepare('UPDATE available_homes SET homefiniti_spec_id = ? WHERE id = ?').run(specId, home.id);
    console.log(`✅ Set spec ID ${specId} for ${home.address}`);
    updated++;
  }

  db.prepare(`INSERT INTO migrations (id) VALUES ('2026-03-12-all-spec-ids')`).run();
  console.log(`✅ Migration complete! Updated: ${updated}, Skipped: ${skipped}`);
  db.save();
}

module.exports = migrate;
