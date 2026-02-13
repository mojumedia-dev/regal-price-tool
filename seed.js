const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

const db = new Database(path.join(__dirname, 'db', 'regal.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'editor',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS communities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    phone TEXT,
    website TEXT DEFAULT 'REGALUT.COM',
    sales_office_address TEXT,
    sales_office_city TEXT,
    sales_office_hours TEXT,
    sales_manager_name TEXT,
    sales_manager_phone TEXT,
    sales_manager_email TEXT,
    homefiniti_location_id TEXT
  );

  CREATE TABLE IF NOT EXISTS user_communities (
    user_id INTEGER REFERENCES users(id),
    community_id INTEGER REFERENCES communities(id),
    PRIMARY KEY (user_id, community_id)
  );

  CREATE TABLE IF NOT EXISTS plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    community_id INTEGER REFERENCES communities(id),
    name TEXT NOT NULL,
    total_sqft INTEGER,
    finished_sqft_range TEXT,
    floors INTEGER,
    beds_range TEXT,
    baths_range TEXT,
    garage_range TEXT,
    base_price INTEGER,
    sort_order INTEGER DEFAULT 0,
    homefiniti_plan_id TEXT
  );

  CREATE TABLE IF NOT EXISTS homesites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    community_id INTEGER REFERENCES communities(id),
    lot_number TEXT NOT NULL,
    address TEXT,
    front_facing_direction TEXT,
    sqft INTEGER,
    premium_price INTEGER,
    sort_order INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS available_homes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    community_id INTEGER REFERENCES communities(id),
    plan_name TEXT,
    address TEXT,
    total_sqft INTEGER,
    finished_sqft INTEGER,
    beds INTEGER,
    baths REAL,
    garage INTEGER,
    est_move_in TEXT,
    status TEXT DEFAULT 'available',
    price INTEGER,
    sort_order INTEGER DEFAULT 0,
    homefiniti_spec_id TEXT
  );

  CREATE TABLE IF NOT EXISTS price_change_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id),
    entity_type TEXT NOT NULL,
    entity_id INTEGER NOT NULL,
    field_name TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    changed_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS homefiniti_sync_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plan_name TEXT NOT NULL,
    plan_id INTEGER,
    old_price INTEGER,
    new_price INTEGER,
    status TEXT NOT NULL DEFAULT 'pending',
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME
  );
