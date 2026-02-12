const express = require('express');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');

const { updatePlanPrice, getHomefinitiPlanId, normalizePlanName, PLAN_ID_MAP } = require('./homefiniti-sync');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'regal-homes-secret-2026';

// DB - auto-seed if not exists
const dbDir = path.join(__dirname, 'db');
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
const dbPath = path.join(dbDir, 'regal.db');
const needsSeed = !fs.existsSync(dbPath);
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
if (needsSeed) {
  console.log('🌱 First run - seeding database...');
  require('./seed');
  console.log('✅ Database seeded');
}

// Create homefiniti_sync_log table if not exists
db.exec(`
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
  )
`);

app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/generated-pdfs', express.static(path.join(__dirname, 'generated-pdfs')));

// Auth middleware
function auth(req, res, next) {
  const token = req.cookies.token || req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch { return res.status(401).json({ error: 'Invalid token' }); }
}

// Login
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = jwt.sign({ id: user.id, email: user.email, name: user.name, role: user.role }, JWT_SECRET, { expiresIn: '8h' });
  res.cookie('token', token, { httpOnly: true, maxAge: 8 * 3600 * 1000 });
  res.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role }, token });
});

app.post('/api/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ ok: true });
});

app.get('/api/me', auth, (req, res) => {
  res.json({ user: req.user });
});

// Communities
app.get('/api/communities', auth, (req, res) => {
  const communities = db.prepare(`
    SELECT c.* FROM communities c
    JOIN user_communities uc ON uc.community_id = c.id
    WHERE uc.user_id = ?
  `).all(req.user.id);
  res.json(communities);
});

// Plans (Base Prices)
app.get('/api/communities/:id/plans', auth, (req, res) => {
  const plans = db.prepare('SELECT * FROM plans WHERE community_id = ? ORDER BY sort_order').all(req.params.id);
  res.json(plans);
});

// Homesites
app.get('/api/communities/:id/homesites', auth, (req, res) => {
  const lots = db.prepare('SELECT * FROM homesites WHERE community_id = ? ORDER BY sort_order').all(req.params.id);
  res.json(lots);
});

// Available Homes
app.get('/api/communities/:id/available-homes', auth, (req, res) => {
  const homes = db.prepare('SELECT * FROM available_homes WHERE community_id = ? ORDER BY sort_order').all(req.params.id);
  res.json(homes);
});

// Update any allowed field
app.put('/api/:type/:id/field', auth, (req, res) => {
  const { type, id } = req.params;
  const { field, value } = req.body;
  
  const allowedFields = {
    plans: ['total_sqft', 'finished_sqft_range', 'floors', 'beds_range', 'baths_range', 'garage_range'],
    homesites: ['lot_number', 'address', 'front_facing_direction', 'sqft'],
    'available-homes': ['plan_name', 'address', 'total_sqft', 'finished_sqft', 'beds', 'baths', 'garage', 'est_move_in'],
  };
  
  const tableMap = { plans: 'plans', homesites: 'homesites', 'available-homes': 'available_homes' };
  const table = tableMap[type];
  if (!table || !allowedFields[type]?.includes(field)) return res.status(400).json({ error: 'Invalid type or field' });
  
  const current = db.prepare(`SELECT ${field} as val FROM ${table} WHERE id = ?`).get(id);
  if (!current) return res.status(404).json({ error: 'Not found' });
  
  db.prepare(`INSERT INTO price_change_log (user_id, entity_type, entity_id, field_name, old_value, new_value) VALUES (?, ?, ?, ?, ?, ?)`).run(
    req.user.id, type, id, field, String(current.val), String(value)
  );
  
  db.prepare(`UPDATE ${table} SET ${field} = ? WHERE id = ?`).run(value, id);
  res.json({ ok: true, old: current.val, new: value });
});

// Update price
app.put('/api/:type/:id/price', auth, (req, res) => {
  const { type, id } = req.params;
  const { price } = req.body;
  
  const tableMap = {
    plans: { table: 'plans', field: 'base_price' },
    homesites: { table: 'homesites', field: 'premium_price' },
    'available-homes': { table: 'available_homes', field: 'price' },
  };
  
  const config = tableMap[type];
  if (!config) return res.status(400).json({ error: 'Invalid type' });
  
  const current = db.prepare(`SELECT ${config.field} as price FROM ${config.table} WHERE id = ?`).get(id);
  if (!current) return res.status(404).json({ error: 'Not found' });
  
  // Log change
  db.prepare(`INSERT INTO price_change_log (user_id, entity_type, entity_id, field_name, old_value, new_value) VALUES (?, ?, ?, ?, ?, ?)`).run(
    req.user.id, type, id, config.field, String(current.price), String(price)
  );
  
  // Update
  db.prepare(`UPDATE ${config.table} SET ${config.field} = ? WHERE id = ?`).run(price, id);
  
  // Trigger Homefiniti sync for plan base price changes (non-blocking)
  let syncStatus = null;
  if (type === 'plans') {
    const plan = db.prepare('SELECT name FROM plans WHERE id = ?').get(id);
    if (plan && getHomefinitiPlanId(plan.name)) {
      syncStatus = 'pending';
      // Insert sync log entry
      const syncLog = db.prepare(
        'INSERT INTO homefiniti_sync_log (plan_name, plan_id, old_price, new_price, status) VALUES (?, ?, ?, ?, ?)'
      ).run(plan.name, id, current.price, price, 'pending');
      const syncLogId = syncLog.lastInsertRowid;
      
      // Fire and forget - don't block the response
      updatePlanPrice(plan.name, price).then(result => {
        db.prepare(
          'UPDATE homefiniti_sync_log SET status = ?, error_message = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?'
        ).run(result.success ? 'synced' : 'failed', result.success ? null : result.message, syncLogId);
        console.log(`[Sync] ${plan.name}: ${result.success ? '✅ synced' : '❌ ' + result.message}`);
      }).catch(err => {
        db.prepare(
          'UPDATE homefiniti_sync_log SET status = ?, error_message = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?'
        ).run('failed', err.message, syncLogId);
        console.error(`[Sync] ${plan.name}: ❌ ${err.message}`);
      });
    }
  }
  
  res.json({ ok: true, old: current.price, new: price, homefinitiSync: syncStatus });
});

