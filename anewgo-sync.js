/**
 * ANewGo Sync Module
 * Uses GraphQL API to update plan prices on dashboard.anewgo.com
 * Fields: cost, costMin, costMax
 */

const puppeteer = require('puppeteer');

const ANEWGO_LOGIN_URL = 'https://dashboard.anewgo.com/login';
const ANEWGO_GQL_URL = 'https://nexus.anewgo.com/api/graphql_gateway';
const ANEWGO_CLIENT_NAME = 'regal';
const ANEWGO_EMAIL = process.env.ANEWGO_EMAIL || 'regalhomes.adam@gmail.com';
const ANEWGO_PASSWORD = process.env.ANEWGO_PASSWORD || 'MojuAI@2026';

// ANewGo plan IDs - maps normalized plan name -> ANewGo plan ID
const PLAN_ID_MAP = {
  // Parkside
  'balboa': 6286,
  'cambridge': 6288,
  'chatsworth': 6284,
  'fairmount': 6285,
  'kensington': 6287,
  'liberty': 6283,
  // Bella Vita
  'adelaide': 6276,
  'alberto': 6277,
  'alfonso': 6279,
  'amelia': 6278,
  'bianca': 6280,
  'charles': 6282,
  'clifton': 6294,
  'francesca': 6281,
  'isabella': 6275,
  // Bristol Farms
  'ashton': 6292,
  'corbridge': 6296,
  'cotham': 6291,
  'easton': 6289,
  'rosewood': 6290,
  'westbury': 6293,
  'windsor': 6297,
  // Amanti Lago
  'sophia': 6270,
  'valentino': 6271,
  // Windflower
  'aspen': 6262,
  'birch': 6261,
  'bluebell': 6255,
  'bristlecone': 6267,
  'cliffrose': 6295,
  'foxtail': 6268,
  'juniper': 6260,
  'ponderosa': 6259,
  'poplar': 6263,
  'willow': 6266,
};

function normalizePlanName(name) {
  return name.replace(/^the\s+/i, '').trim().toLowerCase();
}

function getAnewgoPlanId(planName) {
  const normalized = normalizePlanName(planName);
  return PLAN_ID_MAP[normalized] || null;
}

/**
 * Get a JWT token by logging in via Puppeteer and capturing the GraphQL auth response
 */
async function getAuthToken() {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled'],
      defaultViewport: { width: 1400, height: 900 },
    });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    let token = null;
    page.on('response', async (response) => {
      if (response.url().includes('graphql_gateway') && !token) {
        try {
          const body = await response.text();
          const data = JSON.parse(body);
          if (data.data?.authenticate) {
            token = data.data.authenticate;
          }
        } catch {}
      }
    });

    await page.goto(ANEWGO_LOGIN_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 2000));
    await page.type('#userEmail', ANEWGO_EMAIL);
    await page.type('#password', ANEWGO_PASSWORD);
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {}),
      page.click('button[type="submit"]'),
    ]);
    await new Promise(r => setTimeout(r, 3000));

    if (!token) {
      throw new Error('Failed to capture ANewGo auth token');
    }

    return token;
  } finally {
    if (browser) await browser.close();
  }
}

/**
 * Update a plan's price via GraphQL mutation
 */
async function updatePlanPriceViaGQL(token, planId, price) {
  const mutation = `mutation UPDATE_PLAN_MUTATION($clientName: String!, $communityId: Int, $planId: Int!, $plan: UpdatePlanInput!) {
    updatePlan(clientName: $clientName, communityId: $communityId, planId: $planId, plan: $plan)
  }`;

  const response = await fetch(ANEWGO_GQL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      operationName: 'UPDATE_PLAN_MUTATION',
      variables: {
        clientName: ANEWGO_CLIENT_NAME,
        communityId: null,
        planId: planId,
        plan: { cost: price, costMin: price },
      },
      query: mutation,
    }),
  });

  const data = await response.json();
  if (data.errors) {
    throw new Error(`GraphQL error: ${JSON.stringify(data.errors)}`);
  }
  return data;
}

/**
 * Get current plan data via GraphQL query
 */
async function getPlanData(token, planId) {
  const query = `query PLAN_QUERY($clientName: String!, $communityId: Int, $planId: Int!) {
    plan(clientName: $clientName, communityId: $communityId, planId: $planId) {
      id name displayName cost costMin costMax size sizeMin sizeMax bed bedMin bedMax bath bathMin bathMax
    }
  }`;

  const response = await fetch(ANEWGO_GQL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      operationName: 'PLAN_QUERY',
      variables: { clientName: ANEWGO_CLIENT_NAME, communityId: null, planId },
      query,
    }),
  });

  const data = await response.json();
  if (data.errors) throw new Error(`GraphQL error: ${JSON.stringify(data.errors)}`);
  return data.data?.plan;
}

/**
 * Update a single plan's price
 */
async function updatePlanPrice(planName, newPrice) {
  const anewgoId = getAnewgoPlanId(planName);
  if (!anewgoId) {
    return {
      success: false,
      message: `No ANewGo ID found for plan "${planName}". Known plans: ${Object.keys(PLAN_ID_MAP).join(', ')}`,
    };
  }

  try {
    const token = await getAuthToken();
    
    // Get current data
    const currentPlan = await getPlanData(token, anewgoId);
    const oldPrice = currentPlan?.cost || 0;

    // Update
    await updatePlanPriceViaGQL(token, anewgoId, newPrice);

    console.log(`[ANewGo] ✅ Updated ${planName} (ID: ${anewgoId}): $${oldPrice} -> $${newPrice}`);
    return {
      success: true,
      message: `Updated ${planName} on ANewGo`,
      oldPrice,
      newPrice,
    };
  } catch (err) {
    console.error(`[ANewGo] ❌ Error updating ${planName}:`, err.message);
    return { success: false, message: err.message };
  }
}

/**
 * Sync multiple plan prices in a single auth session
 */
async function syncMultiplePrices(updates) {
  if (!updates.length) return [];
  const results = [];

  try {
    const token = await getAuthToken();

    for (const { planName, price } of updates) {
      const anewgoId = getAnewgoPlanId(planName);
      if (!anewgoId) {
        results.push({ planName, success: false, message: `No ANewGo ID for "${planName}"` });
        continue;
      }

      try {
        const currentPlan = await getPlanData(token, anewgoId);
        const oldPrice = currentPlan?.cost || 0;
        await updatePlanPriceViaGQL(token, anewgoId, price);
        console.log(`[ANewGo] ✅ ${planName}: $${oldPrice} -> $${price}`);
        results.push({ planName, success: true, oldPrice, newPrice: price });
      } catch (err) {
        console.error(`[ANewGo] ❌ ${planName}:`, err.message);
        results.push({ planName, success: false, message: err.message });
      }
    }
  } catch (err) {
    console.error('[ANewGo] Session error:', err.message);
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
  getAnewgoPlanId,
  normalizePlanName,
  PLAN_ID_MAP,
};
