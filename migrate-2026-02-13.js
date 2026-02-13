/**
 * Migration: Add lot premiums for Bella Vita, Bristol Farms, Amanti Lago
 * + Update community contacts, base prices, and QMI homes from Feb 2026 PDFs
 * Run once on startup, idempotent (checks before inserting)
 */
module.exports = function migrate(db) {
  const version = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='migrations'`).get();
  if (!version) {
    db.exec(`CREATE TABLE migrations (id TEXT PRIMARY KEY, applied_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
  }
  
  const already = db.prepare(`SELECT id FROM migrations WHERE id = '2026-02-13-pdf-data'`).get();
  if (already) return console.log('Migration 2026-02-13 already applied, skipping.');
  
  console.log('🔄 Applying migration 2026-02-13: PDF data update...');
  
  // Update community contacts
  db.prepare(`UPDATE communities SET phone=?, sales_office_address=?, sales_manager_name=?, sales_manager_phone=?, sales_manager_email=? WHERE id=2`)
    .run('801-598-4949', '526 N Legend Way', 'Gary Hansen', '801-598-4949', 'Gary.H@RegalUT.com');
  db.prepare(`UPDATE communities SET phone=?, sales_office_address=?, sales_office_city=?, sales_manager_name=?, sales_manager_phone=?, sales_manager_email=? WHERE id=3`)
    .run('385-503-5375', '1722 S 4300 W', 'OGDEN, UT 84401', 'Tristan Hamblin', '385-310-6871', 'tristan@regalut.com');
  db.prepare(`UPDATE communities SET phone=?, sales_office_address=?, sales_manager_name=?, sales_manager_phone=?, sales_manager_email=? WHERE id=4`)
    .run('385-481-5139', '1757 W Amanti Lago Court', 'Gina McBride', '801-688-2279', 'gina@regalut.com');

  // Update Bella Vita plans (community_id=2)
  const planUpdates = [
    [2, 'Francesca', 629000, 1766, '1,592-1,766', '2-4', '2-3', '2'],
    [2, 'Isabella', 652000, 1836, '1,707-1,836', '2-5', '2-4', '2'],
    [2, 'Clifton', 650000, 1861, '1,656-1,861', '2-4', '2-3', '2-3'],
    [2, 'Charles', 699000, 2058, '1,858-2,058', '2-6', '2-3', '2'],
    [2, 'Bianca', 699000, 2094, '1,864-2,094', '2-6', '2-4', '2'],
  ];
  const updatePlan = db.prepare(`UPDATE plans SET base_price=?, total_sqft=?, finished_sqft_range=?, beds_range=?, baths_range=?, garage_range=? WHERE community_id=? AND name LIKE ?`);
  planUpdates.forEach(([cid, name, price, sqft, range, beds, baths, garage]) => {
    updatePlan.run(price, sqft, range, beds, baths, garage, cid, name + '%');
  });

  // Update Amanti Lago Valentino sqft (was 4434, should be 3849)
  db.prepare(`UPDATE plans SET total_sqft=3849, finished_sqft_range='3,849', beds_range='4+Den' WHERE community_id=4 AND name LIKE 'Valentino%'`).run();
  db.prepare(`UPDATE plans SET total_sqft=3849, finished_sqft_range='3,849', beds_range='4+Den' WHERE community_id=4 AND name LIKE 'The Valentino%'`).run();

  // Insert Bella Vita homesites (community_id=2)
  const insertLot = db.prepare(`INSERT INTO homesites (community_id, lot_number, address, front_facing_direction, sqft, premium_price, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)`);
  const bellaVitaLots = [
    ['449', null, 'NW', null, 29400], ['450', null, 'NW', null, 29400],
    ['452', null, 'NW', null, 29400], ['453', null, 'N', null, 29400],
    ['454', null, 'N', null, 27900], ['455', null, 'N', null, 26400],
    ['476', null, 'W', null, 24900], ['488', null, 'NE', null, 24900],
    ['491', null, 'NE', null, 27900], ['492', null, 'NE', null, 27900],
    ['493', null, 'SW', null, 117900], ['494', null, 'SW', null, 117900],
    ['495', null, 'SW', null, 117900], ['496', null, 'SW', null, 117900],
    ['506', null, 'W', null, 24900], ['507', null, 'SW', null, 36900],
    ['508', null, 'W', null, 27900], ['509', null, 'W', null, 26400],
    ['518', null, 'E', null, 97900], ['519', null, 'E', null, 97900],
    ['520', null, 'NE', null, 24900],
  ];
  bellaVitaLots.forEach((l, i) => { insertLot.run(2, l[0], l[1], l[2], l[3], l[4], i+1); });

  // Insert Bristol Farms homesites (community_id=3)
  const bristolLots = [
    ['101', null, null, 17525, 21750], ['102', null, null, 14266, 14875],
    ['103', null, null, 14426, 14875], ['203', null, null, 14426, 14875],
    ['204', null, null, 14334, 14875], ['205', null, null, 10621, 13000],
    ['206', null, null, 10623, 13000], ['207', null, null, 10623, 13000],
    ['208', null, null, 10623, 13000], ['209', null, null, 10623, 13000],
    ['210', null, null, 10623, 13000], ['211', null, null, 10669, 13000],
    ['212', null, null, 10561, 17375], ['213', null, null, 10623, 17375],
    ['214', null, null, 10623, 17375], ['215', null, null, 10623, 17375],
    ['216', null, null, 10623, 17375], ['217', null, null, 10623, 17375],
    ['218', null, null, 10626, 17375], ['219', null, null, 10611, 14875],
    ['220', null, null, 10561, 14250], ['221', null, null, 10512, 14875],
    ['222', null, null, 12719, 14875], ['223', null, null, 12517, 14875],
    ['224', null, null, 12616, 15500], ['225', null, null, 10453, 14875],
    ['226', null, null, 10403, 14250], ['227', null, null, 10777, 18000],
    ['228', null, null, 10057, 15500], ['229', null, null, 10057, 15500],
    ['230', null, null, 10938, 18000], ['231', null, null, 10057, 15500],
    ['232', null, null, 10057, 16125], ['233', null, null, 10057, 16125],
  ];
  bristolLots.forEach((l, i) => { insertLot.run(3, l[0], l[1], l[2], l[3], l[4], i+1); });

  // Insert Amanti Lago homesites (community_id=4)
  const amantiLots = [
    ['1', '11513 N Regal Ridge Court', null, 7421, 167500],
    ['2', '11493 N Regal Ridge Court', null, 8122, 187500],
    ['3', '11467 N Regal Ridge Court', null, 7611, 167500],
    ['4', '11449 N Regal Ridge Court', null, 7607, 195000],
    ['5', '11427 N Regal Ridge Court', null, 7632, 195000],
    ['6', '11409 N Regal Ridge Court', null, 8045, 235000],
    ['7', '11378 N Regal Ridge Court', null, 10686, 155000],
    ['8', '11366 N Regal Ridge Court', null, 8925, 215000],
    ['9', '11346 N Regal Ridge Court', null, 9847, 227500],
    ['10', '11334 N Regal Ridge Court', null, 9363, 440000],
    ['11', '11316 N Regal Ridge Court', null, 8324, 395000],
    ['12', '11296 N Regal Ridge Court', null, 10449, 330000],
    ['13', '11278 N Regal Ridge Court', null, 10025, 290000],
    ['14', '11252 N Regal Ridge Court', null, 9303, 250000],
    ['15', '1685 W Crystal View Court', null, 11361, 205000],
    ['16', '1665 W Crystal View Court', null, 9367, 195000],
    ['17', '1651 W Crystal View Court', null, 9448, 215000],
    ['18', '1641 W Crystal View Court', null, 10416, 225000],
    ['19', '1631 W Crystal View Court', null, 10202, 265000],
    ['20', '1617 W Crystal View Court', null, 9340, 265000],
    ['21', '1601 W Crystal View Court', null, 8648, 255000],
    ['22', '1587 W Crystal View Court', null, 8359, 265000],
    ['23', '1573 W Crystal View Court', null, 7707, 245000],
    ['24', '1561 W Crystal View Court', null, 8180, 255000],
    ['25', '1547 W Crystal View Court', null, 10851, 285000],
    ['26', '1525 W Crystal View Court', null, 9524, 267500],
    ['27', '1757 W Amanti Lago Court', null, 50752, 638500],
    ['28', '1752 W Amanti Lago Court', null, 29144, 438500],
  ];
  amantiLots.forEach((l, i) => { insertLot.run(4, l[0], l[1], l[2], l[3], l[4], i+1); });

  // Update available homes — clear old and insert fresh from QMI PDFs
  db.prepare(`DELETE FROM available_homes WHERE community_id IN (2, 3, 4)`).run();
  
  const insertHome = db.prepare(`INSERT INTO available_homes (community_id, plan_name, address, total_sqft, finished_sqft, beds, baths, garage, est_move_in, price, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  
  // Bella Vita QMI Feb 2026
  const bvHomes = [
    ['Alfonso', '549B N Legend (#467)', 1829, 1829, 2, 2, 2, 'Move in Ready', 629000],
    ['Alfonso', '567A N Legend (#468)', 1829, 1829, 2, 2, 2, 'Move in Ready', 629000],
    ['Alfonso', '567B N Legend (#471)', 1829, 1829, 2, 2, 2, 'Move in Ready', 645000],
    ['Amelia', '567D N Legend (#469)', 2281, 2281, 2, 2, 2, 'Under Construction', 685000],
    ['Amelia', '567C N Legend (#470)', 2281, 2281, 2, 2, 2, 'Under Construction', 695000],
    ['Bianca', '622 N Legend Cir (#481)', 4037, 3825, 5, 2, 3, 'Move in Ready', 970000],
    ['Bianca', '626 N Legend Cir (#479)', 4037, 3825, 5, 2, 3, 'Move in Ready', 870000],
    ['Bianca', '2152 W Legend Way (#489)', 3961, 2092, 2, 2, 2, 'Under Construction', 820000],
    ['Clifton', '624 N Legend Way (#480)', 3517, 3030, 4, 2, 3, 'Move in Ready', 885000],
    ['Clifton', '2140 W Legend Way (#490)', 3517, 3030, 2, 2, 3, 'Under Construction', 889000],
    ['Clifton', '538 N Legend Way (#505)', 3517, 3361, 3, 2, 3, 'Under Construction', 889000],
    ['Isabella', '2177 W Fortune Ln (#451)', 3541, 1932, 2, 2, 2, 'Under Construction', 760000],
    ['Isabella', '2227 W Fortune Ln (#448)', 3541, 3257, 5, 2, 3, 'Under Construction', 815000],
  ];
  bvHomes.forEach((h, i) => { insertHome.run(2, ...h, i+1); });

  // Bristol Farms QMI Feb 2026
  const bfHomes = [
    ['Easton', '1732 S 4300 W (#102)', 2145, 2145, 3, 2.5, 3, 'Move in Ready', 625000],
    ['Cotham', '1722 S 4300 W (#103)', 2554, 2554, 3, 3.5, 4, 'Move in Ready', 850000],
    ['Easton', '1612 S 4350 W (#215)', 2166, 2166, 3, 2.5, 3, 'Move in Ready', 662000],
    ['Cotham', '1624 S 4350 W (#216)', 2517, 2517, 3, 2.5, 3, 'Move in Ready', 702000],
    ['Corbridge', '1636 S 4350 W (#217)', 1855, 1855, 3, 2, 2, 'Move in Ready', 626000],
    ['Westbury', '1650 S 4350 W (#218)', 2151, 2151, 2, 3, 2, 'Move in Ready', 706000],
    ['Corbridge B', '1664 S 4350 W (#219)', 3737, 1923, 3, 2, 2, 'July', 785000],
    ['Easton B', '1637 S 4350 W (#231)', 3460, 2304, 5, 3, 2, 'June', 790000],
    ['Rosewood B', '1625 S 4350 W (#232)', 3256, 2358, 4, 2.5, 3, 'June', 799000],
    ['Easton B', '1613 S 4350 W (#233)', 3460, 3307, 5, 3, 2, 'June', 839000],
  ];
  bfHomes.forEach((h, i) => { insertHome.run(3, ...h, i+1); });

  // Amanti Lago QMI Feb 2026
  const alHomes = [
    ['Valentino M', '1641 W Crystal View Ct (#18)', 3849, 3849, 4, 4.5, 2, 'January', 3999000],
    ['Valentino M', '1587 W Crystal View Ct (#22)', 3849, 3849, 4, 4.5, 2, 'February', 3930000],
    ['Sophia M', '1573 W Crystal View Ct (#23)', 3570, 3570, 4, 4, 2, 'February', 4800000],
    ['Sophia T', '1561 W Crystal View Ct (#24)', 3570, 3570, 4, 4, 2, 'February', 4700000],
    ['Sophia T', '11252 N Regal Ridge Ct (#14)', 3570, 3570, 4, 4, 2, 'Model Home Leaseback', 4600000],
    ['Valentino M', '11409 N Regal Ridge Ct (#6)', 3849, 3849, 4, 4.5, 2, 'March', 4500000],
    ['Sophia M', '11378 N Regal Ridge Ct (#7)', 3570, 3570, 4, 4, 2, 'April', 4650000],
    ['Valentino T', '11366 N Regal Ridge Ct (#8)', 3849, 3849, 4, 4.5, 2, 'February', 4600000],
    ['Sophia T', '1601 W Crystal View Ct (#21)', 3570, 3570, 4, 4, 2, 'March', 4650000],
    ['Sophia T', '11467 N Regal Ridge Ct (#3)', 3570, 3570, 4, 4, 2, 'March', 4700000],
  ];
  alHomes.forEach((h, i) => { insertHome.run(4, ...h, i+1); });

  db.prepare(`INSERT INTO migrations (id) VALUES ('2026-02-13-pdf-data')`).run();
  console.log('✅ Migration 2026-02-13 applied: 83 homesites + 33 QMI homes + contact updates');
};