// Audit log
app.get('/api/audit-log', auth, (req, res) => {
  const logs = db.prepare(`
    SELECT pcl.*, u.name as user_name, u.email as user_email
    FROM price_change_log pcl
    JOIN users u ON u.id = pcl.user_id
    ORDER BY pcl.changed_at DESC
    LIMIT 100
  `).all();
  res.json(logs);
});

// Homefiniti sync status
app.get('/api/homefiniti/sync-status', auth, (req, res) => {
  const logs = db.prepare(`
    SELECT * FROM homefiniti_sync_log ORDER BY created_at DESC LIMIT 50
  `).all();
  res.json(logs);
});

// Get latest sync status per plan
app.get('/api/homefiniti/plan-status', auth, (req, res) => {
  const statuses = db.prepare(`
    SELECT plan_name, plan_id, status, new_price, error_message, completed_at, created_at
    FROM homefiniti_sync_log
    WHERE id IN (SELECT MAX(id) FROM homefiniti_sync_log GROUP BY plan_name)
    ORDER BY created_at DESC
  `).all();
  res.json(statuses);
});

// Manual sync trigger
app.post('/api/homefiniti/sync/:planId', auth, (req, res) => {
  const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(req.params.planId);
  if (!plan) return res.status(404).json({ error: 'Plan not found' });
  
  if (!getHomefinitiPlanId(plan.name)) {
    return res.status(400).json({ error: `Plan "${plan.name}" not mapped to Homefiniti` });
  }
  
  const syncLog = db.prepare(
    'INSERT INTO homefiniti_sync_log (plan_name, plan_id, old_price, new_price, status) VALUES (?, ?, ?, ?, ?)'
  ).run(plan.name, plan.id, plan.base_price, plan.base_price, 'pending');
  const syncLogId = syncLog.lastInsertRowid;
  
  updatePlanPrice(plan.name, plan.base_price).then(result => {
    db.prepare(
      'UPDATE homefiniti_sync_log SET status = ?, error_message = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).run(result.success ? 'synced' : 'failed', result.success ? null : result.message, syncLogId);
  }).catch(err => {
    db.prepare(
      'UPDATE homefiniti_sync_log SET status = ?, error_message = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).run('failed', err.message, syncLogId);
  });
  
  res.json({ ok: true, message: `Sync started for ${plan.name}`, syncLogId });
});

// PDF generation
app.post('/api/communities/:id/generate-pdf/:type', auth, async (req, res) => {
  try {
    const communityId = req.params.id;
    const pdfType = req.params.type; // homesites, base-prices, available-homes
    const community = db.prepare('SELECT * FROM communities WHERE id = ?').get(communityId);
    if (!community) return res.status(404).json({ error: 'Community not found' });

    const { generatePDF } = require('./pdf-generator');
    let data;
    if (pdfType === 'homesites') {
      data = db.prepare('SELECT * FROM homesites WHERE community_id = ? ORDER BY sort_order').all(communityId);
    } else if (pdfType === 'base-prices') {
      data = db.prepare('SELECT * FROM plans WHERE community_id = ? ORDER BY sort_order').all(communityId);
    } else if (pdfType === 'available-homes') {
      data = db.prepare('SELECT * FROM available_homes WHERE community_id = ? ORDER BY sort_order').all(communityId);
    } else {
      return res.status(400).json({ error: 'Invalid PDF type' });
    }

    const outputDir = path.join(__dirname, 'generated-pdfs', community.slug);
    fs.mkdirSync(outputDir, { recursive: true });
    const filename = `${pdfType}-${new Date().toISOString().slice(0,10)}.pdf`;
    const outputPath = path.join(outputDir, filename);

    await generatePDF(pdfType, community, data, outputPath);
    
    res.json({ ok: true, url: `/generated-pdfs/${community.slug}/${filename}` });
  } catch (err) {
    console.error('PDF generation error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Download PDF
app.get('/api/communities/:id/download-pdf/:type', auth, async (req, res) => {
  const community = db.prepare('SELECT * FROM communities WHERE id = ?').get(req.params.id);
  if (!community) return res.status(404).json({ error: 'Community not found' });
  const outputDir = path.join(__dirname, 'generated-pdfs', community.slug);
  const files = fs.existsSync(outputDir) ? fs.readdirSync(outputDir).filter(f => f.startsWith(req.params.type)).sort().reverse() : [];
  if (!files.length) return res.status(404).json({ error: 'No PDF found. Generate one first.' });
  res.download(path.join(outputDir, files[0]));
});

app.listen(PORT, () => console.log(`🏠 Regal Homes Price Tool running on http://localhost:${PORT}`));
