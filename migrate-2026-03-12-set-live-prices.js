/**
 * Migration: Set last_synced_price to actual live Homefiniti prices
 * Manually verified prices from Homefiniti on 2026-03-12
 */

const Database = require('./db-wrapper');
const path = require('path');

function migrate(db) {
  const already = db.prepare(`SELECT id FROM migrations WHERE id = '2026-03-12-set-live-prices'`).get();
  if (already) return console.log('Migration 2026-03-12 set-live-prices already applied, skipping.');

  console.log('🔄 Applying migration 2026-03-12: Set last_synced_price to live Homefiniti values...');

  // Map lot numbers to actual live prices on Homefiniti (verified 2026-03-12)
  const livePrices = {
    // Amanti Lago
    '14': 4600000,
    '7': 4650000,
    '6': 4500000,
    '24': 4700000,
    '23': 4800000,
    
    // Bella Vita
    '490': 889000,
    '451': 760000,
    '447': 795000,
    '467': 629000,
    '468': 629000,
    '471': 645000,
    '470': 695000,
    '469': 685000,
    '481': 970000,
    '480': 885000,
    '479': 870000,
    
    // Parkside
    '310': 866000,
    '304': 750000,
    '287': 1195000,
    '300': 695000,
    '307': 865000,
    
    // Windflower
    '413': 980000,
    '406': 949000,
    '414': 990000,
    '415': 1185000,
    '402': 875000,
    '405': 799000,
    '403': 999000,
    
    // Bristol Farms
    '215': 649000,
    '216': 695000,
    '217': 626000,
    '218': 699000,
    '103': 850000,
    '102': 625000,
  };

  let updated = 0;
  let skipped = 0;
  let notFound = 0;

  for (const [lotNum, livePrice] of Object.entries(livePrices)) {
    // Find available home by lot number in address
    const home = db.prepare(`
      SELECT id, address, price, last_synced_price 
      FROM available_homes 
      WHERE address LIKE ? OR address LIKE ? OR address LIKE ?
    `).get(`%#${lotNum})%`, `%(#${lotNum})%`, `%Lot ${lotNum}%`);

    if (!home) {
      console.log(`⚠️  Lot ${lotNum}: not found in database`);
      notFound++;
      continue;
    }

    if (home.last_synced_price === livePrice) {
      console.log(`⏭️  ${home.address}: already has live price $${livePrice}`);
      skipped++;
      continue;
    }

    // Set last_synced_price to actual live Homefiniti value
    db.prepare('UPDATE available_homes SET last_synced_price = ? WHERE id = ?').run(livePrice, home.id);
    console.log(`✅ ${home.address}: set last_synced_price $${home.last_synced_price || home.price} → $${livePrice} (live)`);
    updated++;
  }

  db.prepare(`INSERT INTO migrations (id) VALUES ('2026-03-12-set-live-prices')`).run();
  console.log(`✅ Migration complete! Updated: ${updated}, Skipped: ${skipped}, Not found: ${notFound}`);
  db.save();
}

module.exports = migrate;
