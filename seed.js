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
    sales_manager_email TEXT
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
    sort_order INTEGER DEFAULT 0
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
    sort_order INTEGER DEFAULT 0
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
`);

// Seed user
const hash = bcrypt.hashSync('RegalHomes2026!', 10);
db.prepare(`INSERT OR REPLACE INTO users (id, email, password_hash, name, role) VALUES (1, 'heatherb@regalut.com', ?, 'Heather', 'editor')`).run(hash);
db.prepare(`INSERT OR REPLACE INTO users (id, email, password_hash, name, role) VALUES (2, 'admin@regalhomes.com', ?, 'Admin', 'admin')`).run(hash);

// Seed Parkside community
db.prepare(`INSERT OR REPLACE INTO communities (id, name, slug, phone, website, sales_office_address, sales_office_city, sales_office_hours, sales_manager_name, sales_manager_phone, sales_manager_email) VALUES (1, 'Parkside', 'parkside', '385-446-5524', 'REGALUT.COM', '526 N LEGEND WAY', 'MAPLETON, UT 84664', 'Monday - Saturday  11am - 5pm', 'Mindee Gurney', '801-836-4943', 'Mindee.RegalHomes@gmail.com')`).run();

// Assign communities to users
db.prepare(`INSERT OR REPLACE INTO user_communities (user_id, community_id) VALUES (1, 1)`).run();
db.prepare(`INSERT OR REPLACE INTO user_communities (user_id, community_id) VALUES (2, 1)`).run();

// Seed Plans (Base Prices)
const insertPlan = db.prepare(`INSERT OR REPLACE INTO plans (id, community_id, name, total_sqft, finished_sqft_range, floors, beds_range, baths_range, garage_range, base_price, sort_order) VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
const plans = [
  [1, 'The Balboa', 3111, '1,633-3,016', 1, '3-5', '2-3', '2-3', 724000, 1],
  [2, 'The Cambridge', 3107, '2,101-3,045', 2, '4-5', '3.5-4.5', '2-3', 749000, 2],
  [3, 'The Fairmount', 3879, '2,575-3,801', 2, '3-5', '3.5-4.5', '2', 869000, 3],
  [4, 'The Liberty', 3846, '2,708-3,782', 2, '3-5', '2.5-3.5', '3-4', 865000, 4],
  [5, 'The Chatsworth', 4086, '2,151-4,029', 1, '3-5', '2-3', '2-3', 795000, 5],
  [6, 'The Kensington', 4389, '2,825-4,315', 2, '2-6', '3.5-5.5', '3', 897000, 6],
];
plans.forEach(p => insertPlan.run(...p));

// Seed Homesites
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

// Seed Available Designer Homes
const insertHome = db.prepare(`INSERT OR REPLACE INTO available_homes (id, community_id, plan_name, address, total_sqft, finished_sqft, beds, baths, garage, est_move_in, price, sort_order) VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
const homes = [
  [1, 'Liberty (Model)', '2458 W Aurora Ave(#287)', 3846, 3764, 4, 3.5, 4, 'Move in Ready', 1195000, 1],
  [2, 'Cambridge', '165 S Starlight Ln(#300)', 3200, 2145, 3, 2.5, 3, 'Move in Ready', 695000, 2],
  [3, 'Cambridge', '18 S Crimson Way(#304)', 3200, 2145, 3, 2.5, 2, 'Move in Ready', 750000, 3],
  [4, 'Cambridge', '21 S Crimson Way(#310)', 3200, 3049, 5, 3.5, 3, 'Move in Ready', 866000, 4],
  [5, 'Cambridge', '36 S Crimson Way(#305)', 3200, 2145, 3, 2.5, 3, 'February', 799000, 5],
  [6, 'Cambridge', '58 S Crimson Way(#306)', 3200, 2145, 3, 2.5, 3, 'February', 833000, 6],
  [7, 'Fairmount', '79 S Crimson Way(#307)', 3929, 2575, 3, 2.5, 3, 'March', 865000, 7],
  [8, 'Balboa', '43 S Crimson Way(#311)', 3259, 2988, 5, 3, 2, 'March', 833000, 8],
  [9, 'Liberty', '2664 W Aurora Ave(#308)', 3852, 2708, 3, 2.5, 4, 'March', 974095, 9],
];
homes.forEach(h => insertHome.run(...h));

console.log('✅ Database seeded successfully!');
db.close();
