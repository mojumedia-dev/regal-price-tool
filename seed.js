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
insertComm.run(2, 'Bella Vita', 'bella-vita', '801-598-4949', '526 N Legend Way', 'MAPLETON, UT 84664', 'Monday - Saturday  11am - 5pm', 'Gary Hansen', '801-598-4949', 'Gary.H@RegalUT.com', '14559');
insertComm.run(3, 'Bristol Farms', 'bristol-farms', '385-503-5375', '1722 S 4300 W', 'OGDEN, UT 84401', 'Monday - Saturday  11am - 5pm', 'Tristan Hamblin', '385-310-6871', 'tristan@regalut.com', '15250');
insertComm.run(4, 'Amanti Lago', 'amanti-lago', '385-481-5139', '1757 W Amanti Lago Court', 'HEBER CITY, UT 84032', 'Monday - Saturday  11am - 5pm', 'Gina McBride', '801-688-2279', 'gina@regalut.com', '14558');
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
parksidePlans.forEach((p, i) => { const hid = p.pop(); insertPlan.run(planId++, 1, ...p, i+1, hid || null); });

// Bella Vita (community_id=2) — Updated from PDF 02.05.26
// Carriage Homes
const bellaVitaPlans = [
  ['Amelia (Carriage)', 1753, '1,753', 1, '2', '2-3', '2', 595000, '178536'],
  ['Alfonso (Carriage)', 1829, '1,829', 1, '2', '2-3', '2', 595000, '178535'],
  ['Adelaide (Carriage)', 1903, '1,903', 1, '2', '2-3', '2', 599000, '178533'],
  ['Alberto (Carriage)', 1960, '1,960', 1, '2', '2-3', '2', 613000, '178534'],
  ['Francesca', 1766, '1,592-1,766', 1, '2-4', '2-3', '2', 629000, '178658'],
  ['Isabella', 1836, '1,707-1,836', 1, '2-5', '2-4', '2', 652000, '178660'],
  ['Clifton', 1861, '1,656-1,861', 1, '2-4', '2-3', '2-3', 650000, '231084'],
  ['Charles', 2058, '1,858-2,058', 1, '2-6', '2-3', '2', 699000, '178657'],
  ['Bianca', 2094, '1,864-2,094', 1, '2-6', '2-4', '2', 699000, '178538'],
];
bellaVitaPlans.forEach((p, i) => { insertPlan.run(planId++, 2, p[0], p[1], p[2], p[3], p[4], p[5], p[6], p[7], i+1, p[8]); });

// Bristol Farms (community_id=3) — Updated from PDF 02.05.26
const bristolPlans = [
  ['Ashton', 1633, '1,633', 1, '3', '2', '2-3', 595000, '207053'],
  ['Ashton B (Basement)', 3279, '1,717-3,279', 1, '3-5', '2-3', '2-3', 665000, '236420'],
  ['Corbridge', 1854, '1,854', 1, '2', '2', '2-3', 623000, '207054'],
  ['Corbridge B (Basement)', 3622, '1,923-3,622', 1, '2-4', '2-3', '2-3', 685000, '237768'],
  ['Cotham', 2554, '2,554', 2, '3', '2.5', '2-3', 667000, '207055'],
  ['Cotham B (Basement)', 4024, '2,659-4,024', 2, '3-5', '2.5-3.5', '2-3', 727000, '237769'],
  ['Easton', 2166, '2,166', 2, '3', '2.5', '2-3', 639000, '207056'],
  ['Easton B (Basement)', 3394, '2,304-3,394', 2, '3-5', '2.5-3.5', '2-3', 690000, '237770'],
  ['Rosewood', 2085, '2,085', 2, '4', '2.5', '2-3', 635000, '207057'],
  ['Rosewood B (Basement)', 3224, '2,283-3,224', 2, '4-5', '2.5-3.5', '2-3', 699000, '237772'],
  ['Westbury', 2151, '2,151', 1, '3', '2', '2-3', 659000, '207058'],
  ['Westbury B (Basement)', 4137, '2,158-4,137', 1, '3-5', '2-3', '2-3', 739000, '237773'],
  ['Windsor B (Basement)', 3975, '2,010-3,975', 1, '3-6', '2-3', '2-3', null, '240969'],
];
bristolPlans.forEach((p, i) => { insertPlan.run(planId++, 3, p[0], p[1], p[2], p[3], p[4], p[5], p[6], p[7], i+1, p[8]); });

