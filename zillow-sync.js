/**
 * Zillow/NewHomeFeed Sync Module
 * Uses Puppeteer to update plan base prices on my.newhomefeed.com
 */

const puppeteer = require('puppeteer');

const NHF_LOGIN_URL = 'https://newhomefeed.com/login';
const NHF_BASE_URL = 'https://my.newhomefeed.com';
const NHF_USERNAME = process.env.NHF_USERNAME || 'Rick.regalhomes@gmail.com';
const NHF_PASSWORD = process.env.NHF_PASSWORD || 'rhbvwf7730';

// NewHomeFeed plan IDs - maps normalized plan name -> NHF plan ID
const PLAN_ID_MAP = {
  // Amanti Lago
  'sophia mountain modern': 5069429,
  'sophia mountain traditional': 5069430,
  'valentino mountain modern': 5069431,
  'valentino mountain traditional': 5069432,
  // Bella Vita
  'adelaide': 5069434,
  'alberto': 5069435,
  'alfonso': 5069436,
  'amelia': 5069437,
  'bianca': 5069438,
  'charles': 5069439,
  'francesca': 5069440,
  'isabella': 5069441,
  // Bristol Farms
  'ashton': 7754412,
  'westbury': 7754413,
  'easton': 7754414,
  'cotham': 7754415,
  'corbridge': 7754416,
  'rosewood': 7754417,
  // Parkside
  'balboa': 5069443,
  'chatsworth': 5069444,
  'fairmount': 5069445,
  'kensington': 5069446,
  'liberty': 5069447,
  // Windflower
  'birch': 5069450,
  'bluebell': 5069451,
  'bristlecone': 5069452,
  'foxtail': 5069453,
  'juniper': 5069457,
  'ponderosa': 5069460,
  'poplar': 5069464,
  'willow': 5069467,
};

function normalizePlanName(name) {
  return name.replace(/^the\s+/i, '').trim().toLowerCase();
}

function getZillowPlanId(planName) {
  const normalized = normalizePlanName(planName);
  return PLAN_ID_MAP[normalized] || null;
}

async function launchBrowser() {
  return puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled'],
    defaultViewport: { width: 1400, height: 900 },
  });
}

async function login(page) {
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });

  await page.goto(NHF_LOGIN_URL, { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 2000));

  await page.type('#login-username', NHF_USERNAME);
  await page.type('#login-password', NHF_PASSWORD);

  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {}),
    page.click('#btn-login'),
  ]);
  await new Promise(r => setTimeout(r, 3000));

  if (page.url().includes('/login')) {
    throw new Error('NewHomeFeed login failed - still on login page');
  }

  console.log('[Zillow/NHF] Logged in successfully');
}

/**
 * Update a plan's base price on NewHomeFeed
 */
async function updatePlanPrice(planName, newPrice) {
  const nhfId = getZillowPlanId(planName);
  if (!nhfId) {
    return {
      success: false,
      message: `No Zillow/NHF ID found for plan "${planName}". Known plans: ${Object.keys(PLAN_ID_MAP).join(', ')}`,
    };
  }

  let browser;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    await login(page);

    // Navigate to plan's general page
    const planUrl = `${NHF_BASE_URL}/plans/${nhfId}/general`;
    console.log(`[Zillow/NHF] Navigating to ${planUrl}`);
    await page.goto(planUrl, { waitUntil: 'networkidle2', timeout: 15000 });
    await new Promise(r => setTimeout(r, 2000));

    // Get current price
    const oldPrice = await page.$eval('#base_price', el => el.value).catch(() => '');
    console.log(`[Zillow/NHF] Current price for plan ${nhfId}: ${oldPrice}`);

    // Clear and set new price
    await page.$eval('#base_price', el => el.value = '');
    await page.click('#base_price');
    await page.type('#base_price', String(newPrice));

    // Verify
    const verifyPrice = await page.$eval('#base_price', el => el.value);
    if (String(verifyPrice) !== String(newPrice)) {
      throw new Error(`Price verification failed: set ${newPrice} but field shows ${verifyPrice}`);
    }

    // Click Save Changes button
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {}),
      page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const saveBtn = buttons.find(b => /save changes/i.test(b.textContent));
        if (saveBtn) saveBtn.click();
      }),
    ]);
    await new Promise(r => setTimeout(r, 2000));

    // Check for errors
    const errorMsg = await page.evaluate(() => {
      const alerts = document.querySelectorAll('.alert-danger, .error, [class*="error"]');
      return Array.from(alerts).map(e => e.textContent.trim()).filter(Boolean).join('; ');
    });

    if (errorMsg && /error|fail/i.test(errorMsg)) {
      throw new Error(`NHF save error: ${errorMsg}`);
    }

    console.log(`[Zillow/NHF] ✅ Updated plan ${nhfId}: $${oldPrice} -> $${newPrice}`);
    return {
      success: true,
      message: `Updated ${planName} on Zillow/NewHomeFeed`,
      oldPrice: parseInt(oldPrice) || 0,
      newPrice,
    };
  } catch (err) {
    console.error(`[Zillow/NHF] ❌ Error updating ${planName}:`, err.message);
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
    await login(page);

    for (const { planName, price } of updates) {
      const nhfId = getZillowPlanId(planName);
      if (!nhfId) {
        results.push({ planName, success: false, message: `No Zillow/NHF ID for "${planName}"` });
        continue;
      }

      try {
        const planUrl = `${NHF_BASE_URL}/plans/${nhfId}/general`;
        await page.goto(planUrl, { waitUntil: 'networkidle2', timeout: 15000 });
        await new Promise(r => setTimeout(r, 2000));

        const oldPrice = await page.$eval('#base_price', el => el.value).catch(() => '0');
        await page.$eval('#base_price', el => el.value = '');
        await page.click('#base_price');
        await page.type('#base_price', String(price));

        await Promise.all([
          page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {}),
          page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            const saveBtn = buttons.find(b => /save changes/i.test(b.textContent));
            if (saveBtn) saveBtn.click();
          }),
        ]);
        await new Promise(r => setTimeout(r, 2000));

        console.log(`[Zillow/NHF] ✅ ${planName}: $${oldPrice} -> $${price}`);
        results.push({ planName, success: true, oldPrice: parseInt(oldPrice), newPrice: price });
      } catch (err) {
        console.error(`[Zillow/NHF] ❌ ${planName}:`, err.message);
        results.push({ planName, success: false, message: err.message });
      }
    }
  } catch (err) {
    console.error('[Zillow/NHF] Session error:', err.message);
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
  getZillowPlanId,
  normalizePlanName,
  PLAN_ID_MAP,
};
