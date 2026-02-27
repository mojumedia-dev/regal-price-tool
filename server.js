const express = require('express');
const Database = require('./db-wrapper');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');

const { updatePlanPrice, getHomefinitiPlanId, normalizePlanName, PLAN_ID_MAP } = require('./homefiniti-sync');
const { updatePlanPrice: updateAnewgoPrice, getAnewgoPlanId, updateLotPremium: updateAnewgoLotPremium, updateInventoryPrice: updateAnewgoInventoryPrice, getAnewgoLotId } = require('./anewgo-sync');
const { updatePlanPrice: updateZillowPrice, getZillowPlanId } = require('./zillow-sync');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'regal-homes-secret-2026';

// DB - initialized in startServer()
let db;
const dbDir = process.env.DB_DIR || path.join(__dirname, 'db');
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
const dbPath = path.join(dbDir, 'regal.db');
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

// ===== PUBLIC API (no auth) =====

// Public: List all communities
app.get('/api/public/communities', (req, res) => {
  const communities = db.prepare('SELECT * FROM communities ORDER BY id').all();
  const result = communities.map(c => {
    const plans = db.prepare('SELECT * FROM plans WHERE community_id = ? ORDER BY sort_order').all(c.id);
    const priceRange = plans.filter(p => p.base_price).map(p => p.base_price);
    return {
      ...c,
      planCount: plans.length,
      minPrice: priceRange.length ? Math.min(...priceRange) : null,
      maxPrice: priceRange.length ? Math.max(...priceRange) : null
    };
  });
  res.json(result);
});

// Public: Single community with all data
app.get('/api/public/communities/:slug', (req, res) => {
  const community = db.prepare('SELECT * FROM communities WHERE slug = ?').get(req.params.slug);
  if (!community) return res.status(404).json({ error: 'Community not found' });
  const plans = db.prepare('SELECT * FROM plans WHERE community_id = ? ORDER BY sort_order').all(community.id);
  const homesites = db.prepare('SELECT * FROM homesites WHERE community_id = ? ORDER BY sort_order').all(community.id);
  const availableHomes = db.prepare('SELECT * FROM available_homes WHERE community_id = ? ORDER BY sort_order').all(community.id);
  res.json({ ...community, plans, homesites, availableHomes });
});

// Public: Single plan detail
app.get('/api/public/plans/:id', (req, res) => {
  const plan = db.prepare('SELECT p.*, c.name as community_name, c.slug as community_slug FROM plans p JOIN communities c ON p.community_id = c.id WHERE p.id = ?').get(req.params.id);
  if (!plan) return res.status(404).json({ error: 'Plan not found' });
  res.json(plan);
});

// Public: All available homes
app.get('/api/public/available-homes', (req, res) => {
  const homes = db.prepare('SELECT ah.*, c.name as community_name, c.slug as community_slug FROM available_homes ah JOIN communities c ON ah.community_id = c.id ORDER BY c.id, ah.sort_order').all();
  res.json(homes);
});

// Public: Summary stats
app.get('/api/public/stats', (req, res) => {
  const communities = db.prepare('SELECT COUNT(*) as count FROM communities').get().count;
  const plans = db.prepare('SELECT COUNT(*) as count FROM plans').get().count;
  const availableHomes = db.prepare('SELECT COUNT(*) as count FROM available_homes').get().count;
  const homesites = db.prepare('SELECT COUNT(*) as count FROM homesites').get().count;
  res.json({ communities, plans, availableHomes, homesites });
});

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
  db.save();
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
  
  db.save();
  res.json({ ok: true, old: current.price, new: price });
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
  
  // Resolve entity names
  for (const log of logs) {
    if (log.entity_type === 'plans') {
      const plan = db.prepare('SELECT name FROM plans WHERE id = ?').get(log.entity_id);
      log.entity_name = plan?.name || `Plan #${log.entity_id}`;
    } else if (log.entity_type === 'homesites') {
      const hs = db.prepare('SELECT h.lot_number, c.name as community FROM homesites h JOIN communities c ON c.id = h.community_id WHERE h.id = ?').get(log.entity_id);
      log.entity_name = hs ? `${hs.community} Lot ${hs.lot_number}` : `Homesite #${log.entity_id}`;
    } else if (log.entity_type === 'available-homes') {
      const ah = db.prepare('SELECT ah.plan_name, ah.address, c.name as community FROM available_homes ah JOIN communities c ON c.id = ah.community_id WHERE ah.id = ?').get(log.entity_id);
      log.entity_name = ah ? `${ah.community} - ${ah.plan_name}` : `Home #${log.entity_id}`;
    }
  }
  
  res.json(logs);
});