// Amanti Lago (community_id=4) — Updated from PDF 02.05.26
const amantiPlans = [
  ['The Sophia Mountain Traditional', 3570, '3,570', 1, '4', '4', '2', 3999000, '178271'],
  ['The Sophia Mountain Modern', 3570, '3,570', 1, '4', '4', '2', 4150000, '187701'],
  ['The Valentino Mountain Traditional', 3849, '3,849', 1, '4+Den', '4.5', '2', 4200000, '178272'],
  ['The Valentino Mountain Modern', 3849, '3,849', 1, '4+Den', '4.5', '2', 4300000, '187700'],
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

// ===== HOMESITES (ALL COMMUNITIES) =====
const insertLot = db.prepare(`INSERT OR REPLACE INTO homesites (id, community_id, lot_number, address, front_facing_direction, sqft, premium_price, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
let lotId = 1;

// Parkside (community_id=1)
const parksideLots = [
  ['290', '2485 W Aurora Ave', 'NW', 9643, 56000],
  ['291', '2511 W Aurora Ave', 'NW', 9302, 54000],
  ['292', '2539 W Aurora Ave', 'NW', 9629, 55000],
  ['293', '2559 W Aurora Ave', 'NW', 9866, 56000],
  ['294', '2567 W Aurora Ave', 'NW', 9827, 58000],
  ['295', '2579 W Aurora Ave', 'NW', 9766, 60000],
  ['308', '192 S Crimson Way', 'SE or NE', 9180, 42000],
  ['309', '2576 W Aurora Ave', 'SE', 7301, 38000],
  ['311', '143 S Crimson Way', 'W', 6998, 36000],
  ['312', '165 Crimson Way', 'W', 7188, 37000],
  ['313', '187 S Crimson Way', 'W or SE', 9892, 47000],
];
parksideLots.forEach((l, i) => { insertLot.run(lotId++, 1, ...l, i+1); });

// Bella Vita (community_id=2) — From PDF 01.21.26
const bellaVitaLots = [
  ['449', null, 'NW', null, 29400],
  ['450', null, 'NW', null, 29400],
  ['452', null, 'NW', null, 29400],
  ['453', null, 'N', null, 29400],
  ['454', null, 'N', null, 27900],
  ['455', null, 'N', null, 26400],
  ['476', null, 'W', null, 24900],
  ['488', null, 'NE', null, 24900],
  ['491', null, 'NE', null, 27900],
  ['492', null, 'NE', null, 27900],
  ['493', null, 'SW', null, 117900],
  ['494', null, 'SW', null, 117900],
  ['495', null, 'SW', null, 117900],
  ['496', null, 'SW', null, 117900],
  ['506', null, 'W', null, 24900],
  ['507', null, 'SW', null, 36900],
  ['508', null, 'W', null, 27900],
  ['509', null, 'W', null, 26400],
  ['518', null, 'E', null, 97900],
  ['519', null, 'E', null, 97900],
  ['520', null, 'NE', null, 24900],
];
bellaVitaLots.forEach((l, i) => { insertLot.run(lotId++, 2, ...l, i+1); });

// Bristol Farms (community_id=3) — From PDF 01.22.25
const bristolLots = [
  ['101', null, null, 17525, 21750],
  ['102', null, null, 14266, 14875],
  ['103', null, null, 14426, 14875],
  ['203', null, null, 14426, 14875],
  ['204', null, null, 14334, 14875],
  ['205', null, null, 10621, 13000],
  ['206', null, null, 10623, 13000],
  ['207', null, null, 10623, 13000],
  ['208', null, null, 10623, 13000],
  ['209', null, null, 10623, 13000],
  ['210', null, null, 10623, 13000],
  ['211', null, null, 10669, 13000],
  ['212', null, null, 10561, 17375],
  ['213', null, null, 10623, 17375],
  ['214', null, null, 10623, 17375],
  ['215', null, null, 10623, 17375],
  ['216', null, null, 10623, 17375],
  ['217', null, null, 10623, 17375],
  ['218', null, null, 10626, 17375],
  ['219', null, null, 10611, 14875],
  ['220', null, null, 10561, 14250],
  ['221', null, null, 10512, 14875],
  ['222', null, null, 12719, 14875],
  ['223', null, null, 12517, 14875],
  ['224', null, null, 12616, 15500],
  ['225', null, null, 10453, 14875],
  ['226', null, null, 10403, 14250],
  ['227', null, null, 10777, 18000],
  ['228', null, null, 10057, 15500],
  ['229', null, null, 10057, 15500],
  ['230', null, null, 10938, 18000],
  ['231', null, null, 10057, 15500],
  ['232', null, null, 10057, 16125],
  ['233', null, null, 10057, 16125],
];
bristolLots.forEach((l, i) => { insertLot.run(lotId++, 3, ...l, i+1); });

// Amanti Lago (community_id=4) — From PDF 08.28.25
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
amantiLots.forEach((l, i) => { insertLot.run(lotId++, 4, ...l, i+1); });

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

// Bella Vita (community_id=2) — Updated from QMI PDF 02.04.26
const bellaVitaHomes = [
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
bellaVitaHomes.forEach((h, i) => { insertHome.run(homeId++, 2, ...h, i+1, null); });

// Bristol Farms (community_id=3) — Updated from QMI PDF 02.12.26
const bristolHomes = [
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
bristolHomes.forEach((h, i) => { insertHome.run(homeId++, 3, ...h, i+1, null); });

// Amanti Lago (community_id=4) — Updated from QMI PDF 02.05.26
const amantiHomes = [
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
console.log(`   Homesites: ${lotId - 1}`);
console.log(`   Available Homes: ${homeId - 1}`);
db.close();
