/**
 * Homefiniti Sync Module
 * Uses Puppeteer to update plan base prices on app.homefiniti.com
 */

const puppeteer = require('puppeteer');

const HOMEFINITI_URL = 'https://app.homefiniti.com';
const HOMEFINITI_EMAIL = process.env.HOMEFINITI_EMAIL || 'regalhomes.adam@gmail.com';
const HOMEFINITI_PASSWORD = process.env.HOMEFINITI_PASSWORD || 'MojuAI@2026';

// Homefiniti plan IDs for Parkside at Sunrise Ranch plans
// Maps plan name (lowercase, stripped of "The ") -> Homefiniti plan ID
const PLAN_ID_MAP = {
  'balboa': 178661,
  'cambridge': 199725,
  'chatsworth': 178663,
  'fairmount': 178668,
  'kensington': 178674,
  'liberty': 178671,
};

/**
 * Normalize plan name to match Homefiniti's naming
 * Our DB has "The Balboa" -> Homefiniti has "Balboa"
 */
function normalizePlanName(name) {
  return name.replace(/^the\s+/i, '').trim().toLowerCase();
}

/**
 * Get the Homefiniti plan ID for a given plan name
 */
function getHomefinitiPlanId(planName) {
  const normalized = normalizePlanName(planName);
  return PLAN_ID_MAP[normalized] || null;
}

/**
 * Launch a Puppeteer browser with stealth settings
 */
async function launchBrowser() {
  return puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled'],
    defaultViewport: { width: 1400, height: 900 },
  });
}

/**
 * Log into Homefiniti
 */
async function login(page) {
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });

  await page.goto(`${HOMEFINITI_URL}/accounts/login?next=/dashboard/`, {
    waitUntil: 'networkidle2',
    timeout: 30000,
  });
  await new Promise(r => setTimeout(r, 2000));

  await page.type('#email_id', HOMEFINITI_EMAIL);
  await page.type('#password_id', HOMEFINITI_PASSWORD);

  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 }),
    page.click('input[type="submit"]'),
  ]);

  await new Promise(r => setTimeout(r, 2000));

  if (page.url().includes('/login')) {
    throw new Error('Homefiniti login failed - still on login page');
  }

  console.log('[Homefiniti] Logged in successfully');
}

/**
 * Update a plan's base price on Homefiniti
 * Uses Puppeteer with domcontentloaded (faster than networkidle2)
 */
async function updatePlanPrice(planName, newPrice) {
  const homefinitiId = getHomefinitiPlanId(planName);
  if (!homefinitiId) {
    return {
      success: false,
      message: `No Homefiniti ID found for plan "${planName}". Known plans: ${Object.keys(PLAN_ID_MAP).join(', ')}`,
    };
  }

  let browser;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();

    // Block images, fonts, stylesheets to speed up page load
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const type = req.resourceType();
      if (['image', 'font', 'stylesheet', 'media'].includes(type)) {
        req.abort();
      } else {
        req.continue();
      }
    });

    await login(page);

    const editUrl = `${HOMEFINITI_URL}/core/dashboard/plan/form/?id=${homefinitiId}`;
    console.log(`[Homefiniti] Navigating to ${editUrl}`);
    await page.goto(editUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    
    // Wait for the price field to appear
    await page.waitForSelector('#plan-base_price', { timeout: 30000 });

    const currentName = await page.$eval('#plan-name', el => el.value).catch(() => '');
    const oldPrice = await page.$eval('#plan-base_price', el => el.value).catch(() => '0');
    console.log(`[Homefiniti] Current price for ${currentName}: ${oldPrice}`);

    // Clear and set new price
    await page.$eval('#plan-base_price', el => el.value = '');
    await page.type('#plan-base_price', String(newPrice));

    // Click Save and wait
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {}),
      page.click('button[name="form_save"]'),
    ]);
    await new Promise(r => setTimeout(r, 3000));

    console.log(`[Homefiniti] ✅ Updated ${currentName} price: $${oldPrice} -> $${newPrice}`);
    return {
      success: true,
      message: `Updated ${currentName} on Homefiniti`,
      oldPrice: parseInt(oldPrice) || 0,
      newPrice,
    };
  } catch (err) {
    console.error(`[Homefiniti] ❌ Error updating ${planName}:`, err.message);
    return { success: false, message: err.message };
  } finally {
    if (browser) await browser.close();
  }
}

/**
 * Sync multiple plan prices in a single browser session
 */
async function syncMultiplePrices(updates) {
  if (!updates.length) return [];
  let browser;
  const results = [];

  try {
    browser = await launchBrowser();
    const page = await browser.newPage();

    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const type = req.resourceType();
      if (['image', 'font', 'stylesheet', 'media'].includes(type)) {
        req.abort();
      } else {
        req.continue();
      }
    });

    await login(page);

    for (const { planName, price } of updates) {
      const homefinitiId = getHomefinitiPlanId(planName);
      if (!homefinitiId) {
        results.push({ planName, success: false, message: `No Homefiniti ID for "${planName}"` });
        continue;
      }

      try {
        const editUrl = `${HOMEFINITI_URL}/core/dashboard/plan/form/?id=${homefinitiId}`;
        await page.goto(editUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForSelector('#plan-base_price', { timeout: 30000 });

        const oldPrice = await page.$eval('#plan-base_price', el => el.value).catch(() => '0');
        await page.$eval('#plan-base_price', el => el.value = '');
        await page.type('#plan-base_price', String(price));

        await Promise.all([
          page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {}),
          page.click('button[name="form_save"]'),
        ]);
        await new Promise(r => setTimeout(r, 3000));

        console.log(`[Homefiniti] ✅ ${planName}: $${oldPrice} -> $${price}`);
        results.push({ planName, success: true, oldPrice: parseInt(oldPrice), newPrice: price });
      } catch (err) {
        console.error(`[Homefiniti] ❌ ${planName}:`, err.message);
        results.push({ planName, success: false, message: err.message });
      }
    }
  } catch (err) {
    console.error('[Homefiniti] Session error:', err.message);
    for (const { planName } of updates) {
      if (!results.find(r => r.planName === planName)) {
        results.push({ planName, success: false, message: err.message });
      }
    }
  } finally {
    if (browser) await browser.close();
  }

  return results;
}

module.exports = {
  updatePlanPrice,
  syncMultiplePrices,
  getHomefinitiPlanId,
  normalizePlanName,
  PLAN_ID_MAP,
};
