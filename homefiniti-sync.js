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
  console.log(`[Homefiniti] Sync requested for plan: "${planName}" with price: $${newPrice}`);
  
  const homefinitiId = getHomefinitiPlanId(planName);
  if (!homefinitiId) {
    console.log(`[Homefiniti] ❌ No mapping found for "${planName}"`);
    return {
      success: false,
      message: `No Homefiniti ID found for plan "${planName}". Known plans: ${Object.keys(PLAN_ID_MAP).join(', ')}`,
    };
  }

  console.log(`[Homefiniti] Plan "${planName}" mapped to ID ${homefinitiId}`);
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

    // Verify the value was set
    const setPrice = await page.$eval('#plan-base_price', el => el.value);
    if (setPrice !== String(newPrice)) {
      throw new Error(`Failed to set price field. Expected ${newPrice}, got ${setPrice}`);
    }

    // Click Save and wait for navigation
    console.log(`[Homefiniti] Clicking save button...`);
    const saveButton = await page.$('button[name="form_save"]');
    if (!saveButton) {
      throw new Error('Save button not found on page');
    }

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 }),
      saveButton.click(),
    ]);

    await new Promise(r => setTimeout(r, 2000));

    // Check final URL and page status
    const finalUrl = page.url();
    console.log(`[Homefiniti] Final URL after save: ${finalUrl}`);

    // If we're back at the dashboard or the edit page (with success), that's good
    // If we're still on the form page, verify we can see the updated price
    if (finalUrl.includes('/plan/form/')) {
      console.log(`[Homefiniti] Still on form page - verifying price was saved`);
      const verifyPrice = await page.$eval('#plan-base_price', el => el.value).catch(() => null);
      if (verifyPrice && parseInt(verifyPrice) === parseInt(newPrice)) {
        console.log(`[Homefiniti] ✅ Verified price ${verifyPrice} matches expected ${newPrice}`);
      } else {
        console.log(`[Homefiniti] ⚠️ Price verification: got ${verifyPrice}, expected ${newPrice}`);
      }
    }

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

        // Verify the value was set
        const setPrice = await page.$eval('#plan-base_price', el => el.value);
        if (setPrice !== String(price)) {
          throw new Error(`Failed to set price field. Expected ${price}, got ${setPrice}`);
        }

        const saveButton = await page.$('button[name="form_save"]');
        if (!saveButton) {
          throw new Error('Save button not found');
        }

        await Promise.all([
          page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 }),
          saveButton.click(),
        ]);
        await new Promise(r => setTimeout(r, 2000));

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