// Combined sync log for audit
app.get('/api/sync-log', auth, (req, res) => {
  const logs = db.prepare(`
    SELECT 'Homefiniti' as platform, plan_name, status, error_message, new_price, created_at, completed_at FROM homefiniti_sync_log
    UNION ALL
    SELECT 'ANewGo' as platform, plan_name, status, error_message, new_price, created_at, completed_at FROM anewgo_sync_log
    UNION ALL
    SELECT 'Zillow' as platform, plan_name, status, error_message, new_price, created_at, completed_at FROM zillow_sync_log
    ORDER BY created_at DESC LIMIT 100
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

// ANewGo sync status
app.get('/api/anewgo/plan-status', auth, (req, res) => {
  const statuses = db.prepare(`
    SELECT plan_name, plan_id, status, new_price, error_message, completed_at, created_at
    FROM anewgo_sync_log
    WHERE id IN (SELECT MAX(id) FROM anewgo_sync_log GROUP BY plan_name)
    ORDER BY created_at DESC
  `).all();
  res.json(statuses);
});

app.post('/api/anewgo/sync/:planId', auth, (req, res) => {
  const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(req.params.planId);
  if (!plan) return res.status(404).json({ error: 'Plan not found' });
  if (!getAnewgoPlanId(plan.name)) return res.status(400).json({ error: `Plan "${plan.name}" not mapped to ANewGo` });

  const syncLog = db.prepare(
    'INSERT INTO anewgo_sync_log (plan_name, plan_id, old_price, new_price, status) VALUES (?, ?, ?, ?, ?)'
  ).run(plan.name, plan.id, plan.base_price, plan.base_price, 'pending');
  const syncLogId = syncLog.lastInsertRowid;

  updateAnewgoPrice(plan.name, plan.base_price).then(result => {
    db.prepare('UPDATE anewgo_sync_log SET status = ?, error_message = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(result.success ? 'synced' : 'failed', result.success ? null : result.message, syncLogId);
  }).catch(err => {
    db.prepare('UPDATE anewgo_sync_log SET status = ?, error_message = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run('failed', err.message, syncLogId);
  });

  res.json({ ok: true, message: `ANewGo sync started for ${plan.name}`, syncLogId });
});

// Manual sync: homesite lot premium to ANewGo
app.post('/api/anewgo/sync-homesite/:id', auth, (req, res) => {
  const homesite = db.prepare('SELECT h.*, c.name as community FROM homesites h JOIN communities c ON c.id = h.community_id WHERE h.id = ?').get(req.params.id);
  if (!homesite) return res.status(404).json({ error: 'Homesite not found' });
  if (!getAnewgoLotId(homesite.community, homesite.lot_number)) {
    return res.status(400).json({ error: `Lot ${homesite.lot_number} (${homesite.community}) not mapped to ANewGo` });
  }

  const syncLog = db.prepare(
    'INSERT INTO anewgo_sync_log (plan_name, plan_id, old_price, new_price, status) VALUES (?, ?, ?, ?, ?)'
  ).run(`Lot ${homesite.lot_number} (${homesite.community})`, homesite.id, homesite.premium_price, homesite.premium_price, 'pending');
  const syncLogId = syncLog.lastInsertRowid;

  updateAnewgoLotPremium(homesite.community, homesite.lot_number, homesite.premium_price).then(result => {
    db.prepare('UPDATE anewgo_sync_log SET status = ?, error_message = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(result.success ? 'synced' : 'failed', result.success ? null : result.message, syncLogId);
    db.save();
  }).catch(err => {
    db.prepare('UPDATE anewgo_sync_log SET status = ?, error_message = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run('failed', err.message, syncLogId);
    db.save();
  });

  db.save();
  res.json({ ok: true, message: `ANewGo sync started for Lot ${homesite.lot_number}`, syncLogId });
});

// Manual sync: available home price to ANewGo
app.post('/api/anewgo/sync-available-home/:id', auth, (req, res) => {
  const home = db.prepare('SELECT ah.*, c.name as community FROM available_homes ah JOIN communities c ON c.id = ah.community_id WHERE ah.id = ?').get(req.params.id);
  if (!home) return res.status(404).json({ error: 'Available home not found' });
  
  const lotMatch = home.address.match(/#(\d+)/);
  if (!lotMatch) return res.status(400).json({ error: 'Cannot extract lot number from address' });
  const lotNumber = lotMatch[1];

  const syncLog = db.prepare(
    'INSERT INTO anewgo_sync_log (plan_name, plan_id, old_price, new_price, status) VALUES (?, ?, ?, ?, ?)'
  ).run(`${home.plan_name} Lot ${lotNumber} (${home.community})`, home.id, home.price, home.price, 'pending');
  const syncLogId = syncLog.lastInsertRowid;

  updateAnewgoInventoryPrice(home.community, lotNumber, home.price).then(result => {
    db.prepare('UPDATE anewgo_sync_log SET status = ?, error_message = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(result.success ? 'synced' : 'failed', result.success ? null : result.message, syncLogId);
    db.save();
  }).catch(err => {
    db.prepare('UPDATE anewgo_sync_log SET status = ?, error_message = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run('failed', err.message, syncLogId);
    db.save();
  });

  db.save();
  res.json({ ok: true, message: `ANewGo sync started for ${home.plan_name} Lot ${lotNumber}`, syncLogId });
});

// Sync all homesites for a community to ANewGo
app.post('/api/anewgo/sync-community-homesites/:communityId', auth, (req, res) => {
  const community = db.prepare('SELECT * FROM communities WHERE id = ?').get(req.params.communityId);
  if (!community) return res.status(404).json({ error: 'Community not found' });
  
  const homesites = db.prepare('SELECT * FROM homesites WHERE community_id = ?').all(community.id);
  let synced = 0;
  
  for (const hs of homesites) {
    if (!getAnewgoLotId(community.name, hs.lot_number)) continue;
    
    const syncLog = db.prepare(
      'INSERT INTO anewgo_sync_log (plan_name, plan_id, old_price, new_price, status) VALUES (?, ?, ?, ?, ?)'
    ).run(`Lot ${hs.lot_number} (${community.name})`, hs.id, hs.premium_price, hs.premium_price, 'pending');
    const syncLogId = syncLog.lastInsertRowid;
    
    updateAnewgoLotPremium(community.name, hs.lot_number, hs.premium_price).then(result => {
      db.prepare('UPDATE anewgo_sync_log SET status = ?, error_message = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(result.success ? 'synced' : 'failed', result.success ? null : result.message, syncLogId);
      db.save();
    }).catch(err => {
      db.prepare('UPDATE anewgo_sync_log SET status = ?, error_message = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run('failed', err.message, syncLogId);
      db.save();
    });
    synced++;
  }
  
  db.save();
  res.json({ ok: true, message: `Syncing ${synced} homesites to ANewGo`, count: synced });
});

// Zillow/NHF sync status
app.get('/api/zillow/plan-status', auth, (req, res) => {
  const statuses = db.prepare(`
    SELECT plan_name, plan_id, status, new_price, error_message, completed_at, created_at
    FROM zillow_sync_log
    WHERE id IN (SELECT MAX(id) FROM zillow_sync_log GROUP BY plan_name)
    ORDER BY created_at DESC
  `).all();
  res.json(statuses);
});

app.post('/api/zillow/sync/:planId', auth, (req, res) => {
  const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(req.params.planId);
  if (!plan) return res.status(404).json({ error: 'Plan not found' });
  if (!getZillowPlanId(plan.name)) return res.status(400).json({ error: `Plan "${plan.name}" not mapped to Zillow` });

  const syncLog = db.prepare(
    'INSERT INTO zillow_sync_log (plan_name, plan_id, old_price, new_price, status) VALUES (?, ?, ?, ?, ?)'
  ).run(plan.name, plan.id, plan.base_price, plan.base_price, 'pending');
  const syncLogId = syncLog.lastInsertRowid;

  updateZillowPrice(plan.name, plan.base_price).then(result => {
    db.prepare('UPDATE zillow_sync_log SET status = ?, error_message = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(result.success ? 'synced' : 'failed', result.success ? null : result.message, syncLogId);
  }).catch(err => {
    db.prepare('UPDATE zillow_sync_log SET status = ?, error_message = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run('failed', err.message, syncLogId);
  });

  res.json({ ok: true, message: `Zillow sync started for ${plan.name}`, syncLogId });
});

// Unified sync — push one plan to all platforms at once
app.post('/api/sync-all/:planId', auth, (req, res) => {
  const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(req.params.planId);
  if (!plan) return res.status(404).json({ error: 'Plan not found' });

  const platforms = [];

  function fireSync(platform, table, checkFn, syncFn) {
    if (!checkFn(plan.name)) return;
    platforms.push(platform);
    const log = db.prepare(`INSERT INTO ${table} (plan_name, plan_id, old_price, new_price, status) VALUES (?, ?, ?, ?, ?)`).run(plan.name, plan.id, plan.base_price, plan.base_price, 'pending');
    const logId = log.lastInsertRowid;
    syncFn(plan.name, plan.base_price).then(result => {
      db.prepare(`UPDATE ${table} SET status = ?, error_message = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?`)
        .run(result.success ? 'synced' : 'failed', result.success ? null : result.message, logId);
      db.save();
    }).catch(err => {
      db.prepare(`UPDATE ${table} SET status = ?, error_message = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?`)
        .run('failed', err.message, logId);
      db.save();
    });
  }

  fireSync('Homefiniti', 'homefiniti_sync_log', getHomefinitiPlanId, updatePlanPrice);
  fireSync('ANewGo', 'anewgo_sync_log', getAnewgoPlanId, updateAnewgoPrice);
  fireSync('Zillow', 'zillow_sync_log', getZillowPlanId, updateZillowPrice);

  if (!platforms.length) return res.status(400).json({ error: `Plan "${plan.name}" not mapped to any platform` });

  db.save();
  res.json({ ok: true, message: `Sync started for ${plan.name}`, platforms });
});

// Sync by plan name — Available Homes → Zillow + Homefiniti only
app.post('/api/sync-by-plan-name', auth, (req, res) => {
  const { planName } = req.body;
  if (!planName) return res.status(400).json({ error: 'planName required' });

  const plan = db.prepare('SELECT * FROM plans WHERE name = ? OR name LIKE ?').get(planName, `%${planName}%`);
  if (!plan) return res.status(404).json({ error: `No plan found matching "${planName}"` });

  const platforms = [];

  function fireSync(platform, table, checkFn, syncFn) {
    if (!checkFn(plan.name)) return;
    platforms.push(platform);
    const log = db.prepare(`INSERT INTO ${table} (plan_name, plan_id, old_price, new_price, status) VALUES (?, ?, ?, ?, ?)`).run(plan.name, plan.id, plan.base_price, plan.base_price, 'pending');
    const logId = log.lastInsertRowid;
    syncFn(plan.name, plan.base_price).then(result => {
      db.prepare(`UPDATE ${table} SET status = ?, error_message = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?`)
        .run(result.success ? 'synced' : 'failed', result.success ? null : result.message, logId);
      db.save();
    }).catch(err => {
      db.prepare(`UPDATE ${table} SET status = ?, error_message = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?`)
        .run('failed', err.message, logId);
      db.save();
    });
  }

  // Available Homes → Zillow + Homefiniti only
  fireSync('Homefiniti', 'homefiniti_sync_log', getHomefinitiPlanId, updatePlanPrice);
  fireSync('Zillow', 'zillow_sync_log', getZillowPlanId, updateZillowPrice);

  if (!platforms.length) return res.status(400).json({ error: `Plan "${plan.name}" not mapped to Homefiniti or Zillow` });

  db.save();
  res.json({ ok: true, message: `Sync started for ${plan.name}`, platforms, planId: plan.id });
});

// Sync all plans for a community — Homesites → ANewGo only
app.post('/api/sync-community/:cid', auth, (req, res) => {
  const plans = db.prepare('SELECT * FROM plans WHERE community_id = ? ORDER BY sort_order').all(req.params.cid);
  if (!plans.length) return res.status(404).json({ error: 'No plans found for this community' });

  let syncCount = 0;

  for (const plan of plans) {
    if (!plan.base_price) continue;

    // Homesites → ANewGo only
    if (!getAnewgoPlanId(plan.name)) continue;
    syncCount++;
    const log = db.prepare('INSERT INTO anewgo_sync_log (plan_name, plan_id, old_price, new_price, status) VALUES (?, ?, ?, ?, ?)').run(plan.name, plan.id, plan.base_price, plan.base_price, 'pending');
    const logId = log.lastInsertRowid;
    updateAnewgoPrice(plan.name, plan.base_price).then(result => {
      db.prepare('UPDATE anewgo_sync_log SET status = ?, error_message = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(result.success ? 'synced' : 'failed', result.success ? null : result.message, logId);
      db.save();
    }).catch(err => {
      db.prepare('UPDATE anewgo_sync_log SET status = ?, error_message = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run('failed', err.message, logId);
      db.save();
    });
  }

  db.save();
  res.json({ ok: true, planCount: plans.length, platforms: syncCount });
});

// Master Sync — push ALL plan prices to ALL platforms
app.post('/api/master-sync', auth, async (req, res) => {
  const plans = db.prepare('SELECT p.*, c.name as community_name FROM plans p JOIN communities c ON c.id = p.community_id ORDER BY p.community_id, p.sort_order').all();
  
  let syncCount = 0;
  for (const plan of plans) {
    if (!plan.base_price) continue;
    
    // Homefiniti
    if (getHomefinitiPlanId(plan.name)) {
      const log = db.prepare('INSERT INTO homefiniti_sync_log (plan_name, plan_id, old_price, new_price, status) VALUES (?, ?, ?, ?, ?)').run(plan.name, plan.id, plan.base_price, plan.base_price, 'pending');
      const logId = log.lastInsertRowid;
      updatePlanPrice(plan.name, plan.base_price).then(result => {
        db.prepare('UPDATE homefiniti_sync_log SET status = ?, error_message = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?')
          .run(result.success ? 'synced' : 'failed', result.success ? null : result.message, logId);
        db.save();
      }).catch(err => {
        db.prepare('UPDATE homefiniti_sync_log SET status = ?, error_message = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?')
          .run('failed', err.message, logId);
        db.save();
      });
      syncCount++;
    }
    
    // ANewGo
    if (getAnewgoPlanId(plan.name)) {
      const log = db.prepare('INSERT INTO anewgo_sync_log (plan_name, plan_id, old_price, new_price, status) VALUES (?, ?, ?, ?, ?)').run(plan.name, plan.id, plan.base_price, plan.base_price, 'pending');
      const logId = log.lastInsertRowid;
      updateAnewgoPrice(plan.name, plan.base_price).then(result => {
        db.prepare('UPDATE anewgo_sync_log SET status = ?, error_message = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?')
          .run(result.success ? 'synced' : 'failed', result.success ? null : result.message, logId);
        db.save();
      }).catch(err => {
        db.prepare('UPDATE anewgo_sync_log SET status = ?, error_message = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?')
          .run('failed', err.message, logId);
        db.save();
      });
      syncCount++;
    }
    
    // Zillow
    if (getZillowPlanId(plan.name)) {
      const log = db.prepare('INSERT INTO zillow_sync_log (plan_name, plan_id, old_price, new_price, status) VALUES (?, ?, ?, ?, ?)').run(plan.name, plan.id, plan.base_price, plan.base_price, 'pending');
      const logId = log.lastInsertRowid;
      updateZillowPrice(plan.name, plan.base_price).then(result => {
        db.prepare('UPDATE zillow_sync_log SET status = ?, error_message = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?')
          .run(result.success ? 'synced' : 'failed', result.success ? null : result.message, logId);
        db.save();
      }).catch(err => {
        db.prepare('UPDATE zillow_sync_log SET status = ?, error_message = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?')
          .run('failed', err.message, logId);
        db.save();
      });
      syncCount++;
    }
  }
  
  db.save();
  res.json({ ok: true, totalPlans: plans.length, syncOperations: syncCount });
});

// Master Sync status — get latest sync status per plan across all platforms
app.get('/api/master-sync/status', auth, (req, res) => {
  const plans = db.prepare('SELECT id, name FROM plans ORDER BY community_id, sort_order').all();
  
  const hfStatuses = {};
  db.prepare('SELECT plan_id, status FROM homefiniti_sync_log WHERE id IN (SELECT MAX(id) FROM homefiniti_sync_log GROUP BY plan_id)').all()
    .forEach(s => { hfStatuses[s.plan_id] = s.status; });
  
  const anStatuses = {};
  db.prepare('SELECT plan_id, status FROM anewgo_sync_log WHERE id IN (SELECT MAX(id) FROM anewgo_sync_log GROUP BY plan_id)').all()
    .forEach(s => { anStatuses[s.plan_id] = s.status; });
  
  const zlStatuses = {};
  db.prepare('SELECT plan_id, status FROM zillow_sync_log WHERE id IN (SELECT MAX(id) FROM zillow_sync_log GROUP BY plan_id)').all()
    .forEach(s => { zlStatuses[s.plan_id] = s.status; });
  
  const result = plans.map(p => ({
    plan_id: p.id,
    name: p.name,
    homefiniti: hfStatuses[p.id] || null,
    anewgo: anStatuses[p.id] || null,
    zillow: zlStatuses[p.id] || null,
  }));
  
  res.json(result);
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
    const filename = `${community.name}-${pdfType}-${new Date().toISOString().slice(0,10)}.pdf`;
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
  const files = fs.existsSync(outputDir) ? fs.readdirSync(outputDir).filter(f => f.includes(req.params.type)).sort().reverse() : [];
  if (!files.length) return res.status(404).json({ error: 'No PDF found. Generate one first.' });
  res.download(path.join(outputDir, files[0]));
});

async function startServer() {
  await Database.init();
  
  const needsSeed = !fs.existsSync(dbPath);
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  
  if (needsSeed) {
    console.log('🌱 First run - seeding database...');
    // Seed inline since seed.js creates its own db connection
    require('./seed');
    console.log('✅ Database seeded');
    // Reload db after seed
    db = new Database(dbPath);
  }
  
  // Run migrations
  try { require('./migrate-2026-02-13')(db); } catch(e) { console.error('Migration error:', e.message); }

  // Create sync log tables
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
    );
    CREATE TABLE IF NOT EXISTS anewgo_sync_log (
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
    CREATE TABLE IF NOT EXISTS zillow_sync_log (
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

  app.listen(PORT, () => console.log(`🏠 Regal Homes Price Tool running on http://localhost:${PORT}`));
}

startServer().catch(e => { console.error('Failed to start:', e); process.exit(1); });
