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
 * Get session cookies by logging in via Puppeteer (lightweight — just login page)
 */
async function getSessionCookies() {
  let browser;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    await login(page);
    const cookies = await page.cookies();
    return cookies.map(c => `${c.name}=${c.value}`).join('; ');
  } finally {
    if (browser) await browser.close();
  }
}

/**
 * Get the CSRF token and current form data from the plan edit page via fetch
 */
async function getPlanFormData(cookies, homefinitiId) {
  const editUrl = `${HOMEFINITI_URL}/core/dashboard/plan/form/?id=${homefinitiId}`;
  const response = await fetch(editUrl, {
    headers: { 'Cookie': cookies },
    redirect: 'follow',
  });
  const html = await response.text();
  
  // Extract CSRF token
  const csrfMatch = html.match(/name="csrfmiddlewaretoken"\s+value="([^"]+)"/);
  if (!csrfMatch) throw new Error('Could not find CSRF token on plan edit page');
  
  // Extract current price
  const priceMatch = html.match(/id="plan-base_price"[^>]*value="([^"]*)"/);
  const oldPrice = priceMatch ? priceMatch[1] : '0';
  
  // Extract plan name for verification
  const nameMatch = html.match(/id="plan-name"[^>]*value="([^"]*)"/);
  const planName = nameMatch ? nameMatch[1] : '';
  
  return { csrfToken: csrfMatch[1], oldPrice, planName, cookies: response.headers.get('set-cookie') || '' };
}

/**
 * Update a plan's base price on Homefiniti
 * Uses fetch-based form submission (no page navigation needed)
 */
async function updatePlanPrice(planName, newPrice) {
  const homefinitiId = getHomefinitiPlanId(planName);
  if (!homefinitiId) {
    return {
      success: false,
      message: `No Homefiniti ID found for plan "${planName}". Known plans: ${Object.keys(PLAN_ID_MAP).join(', ')}`,
    };
  }

  try {
    // Login via Puppeteer to get session cookies
    console.log(`[Homefiniti] Logging in...`);
    const cookies = await getSessionCookies();
    
    // Fetch the plan edit page to get CSRF token and current data
    console.log(`[Homefiniti] Fetching plan form for ID ${homefinitiId}...`);
    const formData = await getPlanFormData(cookies, homefinitiId);
    
    // Verify plan name
    const normalizedCurrent = normalizePlanName(formData.planName);
    const normalizedTarget = normalizePlanName(planName);
    if (normalizedCurrent && normalizedCurrent !== normalizedTarget) {
      throw new Error(`Plan name mismatch: expected "${planName}" but found "${formData.planName}"`);
    }
    
    console.log(`[Homefiniti] Current price for ${formData.planName || planName}: ${formData.oldPrice}`);
    
    // Submit the form via POST
    const editUrl = `${HOMEFINITI_URL}/core/dashboard/plan/form/?id=${homefinitiId}`;
    const body = new URLSearchParams();
    body.append('csrfmiddlewaretoken', formData.csrfToken);
    body.append('base_price', String(newPrice));
    body.append('form_save', '');
    
    const saveResponse = await fetch(editUrl, {
      method: 'POST',
      headers: {
        'Cookie': cookies,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': editUrl,
      },
      body: body.toString(),
      redirect: 'follow',
    });
    
    if (!saveResponse.ok && saveResponse.status !== 302) {
      throw new Error(`Save request failed with status ${saveResponse.status}`);
    }
    
    // Verify the update by re-fetching
    const verifyData = await getPlanFormData(cookies, homefinitiId);
    if (String(verifyData.oldPrice) !== String(newPrice)) {
      console.log(`[Homefiniti] ⚠️ Price verification: expected ${newPrice}, got ${verifyData.oldPrice}`);
    }

    console.log(`[Homefiniti] ✅ Updated ${formData.planName || planName} price: $${formData.oldPrice} -> $${newPrice}`);

    return {
      success: true,
      message: `Updated ${formData.planName || planName} on Homefiniti`,
      oldPrice: parseInt(formData.oldPrice) || 0,
      newPrice,
    };

  } catch (err) {
    console.error(`[Homefiniti] ❌ Error updating ${planName}:`, err.message);
    return {
      success: false,
      message: err.message,
    };
  }
}

/**
 * Sync multiple plan prices in a single session (uses fetch-based approach)
 */
async function syncMultiplePrices(updates) {
  if (!updates.length) return [];
  const results = [];

  try {
    const cookies = await getSessionCookies();

    for (const { planName, price } of updates) {
      const homefinitiId = getHomefinitiPlanId(planName);
      if (!homefinitiId) {
        results.push({ planName, success: false, message: `No Homefiniti ID for "${planName}"` });
        continue;
      }

      try {
        const formData = await getPlanFormData(cookies, homefinitiId);
        
        const editUrl = `${HOMEFINITI_URL}/core/dashboard/plan/form/?id=${homefinitiId}`;
        const body = new URLSearchParams();
        body.append('csrfmiddlewaretoken', formData.csrfToken);
        body.append('base_price', String(price));
        body.append('form_save', '');
        
        await fetch(editUrl, {
          method: 'POST',
          headers: {
            'Cookie': cookies,
            'Content-Type': 'application/x-www-form-urlencoded',
            'Referer': editUrl,
          },
          body: body.toString(),
          redirect: 'follow',
        });

        console.log(`[Homefiniti] ✅ ${planName}: $${formData.oldPrice} -> $${price}`);
        results.push({ planName, success: true, oldPrice: parseInt(formData.oldPrice), newPrice: price });
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