`);

// Seed users
const hash = bcrypt.hashSync('RegalHomes2026!', 10);
db.prepare(`INSERT OR REPLACE INTO users (id, email, password_hash, name, role) VALUES (1, 'heatherb@regalut.com', ?, 'Heather', 'editor')`).run(hash);
db.prepare(`INSERT OR REPLACE INTO users (id, email, password_hash, name, role) VALUES (2, 'admin@regalhomes.com', ?, 'Admin', 'admin')`).run(hash);

// ===== COMMUNITIES =====
const insertComm = db.prepare(`INSERT OR REPLACE INTO communities (id, name, slug, phone, website, sales_office_address, sales_office_city, sales_office_hours, sales_manager_name, sales_manager_phone, sales_manager_email, homefiniti_location_id) VALUES (?, ?, ?, ?, 'REGALUT.COM', ?, ?, ?, ?, ?, ?, ?)`);

insertComm.run(1, 'Parkside', 'parkside', '385-446-5524', '2458 W Aurora Ave', 'MAPLETON, UT 84664', 'Monday - Saturday  11am - 5pm', 'Mindee Gurney', '801-836-4943', 'Mindee.RegalHomes@gmail.com', '14565');
insertComm.run(2, 'Bella Vita', 'bella-vita', '385-481-3475', '526 North Legend Way', 'MAPLETON, UT 84664', 'Monday - Saturday  11am - 5pm', 'Marissa Burdett', '385-481-3475', 'marissa@regalut.com', '14559');
insertComm.run(3, 'Bristol Farms', 'bristol-farms', '385-481-3475', '1722 S 4300 W St', 'WEST WEBER, UT 84401', 'Monday - Saturday  11am - 5pm', 'Marissa Burdett', '385-481-3475', 'marissa@regalut.com', '15250');
insertComm.run(4, 'Amanti Lago', 'amanti-lago', '(385) 481-3475', '11252 N Regal Ridge Court', 'HEBER CITY, UT 84032', 'Monday - Saturday  11am - 5pm', 'Marissa Burdett', '(385) 481-3475', 'marissa@regalut.com', '14558');
insertComm.run(5, 'Windflower', 'windflower', '385-481-3475', '1901 S Sawmill Blvd', 'HEBER CITY, UT 84032', 'Monday - Saturday  11am - 5pm', 'Marissa Burdett', '385-481-3475', 'marissa@regalut.com', '14566');

// Assign all communities to users
for (let commId = 1; commId <= 5; commId++) {
  db.prepare(`INSERT OR REPLACE INTO user_communities (user_id, community_id) VALUES (1, ?)`).run(commId);
  db.prepare(`INSERT OR REPLACE INTO user_communities (user_id, community_id) VALUES (2, ?)`).run(commId);
}

// ===== PARKSIDE PLANS =====
const insertPlan = db.prepare(`INSERT OR REPLACE INTO plans (id, community_id, name, total_sqft, finished_sqft_range, floors, beds_range, baths_range, garage_range, base_price, sort_order, homefiniti_plan_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
let planId = 1;

// Parkside (community_id=1)
const parksidePlans = [
  ['The Balboa', 3111, '1,633-3,016', 1, '3-5', '2-3', '2-3', 724000, '199724'],
  ['The Cambridge', 3107, '2,101-3,045', 2, '4-5', '3.5-4.5', '2-3', 749000, '199725'],
  ['The Fairmount', 3879, '2,575-3,801', 2, '3-5', '3.5-4.5', '2', 869000, '199726'],
  ['The Liberty', 3846, '2,708-3,782', 2, '3-5', '2.5-3.5', '3-4', 865000, '199727'],
  ['The Chatsworth', 4086, '2,151-4,029', 1, '3-5', '2-3', '2-3', 795000, '199728'],
  ['The Kensington', 4389, '2,825-4,315', 2, '2-6', '3.5-5.5', '3', 897000, '199729'],
];
parksidePlans.forEach((p, i) => { insertPlan.run(planId++, 1, ...p, i+1, p[8] || null); });

// Bella Vita (community_id=2)
const bellaVitaPlans = [
  ['Adelaide', 2392, '1,894-2,392', 1, '2-3', '2-3', '2', 614000, '178533'],
  ['Alberto', 2449, '1,923-2,449', 1, '2-3', '2-3', '2', 628000, '178534'],
  ['Alfonso', 2341, '1,829-2,341', 1, '2-3', '2-3', '2', 610000, '178535'],
  ['Amelia', 2265, '1,753-2,265', 1, '2-3', '2-3', '2', 610000, '178536'],
  ['Bianca', 4987, '2,094-4,987', 1, '2-7', '2-4', '2', 725000, '178538'],
  ['Charles', 3916, '2,058-3,916', 1, '3-6', '2-3', '2', 722000, '178657'],
  ['Clifton', 1854, '1,854', 1, '2', '2', '2', 669000, '231084'],
  ['Francesca', 3358, '1,766-3,358', 1, '2-4', '2-3', '2', 615000, '178658'],
  ['Isabella', 4262, '1,836-4,262', 1, '2-6', '2-4', '2', 634000, '178660'],
];
bellaVitaPlans.forEach((p, i) => { insertPlan.run(planId++, 2, p[0], p[1], p[2], p[3], p[4], p[5], p[6], p[7], i+1, p[8]); });

// Bristol Farms (community_id=3)
const bristolPlans = [
  ['Ashton', 1633, '1,633', 1, '3', '2', '2', 595000, '207053'],
  ['Ashton B (Basement)', 3247, '1,633-3,247', 1, '3', '2', '2', 665000, '236420'],
  ['Corbridge', 1854, '1,854', 1, '2', '2', '2-3', 623000, '207054'],
  ['Corbridge B (Basement)', 3579, '1,854-3,579', 1, '2-4', '2', '2-3', 685000, '237768'],
  ['Cotham', 2554, '2,554', 2, '3', '2.5', '3', 667000, '207055'],
  ['Cotham B (Basement)', 4024, '2,554-4,024', 2, '3-5', '2.5', '3', 727000, '237769'],
  ['Easton', 2145, '2,145', 2, '3-4', '2.5', '2-3', 639000, '207056'],
  ['Easton B (Basement)', 3348, '2,145-3,348', 2, '3-4', '2.5', '2-3', 690000, '237770'],
  ['Rosewood', 2132, '2,132', 2, '3-4', '2.5', '2-3', 635000, '207057'],
  ['Rosewood B (Basement)', 3320, '2,132-3,320', 2, '3-4', '2.5', '2-3', 699000, '237772'],
  ['Westbury', 2151, '2,151', 1, '3', '2', '2-3', 659000, '207058'],
  ['Westbury B (Basement)', 3324, '2,151-3,324', 1, '3-5', '2', '2-3', 739000, '237773'],
  ['Windsor B (Basement)', 3975, '2,010-3,975', 1, '3-6', '2-3', '2-3', null, '240969'],
];
bristolPlans.forEach((p, i) => { insertPlan.run(planId++, 3, p[0], p[1], p[2], p[3], p[4], p[5], p[6], p[7], i+1, p[8]); });

// Amanti Lago (community_id=4)
const amantiPlans = [
  ['Sophia Mountain Modern', 3570, '3,570', 1, '4', '4', '2', 4150000, '187701'],
  ['Sophia Mountain Traditional', 3570, '3,570', 1, '4', '4', '2', 3999000, '178271'],
  ['Valentino Mountain Modern', 4434, '4,434', 1, '4', '4.5', '2', 4300000, '187700'],
  ['Valentino Mountain Traditional', 4434, '4,434', 1, '4', '4.5', '2', 4200000, '178272'],
];
amantiPlans.forEach((p, i) => { insertPlan.run(planId++, 4, p[0], p[1], p[2], p[3], p[4], p[5], p[6], p[7], i+1, p[8]); });

// Windflower (community_id=5)
const windflowerPlans = [
  ['Aspen', 1995, '1,995', 1, '3', '2.5', '2', null, '178748'],
  ['Birch', 3256, '3,256', 1, '2-4', '2', '2', null, '178749'],
  ['Bluebell', 3116, '3,116', 1, '2-5', '2-3', '2-3', null, '178754'],
  ['Bristlecone', 3147, '1,676-3,147', 1, '2-4', '2-3', '2', null, '178795'],
  ['Cliffrose', 2006, '2,006', 1, '3', '2', '2', 845000, '218002'],
  ['Foxtail', 2747, '1,467-2,747', 1, '1-3', '1.5-2', '2', null, '178796'],
  ['Juniper', 3209, '2,180-3,209', 1, '3-5', '3.5-5', '2', null, '178797'],
  ['Ponderosa', 3275, '2,282-3,275', 1, '3-4', '2.5-3', '2', null, '178798'],
  ['Poplar', 3950, '2,064-3,950', 1, '2-5', '2-4', '2', null, '178799'],
  ['Willow', 3507, '3,507', 1, '2-5', '2-4', '2-3', 849000, '178801'],
];
windflowerPlans.forEach((p, i) => { insertPlan.run(planId++, 5, p[0], p[1], p[2], p[3], p[4], p[5], p[6], p[7], i+1, p[8]); });

// ===== PARKSIDE HOMESITES =====
const insertLot = db.prepare(`INSERT OR REPLACE INTO homesites (id, community_id, lot_number, address, front_facing_direction, sqft, premium_price, sort_order) VALUES (?, 1, ?, ?, ?, ?, ?, ?)`);
const lots = [
  [1, '290', '2485 W Aurora Ave', 'NW', 9643, 56000, 1],
  [2, '291', '2511W Aurora Ave', 'NW', 9302, 54000, 2],
  [3, '292', '2539 W Aurora Ave', 'NW', 9629, 55000, 3],
  [4, '293', '2559 W Aurora Ave', 'NW', 9866, 56000, 4],
  [5, '294', '2567 W Aurora Ave', 'NW', 9827, 58000, 5],
  [6, '295', '2579 W Aurora Ave', 'NW', 9766, 60000, 6],
  [7, '308', '192 S Crimson Way', 'SE or NE', 9180, 42000, 7],
  [8, '309', '2576 W Aurora Ave', 'SE', 7301, 38000, 8],
  [9, '311', '143 S Crimson Way', 'W', 6998, 36000, 9],
  [10, '312', '165 Crimson Way', 'W', 7188, 37000, 10],
  [11, '313', '187 S Crimson Way', 'W or SE', 9892, 47000, 11],
];
lots.forEach(l => insertLot.run(...l));

// ===== PARKSIDE AVAILABLE HOMES =====
const insertHome = db.prepare(`INSERT OR REPLACE INTO available_homes (id, community_id, plan_name, address, total_sqft, finished_sqft, beds, baths, garage, est_move_in, price, sort_order, homefiniti_spec_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
let homeId = 1;

// Parkside (community_id=1)
const parksideHomes = [
  ['Liberty (Model)', '2458 W Aurora Ave(#287)', 3846, 3764, 4, 3.5, 4, 'Move in Ready', 1195000],
  ['Cambridge', '165 S Starlight Ln(#300)', 3200, 2145, 3, 2.5, 3, 'Move in Ready', 695000],
  ['Cambridge', '18 S Crimson Way(#304)', 3200, 2145, 3, 2.5, 2, 'Move in Ready', 750000],
  ['Cambridge', '21 S Crimson Way(#310)', 3200, 3049, 5, 3.5, 3, 'Move in Ready', 866000],
  ['Cambridge', '36 S Crimson Way(#305)', 3200, 2145, 3, 2.5, 3, 'February', 799000],
  ['Cambridge', '58 S Crimson Way(#306)', 3200, 2145, 3, 2.5, 3, 'February', 833000],
  ['Fairmount', '79 S Crimson Way(#307)', 3929, 2575, 3, 2.5, 3, 'March', 865000],
  ['Balboa', '43 S Crimson Way(#311)', 3259, 2988, 5, 3, 2, 'March', 833000],
  ['Liberty', '2664 W Aurora Ave(#308)', 3852, 2708, 3, 2.5, 4, 'March', 974095],
];
parksideHomes.forEach((h, i) => { insertHome.run(homeId++, 1, ...h, i+1, null); });

// Bella Vita (community_id=2)
const bellaVitaHomes = [
  ['Clifton', '2140 West Legend Way (#490)', 3517, 3517, 4, 3, 2, 'Move in Ready', 889000],
  ['Isabella', '2177 W Fortune Lane (#451)', 3541, 3541, 5, 4, 2, 'February 2026', 760000],
  ['Alfonso', '549B N Legend Way (#467)', 2341, 1829, 2, 2, 2, 'Move in Ready', 629000],
  ['Alfonso', '567 A North Legend Way (#468)', 2341, 1829, 2, 2, 2, 'April 2026', 629000],
  ['Alfonso', '567 B North Legend Way (#471)', 2341, 1829, 2, 2, 2, 'Move in Ready', 645000],
  ['Amelia', '567 C North Legend Way (#470)', 2281, 2281, 3, 3, 2, 'April 2026', 695000],
  ['Amelia', '567 D North Legend Way (#469)', 2281, 2281, 3, 3, 2, 'February 2026', 685000],
  ['Bianca', '622 N Legend Cir (#481)', 4037, 4037, 5, 3, 2, 'Move in Ready', 970000],
  ['Clifton', '624 N Legend Cir (#480)', 3517, 3517, 4, 3, 2, 'Move in Ready', 885000],
  ['Bianca', '626 N Legend Cir (#479)', 4037, 4037, 5, 3, 2, 'Move in Ready', 870000],
  ['Isabella', '2239 West Fortune Lane (#447)', 4375, 4375, 5, 4, 2, 'Move in Ready', 795000],
];
bellaVitaHomes.forEach((h, i) => { insertHome.run(homeId++, 2, ...h, i+1, null); });

// Bristol Farms (community_id=3)
const bristolHomes = [
  ['Cotham', '1624 S 4350 W (#216)', 2517, 2517, 3, 2.5, 3, 'Move in Ready', 702000],
  ['Westbury', '1650 S 4350 W (#218)', 2151, 2151, 3, 2, 2, 'Move in Ready', 706000],
  ['Easton', '1612 S 4350 W (#215)', 2166, 2166, 3, 2.5, 3, 'Move in Ready', 662000],
  ['Corbridge', '1636 S 4350 W (#217)', 1855, 1855, 2, 2, 3, 'Move in Ready', 626000],
  ['Cotham (Model)', '1722 S 4300 W (#103)', 2554, 2554, 3, 2.5, 3, 'Move in Ready', 850000],
  ['Easton', '1732 S 4300 W (#102)', 2145, 2145, 3, 2.5, 3, 'Move in Ready', 625000],
];
bristolHomes.forEach((h, i) => { insertHome.run(homeId++, 3, ...h, i+1, null); });

// Amanti Lago (community_id=4)
const amantiHomes = [
  ['Sophia Mountain Traditional (Model)', '11252 N Regal Ridge Court (#14)', 3570, 3570, 4, 4, 2, 'Move in Ready', 4600000],
  ['Sophia Mountain Modern', '11378 N Regal Ridge Cr (#7)', 3570, 3570, 4, 4, 2, 'February 2026', 4650000],
  ['Valentino Mountain Modern', '11409 N Regal Ridge Ct (#6)', 4434, 4434, 4, 4.5, 2, 'Move in Ready', 4500000],
  ['Sophia Mountain Modern', '1561 W. Crystal View Ct. (#24)', 3570, 3570, 4, 4, 2, 'Move in Ready', 4700000],
  ['Sophia Mountain Traditional', '1573 W Crystal View Ct (#23)', 3570, 3570, 4, 4, 2, 'Move in Ready', 4800000],
];
amantiHomes.forEach((h, i) => { insertHome.run(homeId++, 4, ...h, i+1, null); });

// Windflower (community_id=5)
const windflowerHomes = [
  ['Cliffrose', '1903 S 1160 E (#402)', 2006, 2006, 3, 2, 2, 'Move in Ready', 875000],
  ['Cliffrose', '1906 S 1160 E (#405)', 2006, 2006, 3, 2, 2, 'Move in Ready', 799000],
  ['Willow', '1917 S 1160 E (#403)', 3507, 3507, 4, 4, 3, 'Move in Ready', 999000],
  ['Willow', '1884 S 1160 E (#406)', 3507, 3507, 3, 3, 3, 'Move in Ready', 949000],
  ['Willow', '1877 S Sawmill Blvd (#413)', 3507, 3507, 4, 4, 3, 'Move in Ready', 980000],
  ['Willow', '1891 S Sawmill Blvd (#414)', 3507, 3507, 3, 3, 3, 'Move in Ready', 990000],
  ['Willow (Model)', '1901 S Sawmill Blvd (#415)', 3507, 3507, 5, 4, 3, 'Move in Ready', 1185000],
];
windflowerHomes.forEach((h, i) => { insertHome.run(homeId++, 5, ...h, i+1, null); });

console.log('✅ Database seeded successfully!');
console.log(`   Communities: 5`);
console.log(`   Plans: ${planId - 1}`);
console.log(`   Homesites: ${lots.length}`);
console.log(`   Available Homes: ${homeId - 1}`);
db.close();
